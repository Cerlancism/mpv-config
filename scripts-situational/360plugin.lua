mp.command("script-binding mpv360/toggle")

local vf = mp.get_property_native("vf") or {}
for i = #vf, 1, -1 do
    if vf[i].name == "fps" then table.remove(vf, i) end
end
table.insert(vf, 1, {name="fps", params={fps="120000/1001"}})
mp.set_property_native("vf", vf)
