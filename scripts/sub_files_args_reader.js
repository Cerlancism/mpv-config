// sub_files_args_reader.js (mujs-compatible)
// Reads: --script-opts=sub_files_args_reader-sub-files=<HEX>
// Decodes HEX (UTF-8) → path → attaches as subtitles.

function hexToBytes(hex) {
    if (!hex) return [];
    hex = String(hex).replace(/\s+/g, "");
    if (hex.length % 2) {
        mp.msg.warn("HEX length is odd; padding with leading 0");
        hex = "0" + hex;
    }
    var len = hex.length / 2;
    var out = new Array(len);
    for (var i = 0; i < len; i++) {
        // Use substring(start, end) instead of substr
        var v = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        if (isNaN(v)) {
            mp.msg.warn("Invalid HEX at index " + i + "; substituting 0x3F");
            v = 0x3F; // '?'
        }
        out[i] = v;
    }
    return out;
}

function utf8BytesToString(bytes) {
    var out = "", i = 0, len = bytes.length;
    while (i < len) {
        var c = bytes[i++];
        if (c < 0x80) {
            out += String.fromCharCode(c);
        } else if ((c & 0xE0) === 0xC0) {
            var c2 = i < len ? bytes[i++] : 0;
            out += String.fromCharCode(((c & 0x1F) << 6) | (c2 & 0x3F));
        } else if ((c & 0xF0) === 0xE0) {
            var c2 = i < len ? bytes[i++] : 0;
            var c3 = i < len ? bytes[i++] : 0;
            out += String.fromCharCode(((c & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F));
        } else {
            // 4-byte sequence → surrogate pair
            var c2 = i < len ? bytes[i++] : 0;
            var c3 = i < len ? bytes[i++] : 0;
            var c4 = i < len ? bytes[i++] : 0;
            var code = ((c & 0x07) << 18) | ((c2 & 0x3F) << 12) | ((c3 & 0x3F) << 6) | (c4 & 0x3F);
            code -= 0x10000;
            out += String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
        }
    }
    return out;
}

function applySubFromOpt() {
    // Option name must match the --script-opts prefix/key
    var hex = mp.get_opt("sub_files_args_reader-sub-files");
    mp.msg.info("hex: " + (hex || "(none)"));
    if (!hex) return;

    var path = utf8BytesToString(hexToBytes(hex));
    if (!path) {
        mp.msg.warn("Decoded subtitle path is empty");
        return;
    }

    mp.msg.info("Adding subtitle from HEX: " + path);

    // Prefer sub-add so it’s an external track AND select it
    var added = true;
    try {
        // 'select' forces the just-added subtitle to become active
        mp.commandv("sub-add", path, "select");
    } catch (e) {
        added = false;
        mp.msg.warn("sub-add failed, fallback to set_property(sub-files): " + e);
    }

    if (!added) {
        try {
            // Set the property, then encourage mpv to choose it
            mp.set_property("sub-files", path);
            // Let mpv (re)select an appropriate subtitle (often the just-set one)
            mp.set_property("sid", "auto");
        } catch (e2) {
            mp.msg.error("Failed to set sub-files / sid: " + e2);
        }
    }
}

mp.add_hook("on_load", 50, applySubFromOpt);
