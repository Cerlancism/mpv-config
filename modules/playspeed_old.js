//@ts-check

var fast_speed = 4
var fast_speed2 = 60
var slow_speed = 1 / 2
var slow_speed2 = 1 / 60

function handle_key(event, speed)
{
    if (event === "down")
    {
        //@ts-ignore
        mp.set_property_number("speed", speed)
    }
    else if (event === "up")
    {
        //@ts-ignore
        mp.set_property_number("speed", 1)
    }
}

//@ts-ignore
mp.add_key_binding("KP6", "fastforward", function (args)
{
    handle_key(args.event, fast_speed)
}, { repeatable: false, complex: true })

//@ts-ignore
mp.add_key_binding("KP4", "slowmotion", function (args)
{
    handle_key(args.event, slow_speed)
}, { repeatable: false, complex: true })

//@ts-ignore
mp.add_key_binding("KP9", "fastforward2", function (args)
{
    handle_key(args.event, fast_speed2)
}, { repeatable: false, complex: true })

//@ts-ignore
mp.add_key_binding("KP7", "slowmotion2", function (args)
{
    handle_key(args.event, slow_speed2)
}, { repeatable: false, complex: true })

//@ts-ignore
mp.add_key_binding("KP3", "fastforward2x", function (args)
{
    handle_key(args.event, 2)
}, { repeatable: false, complex: true })

//@ts-ignore
mp.add_key_binding("KP1", "slowmotion2x", function (args)
{
    handle_key(args.event, 0.5)
}, { repeatable: false, complex: true })

