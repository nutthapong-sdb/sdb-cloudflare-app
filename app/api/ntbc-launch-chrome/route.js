import { exec } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Check if Chrome debugging is already active and running
        try {
            const checkRes = await fetch('http://localhost:9222/json');
            if (checkRes.ok) {
                const tabs = await checkRes.json();
                if (tabs && tabs.length > 0) {
                    console.log('Chrome is already running on port 9222. Reusing active debugging window.');
                    return Response.json({ success: true, reused: true });
                }
            }
        } catch (checkErr) {
            console.log('No Chrome instance detected on port 9222. Spawning new process...', checkErr.message);
        }

        console.log('Launching Chrome on port 9222 with custom profile in full screen...');
        // Open Google Chrome on macOS with port 9222 debugging, clean temporary profile, and full screen
        const cmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/.chrome-debug-profile" --start-fullscreen "https://dash.cloudflare.com/" > /dev/null 2>&1 &`;
        exec(cmd, (error) => {
            if (error) {
                console.error('Failed to launch Chrome:', error);
            }
        });
        return Response.json({ success: true, reused: false });
    } catch (e) {
        console.error('Launch Chrome API error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
