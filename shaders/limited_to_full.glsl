//!HOOK LUMA
//!BIND HOOKED
//!DESC limited->full (Y, unclipped)
vec4 hook() {
    vec4 c = HOOKED_tex(HOOKED_pos);
    c.r = c.r * (255.0/219.0) - (16.0/219.0);
    return c;
}

//!HOOK CHROMA
//!BIND HOOKED
//!DESC limited->full (UV, unclipped)
vec4 hook() {
    vec4 c = HOOKED_tex(HOOKED_pos);
    const float a = (255.0/224.0);
    const float b = (128.0/255.0) - (128.0/224.0);
    c.rg = c.rg * a + b;
    return c;
}
