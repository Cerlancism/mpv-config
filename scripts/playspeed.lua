local fast_speed = 4
local fast_speed2 = 60
local slow_speed = 1 / 2
local slow_speed2 = 1 / 60

local args_vf = mp.get_property_native("vf", nil)
local opt_d3d11_sync = mp.get_opt("d3d11_sync", nil)
local prop_audio = mp.get_property("audio", nil)

local speed_timer = nil
local vf_restore_timer = nil
local is_restoring_speed = false

-- if opt_d3d11_sync ~= nil then
--     print("has opt_d3d11_sync")
-- end

local delta_time = 1 / (120000 / 1001)

function gradually_restore_speed()
    local current_speed = mp.get_property_number("speed")
    if current_speed > 1 then
        current_speed = current_speed / 2
        mp.set_property_native("vf", { { name = "fps", params = { fps = tostring(120000 / current_speed) .. "/1001" } } })
        current_speed = (current_speed < 1) and 1 or current_speed 
        print("set speed " .. current_speed)
        mp.set_property_number("speed", current_speed)
        speed_timer = mp.add_timeout(delta_time * 4, gradually_restore_speed)
    else
        vf_restore_timer = mp.add_timeout(delta_time * 4, function()
            if prop_audio ~= nil then
                mp.set_property("audio", prop_audio)
                is_restoring_speed = false
            end 
            vf_restore_timer = mp.add_timeout(delta_time * 4, function() 
                if args_vf ~= nil then
                    print("set vf")
                    mp.set_property_native("vf", args_vf)
                    mp.set_property("video-sync", "audio")
                end
            end)
        end)
    end
end

function handle_key(event, speed)
    if event == "down" then
        -- Save the current video filters and clear them
        if opt_d3d11_sync ~= nil then
            print("defaut d3d11-sync-interval")
            mp.set_property_number("d3d11-sync-interval", 1)
        end
        if args_vf ~= nil then
            -- print("default vf")
            -- mp.set_property_native("vf", {})
            print("fps reduction vf")
            if speed == fast_speed then
                mp.set_property_native("vf", { { name = "fps", params = { fps = "30000/1001" } } })
            else
                mp.set_property_native("vf", { { name = "fps", params = { fps = tostring(120000 / speed) .. "/1001" } } })
            end
        end
        -- Cancel any existing timers
        if speed_timer ~= nil then
            speed_timer:kill()
            speed_timer = nil
        end
        if vf_restore_timer ~= nil then
            vf_restore_timer:kill()
            vf_restore_timer = nil
        end

        local prop_audio_current = mp.get_property("audio")
        if not is_restoring_speed then
            print("set prop_audio " .. prop_audio_current)
            prop_audio = prop_audio_current
        end

        if prop_audio ~= nil then
            print("set audio " .. prop_audio)
            mp.set_property("audio", prop_audio)
        end

        if speed == fast_speed2 then
           mp.set_property("audio", "no")
        end
        print("set speed " .. speed)
        mp.set_property_number("speed", speed)
        is_restoring_speed = false
    elseif event == "up" then
        is_restoring_speed = true
        mp.set_property("audio", "no")
        mp.set_property("video-sync", "display-tempo")
        -- Gradually restore the speed to normal
        mp.add_timeout(delta_time * 4, gradually_restore_speed)
    end
end

mp.add_key_binding("KP6", "fastforward", function(args)
    handle_key(args.event, fast_speed)
end, {repeatable = false, complex = true})

mp.add_key_binding("KP4", "slowmotion", function(args)
    handle_key(args.event, slow_speed)
end, {repeatable = false, complex = true})

mp.add_key_binding("KP9", "fastforward2", function(args)
    handle_key(args.event, fast_speed2)
end, {repeatable = false, complex = true})

mp.add_key_binding("KP7", "slowmotion2", function(args)
    handle_key(args.event, slow_speed2)
end, {repeatable = false, complex = true})

mp.add_key_binding("KP3", "fastforward2x", function(args)
    handle_key(args.event, 2)
end, {repeatable = false, complex = true})

mp.add_key_binding("KP1", "slowmotion2x", function(args)
    handle_key(args.event, 0.5)
end, {repeatable = false, complex = true})
