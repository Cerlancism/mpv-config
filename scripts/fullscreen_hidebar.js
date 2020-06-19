//@ts-check

mp.observe_property("fullscreen", "bool", function (_, value)
{
    mp.commandv("script-message", "osc-visibility", value ? "auto" : "always");
});
