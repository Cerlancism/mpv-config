local sync_interval_restore = nil

function start()
    local metadata_fps = mp.get_property_number("estimated-vf-fps", 0)
    mp.osd_message("FPS: " .. metadata_fps, 1)
    -- mp.unobserve_property(start)
    -- -- Get the current value of d3d11-sync-interval
    -- local initial_sync_interval = mp.get_property_number("d3d11-sync-interval", 0)
    
    -- -- Only proceed if the initial sync interval is set to 2
    -- if initial_sync_interval == 1 then
    --     -- Assume monitor refresh rate is 120Hz
    --     local monitor_refresh_rate = 120
        
    --     -- Get the current playback FPS

    --     -- Fallback to a default FPS if metadata is unavailable or invalid
    --     if metadata_fps == nil or metadata_fps <= 0 then
    --         mp.msg.warn("Unable to retrieve valid FPS from metadata. Using default value of 30 FPS.")
    --         metadata_fps = 60
    --     end

        
    --     -- Determine the sync interval based on playback FPS
    --     local sync_interval = 1
        
    --     if metadata_fps > 0 then
    --         local interval = math.floor(monitor_refresh_rate / metadata_fps + 0.5)
    --         sync_interval = math.max(1, interval)
    --     end
        
    --     -- Set d3d11-sync-interval accordingly
    --     mp.set_property_number("d3d11-sync-interval", sync_interval)
    --     mp.osd_message("FPS: " .. metadata_fps .. " | d3d11-sync-interval set to: " .. sync_interval, 5)
    -- end
end

function check()
    mp.observe_property("estimated-vf-fps", "string", start)
end

mp.register_event("file-loaded", check)



local playback_restart_count = 0

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
            playback_restart_count = playback_restart_count + 1
            mp.set_property_native("vf", saved_vf)
            -- mp.osd_message("Playback Restart: " .. playback_restart_count)
            saved_vf = nil
        end
        if sync_interval_restore ~= nil then
            mp.set_property_number("d3d11-sync-interval", sync_interval_restore)
            sync_interval_restore = nil
        end
    end)
end)
