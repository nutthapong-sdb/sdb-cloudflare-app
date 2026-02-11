// Helper functions for test scripts
// Use this in all test scripts to ensure consistency

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.local') });

// Get API Token from environment
function getApiToken() {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
        console.error('❌ Error: CLOUDFLARE_API_TOKEN not found in .env.local');
        console.error('   Please add: CLOUDFLARE_API_TOKEN=your_token');
        process.exit(1);
    }
    return token;
}

// Terminal colors
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Colored logging
function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

module.exports = {
    getApiToken,
    colors,
    log
};
