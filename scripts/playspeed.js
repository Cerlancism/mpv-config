//@ts-check

// mpv speed control with fps merge (no 1x reordering)
// - speed > 1  => fps FIRST in chain
// - on release => restore original vf exactly as captured (or startup --vf=), else drop temp fps
// - property *wrappers* (no overrides) to log all sets

"use strict";
var utilities = require("../modules/utilities")

var to_string = utilities.to_string;
var deep_copy = utilities.deep_copy
var set_property_logged = utilities.set_property_logged
var set_property_number_logged = utilities.set_property_number_logged
var set_property_native_logged = utilities.set_property_native_logged

var fast_speed = 4;
var fast_speed2 = 20;
var slow_speed = 1 / 2;
var slow_speed2 = 1 / 20;

var selected_speed = 1;

var autosync_target = 120;

// ===== Drift-converging restore tunables =====
// During the gradual restore (audio-on path) we ramp the speed down CONTINUOUSLY
// toward 1x: every drift_poll_ms we lower the base speed by drift_step and bias
// it by the measured A/V drift (avsync = audio_pts - video_pts), so audio and
// video converge while the speed glides down -- no discrete level holds.
// Total restore budget ~1s: glide 4x->1x (~0.5s) + finish tail (~0.5s).
var drift_poll_ms = 100;       // ramp tick: how often we lower speed & re-correct
var drift_step = 0.6;          // speed reduction per tick: (4-1)/0.6 = 5 ticks = 0.5s
var drift_gain = 1.0;          // speed offset per second of drift (speed += gain*avsync)
var drift_max_offset = 0.5;    // clamp on the drift offset, so we never overshoot wildly
var drift_eps = 0.010;         // |avsync| (s) treated as settled at the 1x endpoint
var drift_fps_floor = 2.5;     // below this ramp speed, drop the fps decimation:
                               // it starves the renderer (waits on sparse frames)
                               // and saves little GPU once speed is this low.
var finish_stage_ms = 167;     // each of the 3 finish-tail stages (~0.5s total)

// ===== Init properties =====
var args_vf = mp.get_property_native("vf", null);
var opt_d3d11_sync = mp.get_opt("d3d11_sync");
var prop_audio = mp.get_property("audio", null);
var prop_autosync = mp.get_property("autosync", null)

var speed_timer = null;
var vf_restore_timer = null;
var is_restoring_speed = false;
var ramp_decimating = false;   // true while the ramp still has the fps filter in
var vf_at_keydown = null;

var baseFps = 120

// mpv timebase
var delta_time = 1 / ((baseFps * 1000) / 1001);

print("startup vf:", to_string(args_vf));

// ========= VF helpers =========
function get_vf() {
    return mp.get_property_native("vf") || [];
}
/**
 * @param {unknown} vf
 */
function set_vf(vf) {
    set_property_native_logged("vf", vf || []);
}

/**
 * @param {string} x
 */
function normName(x) {
    if (x == null) return null;
    if (typeof x !== "string") x = String(x);
    return x.replace(/^\s+/, "").replace(/\s+$/, "");
}

/**
 * @param {any} f
 */
function isLavfiFpsFilter(f) {
    var g = f && f.params && typeof f.params.graph === "string" ? f.params.graph : null;
    return typeof g === "string" && /[=,:]\s*fps\s*=/.test(g);
}

/**
 * @param {string | any[]} vf
 */
function find_fps(vf) {
    if (!Array.isArray(vf)) return [null, null];
    for (var i = 0; i < vf.length; i++) {
        var f = vf[i];
        if (f && typeof f === "object") {
            var name = normName(f.name);
            if (name === "fps") return [i, f];
            if (name === "lavfi" && isLavfiFpsFilter(f)) return [i, f];
        }
    }
    return [null, null];
}

/**
 * @param {any} vf
 * @param {string} fps_expr
 * @param {number} speed
 * @param {boolean} slowing
 */
function upsert_fps(vf, fps_expr, speed, slowing) {
    vf = deep_copy(vf) || [];
    var res = find_fps(vf);
    var idx = res[0], fps_filter = res[1];

    if (fps_filter) {
        if (idx != null) vf.splice(idx, 1);
        fps_filter.params = fps_filter.params || {};
        fps_filter.params.fps = fps_expr;
    } else {
        fps_filter = { name: "fps", params: { fps: fps_expr } };
    }

    if (speed > 1 || !!slowing) {
        vf.splice(0, 0, fps_filter);
    } else {
        vf.push(fps_filter);
    }
    return vf;
}

/**
 * @param {number} speed
 * @param {boolean} slowing
 */
function fps_for_speed(speed, slowing) {
    if (speed > 1 || slowing) {
        return ((baseFps * 1000 / 2) / speed) + "/1001";
    } else {
        return (baseFps * 1000 / speed) + "/1001";
    }
}

function restore_original_vf_exact() {
    set_vf(args_vf);
    vf_at_keydown = null;
}

// ========= Gradual restore =========
function gradually_restore_speed() {
    var current_speed;
    try {
        current_speed = mp.get_property_number("speed");
    } catch (e) {
        current_speed = 1;
    }

    set_property_logged("autosync", autosync_target)

    if (current_speed > 1 && (selected_speed > fast_speed)) {
        // Audio-OFF path (e.g. 20x): avsync is unavailable (no audio clock), so
        // just ramp speed down and let autosync settle the residual on re-enable.
        print("gradually slow down")
        var slower_speed_candidate = current_speed / 2;
        var slower_speed = slower_speed_candidate < 1 ? 1 : slower_speed_candidate;
        set_property_logged("video-sync", "audio");
        set_property_number_logged("speed", slower_speed);

        var vf_now = get_vf();
        vf_now = upsert_fps(vf_now, fps_for_speed(slower_speed, true), slower_speed, true);
        set_vf(vf_now);

        if (speed_timer) {
            clearTimeout(speed_timer);
        }

        speed_timer = setTimeout(function () {
            gradually_restore_speed();
        }, delta_time * (baseFps / 12) * 1000);
    } else if (current_speed > 1) {
        // Audio-ON path (e.g. 4x): continuously ramp the speed down to 1x while
        // biasing by the A/V drift, so audio and video converge as we glide down.
        // keydown left the fps filter in, so start in the decimating state.
        set_property_logged("video-sync", "audio");
        ramp_decimating = true;
        ramp_down(current_speed);
    } else {
        finish_restore();
    }
}

