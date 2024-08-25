local sync_interval_restore = nil
local vf_restore_timer = nil

local target_fps = {30, 60}
local fps_tolerance = 1

local args_vf = mp.get_property_native("vf", nil)

local computed_sync_interval = nil

local seeking = false

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
        computed_sync_interval = sync_interval
        mp.set_property_number("computed_sync_interval", computed_sync_interval)
        print("sync_interval " .. sync_interval)
        mp.unobserve_property(start)
        mp.set_property_number("d3d11-sync-interval", sync_interval)
        mp.osd_message("FPS: " .. estimated_fps .. " | d3d11-sync-interval set to: " .. sync_interval, 5)
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

    if seeking then
        return
    end

    seeking = true

    if args_vf ~= nil then
        print("default vf")
        mp.set_property_native("vf", {})
    end

    if computed_sync_interval ~= nil then
        print("default d3d11-sync-interval")
        mp.set_property_number("d3d11-sync-interval", 1)
    end
end)

mp.register_event("playback-restart", function()

    -- Cancel any existing debounce timer
    if vf_restore_timer ~= nil then
        vf_restore_timer:kill()
        vf_restore_timer = nil
    end

    -- Set a debounce timer before re-enabling the video filters
    vf_restore_timer = mp.add_timeout(1.0 / 30 * 10, function()
        seeking = false
        local current_speed = mp.get_property_number("speed")

        if current_speed > 1 then
            print("skip vf_restore_timer because current_speed is " .. current_speed)
            return
        end

        if computed_sync_interval ~= nil then
            print("set d3d11-sync-interval " .. computed_sync_interval)
            mp.set_property_number("d3d11-sync-interval", computed_sync_interval)
        end

        if args_vf ~= nil then
            print("set vf")
            mp.set_property_native("vf", args_vf)
        end
    end)
end)

mp.observe_property("speed", "number", function(name, value)
    if value ~= 1 then
        return
    end
    print("observe_property " .. name .. " " .. value)
    if computed_sync_interval ~= nil then
        print("set d3d11-sync-interval " .. computed_sync_interval)
        mp.set_property_number("observe_property d3d11-sync-interval", computed_sync_interval)
    end
end)
