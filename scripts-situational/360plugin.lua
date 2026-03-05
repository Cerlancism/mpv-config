local scale_down = false
-- local scale_down = true

local function setup()
    local w = mp.get_property_native("width") or 0
    local h = mp.get_property_native("height") or 0
    mp.msg.info(string.format("360plugin: video size = %dx%d", w, h))

    if h > 4000 and scale_down then
        mp.msg.info("360plugin: height > 4000, scaling down")
        mp.set_property("lavfi-complex", "[vid1]scale=iw/2.5:ih/2.5[vo]")
    else
        mp.msg.info("360plugin: height within limit, adding fps=120000/1001")
        mp.set_property("vf", "fps=120000/1001")
    end

    mp.msg.info("360plugin: activating mpv360")
    mp.command("script-binding mpv360/toggle")
end

if mp.get_property_native("video-params") then
    setup()
else
    mp.register_event("file-loaded", setup)
end
