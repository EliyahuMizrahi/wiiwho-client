package club.wiiwho;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ModidTest {

    @Test
    void modidIsWiiwho() {
        assertEquals("wiiwho", Wiiwho.MODID,
            "MOD-03: MODID must be the generic, non-feature-descriptive 'wiiwho'");
    }

    @Test
    void displayNameIsWiiwho() {
        // Display name convention: only first letter capitalized (user-locked 2026-04-20).
        // "WiiWho" (two capital Ws) is forbidden anywhere user-visible.
        assertEquals("Wiiwho", Wiiwho.NAME,
            "Display name must be 'Wiiwho' (only first W capitalized)");
    }
}
