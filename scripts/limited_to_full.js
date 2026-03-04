//@ts-check

// Toggle shader script for limited_to_full.glsl

var shader_path = "~~/shaders/limited_to_full.glsl";

function toggle_shader() {
    // Get current shader list
    var current_shaders = mp.get_property_native("glsl-shaders", []);

    // Check if shader is already in the list
    var shader_index = -1;
    for (var i = 0; i < current_shaders.length; i++) {
        if (current_shaders[i] === shader_path) {
            shader_index = i;
            break;
        }
    }

    if (shader_index >= 0) {
        // Shader is active, remove it
        mp.commandv("change-list", "glsl-shaders", "remove", shader_path);
        mp.osd_message("Limited to Full range: OFF");
    } else {
        // Shader is not active, add it
        mp.commandv("change-list", "glsl-shaders", "append", shader_path);
        mp.osd_message("Limited to Full range: ON");
    }
}

// Bind to CTRL+1
mp.add_key_binding("Ctrl+1", "toggle-limited-to-full", toggle_shader);
