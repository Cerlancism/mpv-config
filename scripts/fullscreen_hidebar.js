//@ts-check

var first = true;

mp.observe_property("fullscreen", "bool", function (_, value)
{
    if (first)
    {
        first = false
        return
    }

    mp.commandv("script-message", "osc-visibility", value ? "auto" : "always");
});
