var SCREEN_TARGET = 0

function launch_subprocess_with_args() {
    // Pause the video
    mp.set_property_bool("pause", true);

    // Get the file path of the currently playing file
    var current_file_path = mp.get_property("path");

    var timeMS = mp.get_property("time-pos") * 1000

    var mpc_args = [
        "C:/Program Files/MPC-HC/mpc-hc64.exe",
        current_file_path,
        "/start",
        timeMS.toString(),
    ]

    var screen = Number(mp.get_property("screen"))

    if (screen === SCREEN_TARGET) {
        mpc_args.push("/fixedsize")
        mpc_args.push("1937,1199")
        mpc_args.push("/monitor")
        mpc_args.push("1")
    }
    else {
        mpc_args.push("/fixedsize")
        mpc_args.push("1616,1019")
    }

    // Define your subprocess and arguments
    var subprocess_command = {
        args: mpc_args,
        detach: true
    };
    
    // Launch the subprocess
    var result = mp.utils.subprocess(subprocess_command);

    // dump(result)

    if (screen === SCREEN_TARGET) {
        setTimeout(function () {
            var splits = current_file_path.split("/")
            var caption = splits[splits.length - 1]
            var cmdow_args = [
                "C:/Tools/cmdow/bin/Release/cmdow.exe",
                'Media Player Classic' + "*",
                "/SIZ",
                "1937",
                "1199",
                "/MOV",
                "1940",
                "-680"
            ]

            // dump(cmdow_args)

            mp.utils.subprocess({
                args: cmdow_args
            });
        }, 100);
    }
    
    // Uncomment the following line to show the subprocess output in the MPV console (Ctrl+`)
    // mp.msg.info(result.stdout);
}

// Bind the function to the desired hotkey (e.g., Ctrl+P)
mp.add_key_binding("Ctrl+Shift+m", "launch_subprocess", launch_subprocess_with_args);