// Continuous ramp: each drift_poll_ms, lower the base speed by drift_step toward
// 1x and add a drift offset (drift_gain*avsync, clamped). The applied speed is
// base + offset; the base monotonically decreases until it reaches 1x, then the
// final settle/restore runs once the residual drift is small.
/**
 * @param {number} base
 */
function ramp_down(base) {
    if (is_restoring_speed === false) return; // a new keydown took over

    var avsync = null;
    try { avsync = mp.get_property_number("avsync"); } catch (e) { }

    // Drift offset: avsync = audio - video, so positive drift means video is
    // behind -> speed it up to catch the audio.
    var offset = drift_gain * (avsync || 0);
    if (offset > drift_max_offset) offset = drift_max_offset;
    if (offset < -drift_max_offset) offset = -drift_max_offset;

    if (base <= 1) {
        // Endpoint: hold 1x (+offset) until the residual drift settles, then end.
        if (avsync == null || Math.abs(avsync) < drift_eps) {
            set_property_number_logged("speed", 1);
            finish_restore();
            return;
        }
        set_property_number_logged("speed", 1 + offset);
        if (speed_timer) clearTimeout(speed_timer);
        speed_timer = setTimeout(function () { ramp_down(1); }, drift_poll_ms);
        return;
    }

    set_property_number_logged("speed", base + offset);

    // Decimate frames only while fast enough for it to pay off. Below the floor
    // the fps filter starves the renderer (sparse frames -> visible wait), so we
    // drop back to the original chain ONCE for the rest of the glide.
    if (base > drift_fps_floor) {
        var vf_now = get_vf();
        vf_now = upsert_fps(vf_now, fps_for_speed(base, true), base, true);
        set_vf(vf_now);
        ramp_decimating = true;
    } else if (ramp_decimating) {
        restore_original_vf_exact();
        ramp_decimating = false;
    }

    var next_base = base - drift_step;
    if (next_base < 1) next_base = 1;

    if (speed_timer) clearTimeout(speed_timer);
    speed_timer = setTimeout(function () { ramp_down(next_base); }, drift_poll_ms);
}

// Final restore tail: re-enable audio if it was off, restore autosync + the
// exact original filter chain, and clear the restoring flag.
function finish_restore() {
    vf_restore_timer = setTimeout(function () {
        is_restoring_speed = false;
        set_property_logged("video-sync", "audio");

        vf_restore_timer = setTimeout(function () {
            var current_prop_audio = mp.get_property("audio", null);
            if (prop_audio !== current_prop_audio) {
                set_property_logged("audio", prop_audio);
            }

            vf_restore_timer = setTimeout(function () {
                set_property_logged("autosync", prop_autosync)
                restore_original_vf_exact();
            }, finish_stage_ms);

        }, finish_stage_ms);

    }, finish_stage_ms);
}

// ========= Key handling =========
/**
 * @param {string} event
 * @param {number} speed
 */
function handle_key(event, speed) {
    if (event === "down") {
        if (opt_d3d11_sync != null) {
            set_property_number_logged("d3d11-sync-interval", 1);
        }

        if (speed_timer) clearTimeout(speed_timer);
        if (vf_restore_timer) clearTimeout(vf_restore_timer);

        var prop_audio_current = mp.get_property("audio");
        if (!is_restoring_speed) {
            prop_audio = prop_audio_current;
        }

        selected_speed = speed;

        vf_at_keydown = get_vf();

        var vf_now = upsert_fps(vf_at_keydown, fps_for_speed(speed, false), speed, false);
        set_vf(vf_now);

        if (speed === fast_speed2) {
            // Too fast to pitch-correct: disable audio (avsync unavailable, so
            // the restore uses the autosync-only ramp, not drift convergence).
            set_property_logged("audio", "no");
        }

        set_property_logged("video-sync", "display-desync");
        set_property_number_logged("speed", speed);
        is_restoring_speed = false;

    } else if (event === "up") {
        is_restoring_speed = true;
        setTimeout(function () {
            gradually_restore_speed();
        }, delta_time * 4 * 1000);
    }
}

// ========= Key bindings =========
mp.add_key_binding(null, "fastforward", function (args) {
    handle_key(args.event, fast_speed);
}, { repeatable: false, complex: true });

mp.add_key_binding(null, "slowmotion", function (args) {
    handle_key(args.event, slow_speed);
}, { repeatable: false, complex: true });

mp.add_key_binding(null, "fastforward2", function (args) {
    handle_key(args.event, fast_speed2);
}, { repeatable: false, complex: true });

mp.add_key_binding(null, "slowmotion2", function (args) {
    handle_key(args.event, slow_speed2);
}, { repeatable: false, complex: true });

mp.add_key_binding(null, "fastforward2x", function (args) {
    handle_key(args.event, 2);
}, { repeatable: false, complex: true });

mp.add_key_binding(null, "slowmotion_half", function (args) {
    handle_key(args.event, 0.5);
}, { repeatable: false, complex: true });
