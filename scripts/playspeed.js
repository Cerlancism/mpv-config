// mpv speed control with fps merge (no 1x reordering)
// - speed > 1  => fps FIRST in chain
// - on release => restore original vf exactly as captured (or startup --vf=), else drop temp fps
// - property *wrappers* (no overrides) to log all sets

const fast_speed  = 4;
const fast_speed2 = 20;
const slow_speed  = 1 / 2;
const slow_speed2 = 1 / 20;

// ===== Debug / Trace toggles =====
const TRACE_PROPS = true; // set to false to silence property set logs

// ========= Tiny helpers =========
function toStr(v) {
  try {
    if (typeof v === "object") return JSON.stringify(v);
  } catch (_) {}
  return String(v);
}

function deepCopy(obj) {
  // vf is plain JSON-like; JSON clone is fine and fast here.
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

// ===== Property wrappers (no overrides) =====
function set_prop(name, value) {
  if (TRACE_PROPS) {
    const old = mp.get_property(name, null);
    print(`[set_property] ${name}: ${toStr(old)} -> ${toStr(value)}`);
  }
  return mp.set_property(name, value);
}

function set_prop_number(name, value) {
  if (TRACE_PROPS) {
    let old = "<?>";
    try { old = mp.get_property_number(name); } catch (_) {}
    print(`[set_property_number] ${name}: ${toStr(old)} -> ${toStr(value)}`);
  }
  return mp.set_property_number(name, value);
}

function set_prop_native(name, value) {
  if (TRACE_PROPS) {
    // Logging only new to avoid giant dumps
    print(`[set_property_native] ${name}: new=${toStr(value)}`);
  }
  return mp.set_property_native(name, value);
}

// ===== Init properties =====
const args_vf       = mp.get_property_native("vf", null);   // remember startup --vf=
const opt_d3d11_sync = mp.get_opt("d3d11_sync", null);
let   prop_audio    = mp.get_property("audio", null);

let speed_timer = null;
let vf_restore_timer = null;
let is_restoring_speed = false;

// We capture the *live* chain at key down to restore it exactly on release
let vf_at_keydown = null;

// mpv timebase from the original
const delta_time = 1 / (120000 / 1001);

print("startup vf:", toStr(args_vf));

// ========= VF helpers =========
function get_vf() {
  return mp.get_property_native("vf") || [];
}
function set_vf(vf) {
  set_prop_native("vf", vf || []);
}

// Robust find_fps: normalize name and scan array items
function normName(x) {
  if (x == null) return null;
  if (typeof x !== "string") x = String(x);
  return x.replace(/^\s+/, "").replace(/\s+$/, "");
}

function isLavfiFpsFilter(f) {
  const g = f?.params?.graph;
  return typeof g === "string" && /[=,:]\s*fps\s*=/.test(g);
}

function find_fps(vf) {
  if (!Array.isArray(vf)) return [null, null];
  for (let i = 0; i < vf.length; i++) {
    const f = vf[i];
    if (f && typeof f === "object") {
      const name = normName(f.name);
      if (name === "fps") return [i, f];
      if (name === "lavfi" && isLavfiFpsFilter(f)) return [i, f];
    }
  }
  return [null, null];
}

function remove_fps(vf) {
  vf = deepCopy(vf) || [];
  const out = [];
  for (const f of vf) {
    if (normName(f?.name) !== "fps") out.push(f);
  }
  return out;
}

// Insert/Update fps; place FIRST when speed>1, else append (keeps things simple for <=1)
function upsert_fps(vf, fps_expr, speed, slowing) {
  vf = deepCopy(vf) || [];
  let [idx, fps_filter] = find_fps(vf);

  if (fps_filter) {
    if (idx != null) vf.splice(idx, 1);        // remove from old position
    fps_filter.params = fps_filter.params || {};
    fps_filter.params.fps = fps_expr;
  } else {
    fps_filter = { name: "fps", params: { fps: fps_expr } };
  }

  if (speed > 1 || !!slowing) {
    vf.splice(0, 0, fps_filter);               // FIRST for fast-forward (or while slowing down >1)
  } else {
    vf.push(fps_filter);                        // append otherwise
  }
  return vf;
}

// Your current rule for fps value when speeding vs other:
function fps_for_speed(speed, slowing) {
  if (speed > 1 || slowing) {
    return `${60000 / speed}/1001`;
  } else {
    return `${120000 / speed}/1001`;
  }
}

// Exact restore policy on release:
// (Using current preference: restore startup args_vf)
function restore_original_vf_exact() {
  set_vf(args_vf);
  vf_at_keydown = null;
}

// ========= Gradual restore =========
function gradually_restore_speed(instant) {
  let current_speed;
  try {
    current_speed = mp.get_property_number("speed");
  } catch (_) {
    current_speed = 1;
  }

  if (instant === true) {
    // Jump speed to 1x immediately; do NOT touch vf here (we'll restore later)
    let vf_now = get_vf();
    vf_now = upsert_fps(vf_now, "30000/1001", current_speed, true);
    set_vf(vf_now);
    current_speed = 1;
    set_prop_number("speed", current_speed);
  }

  if (current_speed > 1) {
    current_speed = current_speed / 2;
    if (current_speed < 1) current_speed = 1;
    set_prop("video-sync", "display-resample");
    set_prop_number("speed", current_speed);

    // While restoring (>1), keep fps merged (first)
    let vf_now = get_vf();
    vf_now = upsert_fps(vf_now, "30000/1001", current_speed, true);
    set_vf(vf_now);

    speed_timer = mp.add_timeout(delta_time * (120 / 4), gradually_restore_speed);
  } else {
    // We’re at 1x; settle, restore sync/audio, then restore the exact original vf
    vf_restore_timer = mp.add_timeout(delta_time * (120 / 4), function () {
      restore_original_vf_exact();

      vf_restore_timer = mp.add_timeout(delta_time * (120 / 4), function () {
        is_restoring_speed = false;
        set_prop("video-sync", "display-adrop");

        const current_prop_audio = mp.get_property("audio", null);
        if (prop_audio !== current_prop_audio) {
          set_prop("audio", prop_audio);
        }

        vf_restore_timer = mp.add_timeout(delta_time * (120 / 2), function () {
          set_prop("video-sync", "audio");
        });
      });
    });
  }
}

// ========= Key handling =========
function handle_key(event, speed) {
  if (event === "down") {
    if (opt_d3d11_sync != null) {
      set_prop_number("d3d11-sync-interval", 1);
    }

    if (speed_timer) { speed_timer.kill(); speed_timer = null; }
    if (vf_restore_timer) { vf_restore_timer.kill(); vf_restore_timer = null; }

    const prop_audio_current = mp.get_property("audio");
    if (!is_restoring_speed) {
      prop_audio = prop_audio_current;
    }

    // Capture chain at key down (to restore exactly later)
    vf_at_keydown = get_vf();

    // Merge/position fps for this speed
    let vf_now = upsert_fps(vf_at_keydown, fps_for_speed(speed, false), speed, false);
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
    mp.add_timeout(delta_time * 4, function () {
      gradually_restore_speed(true);
    });
  }
}

// ========= Key bindings =========
// NOTE: In JS, pass `null` for the key to use only the name.
// The `complex:true` flag is required to receive press/release events.
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

// Avoid duplicate binding names
mp.add_key_binding(null, "slowmotion_half", function (args) {
  handle_key(args.event, 0.5);
}, { repeatable: false, complex: true });
