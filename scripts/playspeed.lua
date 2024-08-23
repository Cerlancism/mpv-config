local fast_speed = 4
local fast_speed2 = 60
local slow_speed = 1 / 2
local slow_speed2 = 1 / 60

local saved_vf = nil
local speed_timer = nil
local vf_restore_timer = nil

function gradually_restore_speed()
    local current_speed = mp.get_property_number("speed")
    if current_speed > 1 then
        current_speed = current_speed / 2
        mp.set_property_number("speed", current_speed)
        speed_timer = mp.add_timeout(1 / 60, gradually_restore_speed)
    else
        -- When normal speed is reached, restore the saved video filters after 1 second
        vf_restore_timer = mp.add_timeout(1 / 60, function()
            if saved_vf ~= nil then
                mp.set_property_native("vf", saved_vf)
                saved_vf = nil
            end
        end)
    end
end

function handle_key(event, speed)
    if event == "down" then
        -- Save the current video filters and clear them
        if saved_vf == nil then
            saved_vf = mp.get_property_native("vf")
            mp.set_property_native("vf", {})
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
