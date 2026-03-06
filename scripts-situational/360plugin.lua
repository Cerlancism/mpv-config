local scale_down = false
-- local scale_down = true

local predownscale_shader = "~~/shaders/predownscale-main.glsl"
local predownscale_active = false
local fps_filter_active = false
local mpv360_active = false

local function setup()
    local w = mp.get_property_native("width") or 0
    local h = mp.get_property_native("height") or 0
    mp.msg.info(string.format("360plugin: video size = %dx%d", w, h))

    if predownscale_active then
        mp.command("no-osd change-list glsl-shaders remove " .. predownscale_shader)
        predownscale_active = false
    end

    if fps_filter_active then
        mp.command("no-osd vf remove fps=120000/1001")
        fps_filter_active = false
    end

    if h > 4000 then
        if scale_down then
            mp.msg.info("360plugin: height > 4000, scaling down via GLSL pre-pass")
            mp.command("no-osd change-list glsl-shaders append " .. predownscale_shader)
            predownscale_active = true
        end
    else
        mp.msg.info("360plugin: height within limit, adding fps=120000/1001")
        mp.command("no-osd vf append fps=120000/1001")
        fps_filter_active = true
    end

    if not mpv360_active then
        mp.msg.info("360plugin: activating mpv360")
        mp.command("script-binding mpv360/toggle")
        mpv360_active = true
    else
        mp.msg.info("360plugin: mpv360 already active")
    end
end

mp.register_event("file-loaded", setup)
