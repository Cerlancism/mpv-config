//!HOOK MAIN
//!BIND HOOKED
//!DESC pre-downscale for 360 (bicubic Catmull-Rom)
//!WIDTH OUTPUT.w 2 *
//!HEIGHT OUTPUT.h 2 *

vec4 hook() {
    vec2 pos = HOOKED_pos * HOOKED_size;
    vec2 i = floor(pos - 0.5) + 0.5;
    vec2 f = pos - i;

    // Catmull-Rom weights
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);

    // Merge pairs into 2 bilinear samples per axis (4 total vs 16 point samples)
    vec2 w01 = w0 + w1;
    vec2 w23 = w2 + w3;
    vec2 uv01 = (i - 1.0 + w1 / w01) / HOOKED_size;
    vec2 uv23 = (i + 1.0 + w3 / w23) / HOOKED_size;

    return (HOOKED_tex(vec2(uv01.x, uv01.y)) * w01.x +
            HOOKED_tex(vec2(uv23.x, uv01.y)) * w23.x) * w01.y +
           (HOOKED_tex(vec2(uv01.x, uv23.y)) * w01.x +
            HOOKED_tex(vec2(uv23.x, uv23.y)) * w23.x) * w23.y;
}
