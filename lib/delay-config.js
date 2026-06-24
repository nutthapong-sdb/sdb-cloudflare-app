// lib/delay-config.js

// Shared delay configuration across actual generation and control panel to keep testing and production aligned.

export const DELAY_CONFIG = {
    // Delay after successful navigation to allow initial rendering to stabilize
    NAV_STABILIZE_MS: 500,

    // Fast-polling interval used during speed test waiting
    SPEED_TEST_POLL_MS: 3000,
    
    // Max attempts for speed test polling (e.g. 20 attempts * 3000ms = 60000ms)
    SPEED_TEST_MAX_ATTEMPTS: 20,

    // Short delay used inside checking loops if an element isn't found right away
    SHORT_RETRY_MS: 100,
};
