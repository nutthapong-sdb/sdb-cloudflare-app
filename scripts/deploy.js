// scripts/deploy.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: ['.env.local', '.env'] });

const webhookUrl = process.env.PORTAINER_WEBHOOK_URL;

if (!webhookUrl) {
    console.error('❌ Error: PORTAINER_WEBHOOK_URL is not defined in .env.local or .env');
    console.log('Please add PORTAINER_WEBHOOK_URL to your .env.local file:');
    console.log('PORTAINER_WEBHOOK_URL=http://<YOUR_SERVER_IP>:<PORT>/api/stacks/webhooks/<TOKEN>');
    process.exit(1);
}

console.log('🚀 Triggering Portainer Stack deployment...');

// Using fetch (Next.js environment has global fetch in modern Node.js v18+)
fetch(webhookUrl, { method: 'POST' })
    .then(res => {
        if (res.ok) {
            console.log('✅ Deployment trigger sent successfully!');
            console.log('Portainer is now pulling the latest code from Git, rebuilding images, and recreating containers.');
            process.exit(0);
        } else {
            console.error(`❌ Failed to trigger deployment. Portainer returned: ${res.status} ${res.statusText}`);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('❌ Network error when triggering deployment:', err.message);
        process.exit(1);
    });
