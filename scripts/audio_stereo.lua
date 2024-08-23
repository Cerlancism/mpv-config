-- stereo_switch.lua

-- Function to switch audio channels to stereo
function switch_to_stereo()
    mp.set_property("audio-channels", "stereo")
end

-- Binding CTRL+A to switch audio channels
mp.add_key_binding("Ctrl+a", "switch_to_stereo", switch_to_stereo)
