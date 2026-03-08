//!HOOK NATIVE
//!BIND HOOKED
//!DESC pre-downscale for 360
//!WIDTH HOOKED.w 2 /
//!HEIGHT HOOKED.h 2 /

vec4 hook() {
    return HOOKED_tex(HOOKED_pos);
}
