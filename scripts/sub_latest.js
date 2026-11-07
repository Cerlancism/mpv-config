// sub_latest.js (mujs-compatible)
// Scans the video's directory for subtitles named "<basename>.*.<sub-ext>",
// prefers .ass/.ssa then filename descending, loads all of them as external
// tracks, and selects the first.

var utils = mp.utils;

var SUB_EXTS = {
    srt: true, ass: true, ssa: true, vtt: true, sub: true, sup: true, smi: true, lrc: true
};

// Preferred formats: any match with these extensions beats all other matches.
var ASS_EXTS = { ass: true, ssa: true };

function get_ext(name) {
    var i = name.lastIndexOf(".");
    return i < 0 ? "" : name.substring(i + 1).toLowerCase();
}

function strip_ext(name) {
    var i = name.lastIndexOf(".");
    return i < 0 ? name : name.substring(0, i);
}

// Compare by file name only: mpv may record the same file under a different
// spelling of the directory (e.g. a UNC path missing one leading backslash).
function is_already_loaded(file_name) {
    var want = file_name.toLowerCase();
    var tracks = mp.get_property_native("track-list", []);
    for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        if (t.type === "sub" && t.external && t["external-filename"] &&
            utils.split_path(t["external-filename"])[1].toLowerCase() === want) {
            return t.id;
        }
    }
    return null;
}

// True when the user explicitly asked for specific (or no) subtitles.
// Reads the "options/" values, not the live properties: at file-loaded the
// live "sid" is the chosen track id, which says nothing about user intent.
function has_explicit_sub_args() {
    if (mp.get_opt("sub_files_args_reader-sub-files")) return "sub_files_args_reader";
    var files = mp.get_property_native("options/sub-files", []);
    if (files && files.length > 0) return "--sub-files";
    var sid = mp.get_property("options/sid", "auto");
    if (sid !== "auto") return "--sid=" + sid;
    if (mp.get_property("options/sub-auto", "") === "no") return "--sub-auto=no";
    return null;
}

var preferred_name = null;

// readdir with verbose logging of the directory, entry count and duration.
function timed_readdir(dir) {
    var t0 = mp.get_time_ms();
    var entries = utils.readdir(dir, "all");
    var ms = (mp.get_time_ms() - t0).toFixed(1);
    if (entries) {
        mp.msg.verbose("readdir " + dir + ": " + entries.length + " entries in " + ms + " ms");
    } else {
        mp.msg.verbose("readdir " + dir + ": failed after " + ms + " ms");
    }
    return entries;
}

function load_latest_sub() {
    preferred_name = null;
    var explicit = has_explicit_sub_args();
    if (explicit) {
        mp.msg.verbose("skipped: explicit subtitle args (" + explicit + ")");
        return;
    }

    var path = mp.get_property("path", "");
    if (!path || /^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return; // skip URLs

    var split = utils.split_path(path);
    var dir = split[0];
    var file = split[1];
    var base = strip_ext(file);
    var prefix = (base + ".").toLowerCase();

    // "all", not "files": the "files" filter stats every entry, which is one
    // network round trip per file on SMB shares (~200ms for ~150 files vs
    // <1ms). The name/extension filter below already excludes directories.
    var entries = timed_readdir(dir);
    if (!entries) {
        // Launched from MSYS/Git Bash, mpv may resolve relative paths against
        // an MSYS-style cwd that Windows can't list:
        //   "\<letter>\..." -> "<LETTER>:\..."  (drive mount)
        //   "\<host>\..."   -> "\\<host>\..."   (UNC, one slash lost)
        var candidates = [];
        var m = /^[\\\/]([a-z])([\\\/].*)?$/i.exec(dir);
        if (m) candidates.push(m[1].toUpperCase() + ":" + (m[2] || "\\"));
        if (/^[\\\/][^\\\/]/.test(dir)) candidates.push("\\" + dir);
        for (var c = 0; c < candidates.length && !entries; c++) {
            entries = timed_readdir(candidates[c]);
            if (entries) dir = candidates[c];
        }
    }
    if (!entries) {
        mp.msg.warn("cannot list directory: " + dir + " (path: " + path + ")");
        return;
    }

    var matches = [];
    for (var i = 0; i < entries.length; i++) {
        var name = entries[i];
        if (name.toLowerCase().indexOf(prefix) !== 0) continue;
        if (!SUB_EXTS[get_ext(name)]) continue;
        matches.push(name);
    }
    if (matches.length === 0) return;

    // ASS/SSA first, then by filename descending within each group.
    matches.sort(function (a, b) {
        var ra = ASS_EXTS[get_ext(a)] ? 0 : 1;
        var rb = ASS_EXTS[get_ext(b)] ? 0 : 1;
        if (ra !== rb) return ra - rb;
        a = a.toLowerCase();
        b = b.toLowerCase();
        return a < b ? 1 : a > b ? -1 : 0;
    });

    mp.msg.info("latest of " + matches.length + " subtitle(s): " + matches[0]);
    for (var v = 0; v < matches.length; v++) {
        mp.msg.verbose("  match " + (v + 1) + ": " + matches[v]);
    }

    // Hand every match to mpv in one go (file-local, so it resets for the next
    // file). Autoload is turned off for this file so the exact-name sub isn't
    // loaded twice under a different spelling of the directory.
    var full = [];
    for (var k = 0; k < matches.length; k++) full.push(utils.join_path(dir, matches[k]));
    mp.set_property_native("file-local-options/sub-files", full);
    mp.set_property("file-local-options/sub-auto", "no");
    preferred_name = matches[0];
}

// After loading, force-select the preferred track (mpv's own default track
// selection may favour another one, e.g. by language).
function select_preferred() {
    if (!preferred_name) return;
    var id = is_already_loaded(preferred_name);
    preferred_name = null;
    if (id !== null && mp.get_property_number("sid", -1) !== id) {
        mp.set_property_number("sid", id);
    }
}

mp.add_hook("on_load", 50, load_latest_sub);
mp.register_event("file-loaded", select_preferred);
