// ===== Debug / Trace toggles =====
var TRACE_PROPS = true; // set to false to silence property set logs

// ========= Tiny helpers =========

// ===== Property wrappers (no overrides) =====




module.exports = {
    to_string: function (v) {
        try {
            if (v && typeof v === "object") return JSON.stringify(v);
        } catch (e) { }
        return String(v);
    },
    deep_copy: function (obj) {
        return obj == null ? obj : JSON.parse(JSON.stringify(obj));
    },
    set_property_logged: function (name, value) {
        if (TRACE_PROPS) {
            var old = mp.get_property(name, null);
            print("[set_property] " + name + ": " + to_string(old) + " -> " + to_string(value));
        }
        return mp.set_property(name, value);
    },
    set_property_number_logged: function (name, value) {
        if (TRACE_PROPS) {
            var old = "<?>";
            try { old = mp.get_property_number(name); } catch (e) { }
            print("[set_property_number] " + name + ": " + to_string(old) + " -> " + to_string(value));
        }
        return mp.set_property_number(name, value);
    },
    set_property_native_logged: function (name, value) {
        if (TRACE_PROPS) {
            print("[set_property_native] " + name + ": new=" + to_string(value));
        }
        return mp.set_property_native(name, value);
    }
}
