local fast_speed = 4
local fast_speed2 = 60
local slow_speed = 1 / 2
local slow_speed2 = 1 / 60

local args_vf = mp.get_property_native("vf", nil)
local opt_d3d11_sync = mp.get_opt("d3d11_sync", nil)

local speed_timer = nil
local vf_restore_timer = nil

-- if opt_d3d11_sync ~= nil then
--     print("has opt_d3d11_sync")
-- end

function gradually_restore_speed()
    local current_speed = mp.get_property_number("speed")
    if current_speed > 1 then
        current_speed = current_speed - 0.25
        print("set speed " .. current_speed)
        mp.set_property_number("speed", current_speed)
        speed_timer = mp.add_timeout(1 / 120, gradually_restore_speed)
    else
        -- When normal speed is reached, restore the saved video filter
        vf_restore_timer = mp.add_timeout(1 / 120, function()
            if args_vf ~= nil then
                print("set vf")
                mp.set_property_native("vf", args_vf)
            end
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
            mp.set_property_native("vf", { { name = "fps", params = { fps = "30000/1001" } } })
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
        print("set speed " .. speed)
        mp.set_property_number("speed", speed)
    elseif event == "up" then
        -- Gradually restore the speed to normal
        gradually_restore_speed()
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
