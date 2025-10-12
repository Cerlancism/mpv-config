// mpv speed control with fps merge (no 1x reordering)
// - speed > 1  => fps FIRST in chain
// - on release => restore original vf exactly as captured (or startup --vf=), else drop temp fps
// - property *wrappers* (no overrides) to log all sets

"use strict";

var fast_speed = 4;
var fast_speed2 = 20;
var slow_speed = 1 / 2;
var slow_speed2 = 1 / 20;

// ===== Debug / Trace toggles =====
var TRACE_PROPS = true; // set to false to silence property set logs

// ========= Tiny helpers =========
function toStr(v) {
  try {
    if (v && typeof v === "object") return JSON.stringify(v);
  } catch (e) { }
  return String(v);
}

function deepCopy(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

// ===== Property wrappers (no overrides) =====
function set_prop(name, value) {
  if (TRACE_PROPS) {
    var old = mp.get_property(name, null);
    print("[set_property] " + name + ": " + toStr(old) + " -> " + toStr(value));
  }
  return mp.set_property(name, value);
}

function set_prop_number(name, value) {
  if (TRACE_PROPS) {
    var old = "<?>";
    try { old = mp.get_property_number(name); } catch (e) { }
    print("[set_property_number] " + name + ": " + toStr(old) + " -> " + toStr(value));
  }
  return mp.set_property_number(name, value);
}

function set_prop_native(name, value) {
  if (TRACE_PROPS) {
    print("[set_property_native] " + name + ": new=" + toStr(value));
  }
  return mp.set_property_native(name, value);
}

// ===== Init properties =====
var args_vf = mp.get_property_native("vf", null);
var opt_d3d11_sync = mp.get_opt("d3d11_sync", null);
var prop_audio = mp.get_property("audio", null);

var speed_timer = null;
var vf_restore_timer = null;
var is_restoring_speed = false;
var vf_at_keydown = null;

// mpv timebase
var delta_time = 1 / (120000 / 1001);

print("startup vf:", toStr(args_vf));

// ========= VF helpers =========
function get_vf() {
  return mp.get_property_native("vf") || [];
}
function set_vf(vf) {
  set_prop_native("vf", vf || []);
}

function normName(x) {
  if (x == null) return null;
  if (typeof x !== "string") x = String(x);
  return x.replace(/^\s+/, "").replace(/\s+$/, "");
}

function isLavfiFpsFilter(f) {
  var g = f && f.params && typeof f.params.graph === "string" ? f.params.graph : null;
  return typeof g === "string" && /[=,:]\s*fps\s*=/.test(g);
}

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

function remove_fps(vf) {
  vf = deepCopy(vf) || [];
  var out = [];
  for (var i = 0; i < vf.length; i++) {
    var f = vf[i];
    if (normName(f && f.name) !== "fps") out.push(f);
  }
  return out;
}

function upsert_fps(vf, fps_expr, speed, slowing) {
  vf = deepCopy(vf) || [];
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

function fps_for_speed(speed, slowing) {
  if (speed > 1 || slowing) {
    return (60000 / speed) + "/1001";
  } else {
    return (120000 / speed) + "/1001";
  }
}

function restore_original_vf_exact() {
  set_vf(args_vf);
  vf_at_keydown = null;
}

// ========= Gradual restore =========
function gradually_restore_speed(instant) {
  var current_speed;
  try {
    current_speed = mp.get_property_number("speed");
  } catch (e) {
    current_speed = 1;
  }

  if (instant === true) {
    var vf_now0 = get_vf();
    vf_now0 = upsert_fps(vf_now0, "30000/1001", current_speed, true);
    set_vf(vf_now0);
    current_speed = 1;
    set_prop_number("speed", current_speed);
  }

  if (current_speed > 1) {
    current_speed = current_speed / 2;
    if (current_speed < 1) current_speed = 1;
    set_prop("video-sync", "display-resample");
    set_prop_number("speed", current_speed);

    var vf_now = get_vf();
    vf_now = upsert_fps(vf_now, "30000/1001", current_speed, true);
    set_vf(vf_now);

    if (speed_timer) clearTimeout(speed_timer);
    speed_timer = setTimeout(function () {
      gradually_restore_speed();
    }, delta_time * (120 / 4) * 1000);

  } else {
    if (vf_restore_timer) clearTimeout(vf_restore_timer);
    vf_restore_timer = setTimeout(function () {
      restore_original_vf_exact();

      if (vf_restore_timer) clearTimeout(vf_restore_timer);
      vf_restore_timer = setTimeout(function () {
        is_restoring_speed = false;
        set_prop("video-sync", "display-adrop");

        var current_prop_audio = mp.get_property("audio", null);
        if (prop_audio !== current_prop_audio) {
          set_prop("audio", prop_audio);
        }

        if (vf_restore_timer) clearTimeout(vf_restore_timer);
        vf_restore_timer = setTimeout(function () {
          set_prop("video-sync", "audio");
        }, delta_time * (120 / 2) * 1000);

      }, delta_time * (120 / 4) * 1000);

    }, delta_time * (120 / 4) * 1000);
  }
}

// ========= Key handling =========
function handle_key(event, speed) {
  if (event === "down") {
    if (opt_d3d11_sync != null) {
      set_prop_number("d3d11-sync-interval", 1);
    }

    if (speed_timer) clearTimeout(speed_timer);
    if (vf_restore_timer) clearTimeout(vf_restore_timer);

    var prop_audio_current = mp.get_property("audio");
    if (!is_restoring_speed) {
      prop_audio = prop_audio_current;
    }

    vf_at_keydown = get_vf();

    var vf_now = upsert_fps(vf_at_keydown, fps_for_speed(speed, false), speed, false);
    set_vf(vf_now);

    if (speed === fast_speed2) {
      set_prop("video-sync", "display-desync");
      set_prop("audio", "no");
    }

    set_prop("video-sync", "display-desync");
    set_prop_number("speed", speed);
    is_restoring_speed = false;

  } else if (event === "up") {
    is_restoring_speed = true;
    setTimeout(function () {
      gradually_restore_speed(true);
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
