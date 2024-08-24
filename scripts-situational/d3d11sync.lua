local sync_interval_restore = nil
local vf_restore_timer = nil

local target_fps = {30, 60}
local fps_tolerance = 1

local estimate_fps_timer = mp.add_timeout(3, function()
    local current_sync = mp.get_property_number("d3d11-sync-interval", nil)
    if current_sync == nil then
        print("estimate_fps_timer reached")
        mp.unobserve_property(start)
    end
end)

function start()
    local estimated_fps = mp.get_property_number("estimated-vf-fps", 0)

    local sync_interval = nil

    if math.abs(estimated_fps - target_fps[1]) <= fps_tolerance then
        sync_interval = 4
    elseif math.abs(estimated_fps - target_fps[2]) <= fps_tolerance then
        sync_interval = 2
    end

    if sync_interval ~= nil then
        print("sync_interval " .. sync_interval)
        mp.unobserve_property(start)
        mp.set_property_number("d3d11-sync-interval", sync_interval)
        mp.osd_message("FPS: " .. estimated_fps .. " | d3d11-sync-interval set to: " .. sync_interval)
    end
end

function check()
    mp.observe_property("estimated-vf-fps", "string", start)
end

mp.register_event("file-loaded", check)

-- New hooks for seek event
mp.register_event("seek", function()
    -- Save the current video filters and clear them
    if vf_restore_timer ~= nil then
        vf_restore_timer:kill()
        vf_restore_timer = nil
    end

    if saved_vf == nil then
        saved_vf = mp.get_property_native("vf")
        mp.set_property_native("vf", {})
    end

    if sync_interval_restore == nil then
        sync_interval_restore = mp.get_property_number("d3d11-sync-interval", 1)
        mp.set_property_number("d3d11-sync-interval", 1)
    end
end)



mp.register_event("playback-restart", function()

    -- Cancel any existing debounce timer
    if vf_restore_timer ~= nil then
        vf_restore_timer:kill()
        vf_restore_timer = nil
    end

    -- Set a debounce timer of 100ms before re-enabling the video filters
    vf_restore_timer = mp.add_timeout(0.3, function()
        if saved_vf ~= nil then
            mp.set_property_native("vf", saved_vf)
            saved_vf = nil
        end
        if sync_interval_restore ~= nil then
            mp.set_property_number("d3d11-sync-interval", sync_interval_restore)
            sync_interval_restore = nil
        end
    end)
end)
