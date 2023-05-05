function launch_subprocess_with_args() {
    // Pause the video
    mp.set_property_bool("pause", true);

    // Get the file path of the currently playing file
    var current_file_path = mp.get_property("path");

    var timeMS = mp.get_property("time-pos") * 1000

    // Define your subprocess and arguments
    var subprocess_command = {
        args: [
            "C:/Program Files/MPC-HC/mpc-hc64.exe",
            current_file_path,
            "/start",
            timeMS.toString(),
        ]
    };
	
    dump(subprocess_command)
    
    // Launch the subprocess
    var result = mp.utils.subprocess(subprocess_command);
    
    // Uncomment the following line to show the subprocess output in the MPV console (Ctrl+`)
    // mp.msg.info(result.stdout);
}

// Bind the function to the desired hotkey (e.g., Ctrl+P)
mp.add_key_binding("Ctrl+Shift+m", "launch_subprocess", launch_subprocess_with_args);