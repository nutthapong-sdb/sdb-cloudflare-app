/*
 * Run full E2E suite (Auth + GDCC + API Discovery + Firewall) using existing scripts.
 * Usage:
 *   node scripts/test-all/run-all.js
 *   node scripts/test-all/run-all.js --no-server
 *   node scripts/test-all/run-all.js --only gdcc/test-report-generation.js
 *   node scripts/test-all/run-all.js --skip-firewall
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BASE_URL = 'http://localhost:8002';

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGetOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServerReady(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // /login is a static page and quick readiness signal
    // success if we can connect and get any HTTP response
    const ok = await httpGetOk(`${BASE_URL}/login`);
    if (ok) return true;
    await delay(1000);
  }
  return false;
}

function runNodeScript(scriptPath, envExtra = {}) {
  return new Promise((resolve, reject) => {
    const abs = path.resolve(scriptPath);
    const child = spawn(process.execPath, [abs], {
      stdio: 'inherit',
      env: { ...process.env, ...envExtra },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script failed (${code}): ${scriptPath}`));
    });
  });
}

function startDevServer() {
  // Use a detached process group so we can reliably terminate npm + its children.
  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env },
    detached: true,
  });
  return child;
}

async function stopProcess(child, timeoutMs = 15000) {
  if (!child) return;

  const waitForExit = () => new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    child.once('exit', finish);
    child.once('close', finish);
  });

  const exited = waitForExit();

  // Try to kill the full process group (works on macOS/Linux when detached).
  try {
    if (typeof child.pid === 'number') process.kill(-child.pid, 'SIGTERM');
  } catch (_) {
    try { child.kill('SIGTERM'); } catch (_) {}
  }

  const didExit = await Promise.race([
    exited.then(() => true),
    delay(timeoutMs).then(() => false),
  ]);

  if (!didExit) {
    try {
      if (typeof child.pid === 'number') process.kill(-child.pid, 'SIGKILL');
    } catch (_) {
      try { child.kill('SIGKILL'); } catch (_) {}
    }
    // Don't hang forever if the child refuses to die.
    await Promise.race([exited, delay(5000)]);
  }

  // Ensure the dev server doesn't keep this runner alive.
  try { child.unref(); } catch (_) {}
}

async function main() {
  const argv = process.argv.slice(2);
  const noServer = argv.includes('--no-server');

  const only = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only' && argv[i + 1]) {
      only.push(argv[i + 1]);
      i++;
    }
  }
  const skipFirewall = argv.includes('--skip-firewall');

  let serverProc = null;
  const alreadyUp = await httpGetOk(`${BASE_URL}/login`);
  if (!alreadyUp && !noServer) {
    console.log('🟦 Starting dev server (npm run dev)...');
    serverProc = startDevServer();
    const ready = await waitForServerReady(90000);
    if (!ready) {
      await stopProcess(serverProc);
      throw new Error('Server did not become ready on http://localhost:8002 within timeout');
    }
    console.log('✅ Server is ready');
  } else if (!alreadyUp && noServer) {
    throw new Error('Server is not running on http://localhost:8002 (use without --no-server to auto-start)');
  }

  let tests = [
    'scripts/test-all/auth/test-login.js',

    'scripts/test-all/gdcc/test-gdcc.js',
    'scripts/test-all/gdcc/test-manual-generation.js',
    'scripts/test-all/gdcc/test-ui-enhancements.js',
    'scripts/test-all/gdcc/test-report-generation.js',
    'scripts/test-all/gdcc/test-report-generation-separated.js',
    'scripts/test-all/gdcc/test-template-variables.js',
    'scripts/test-all/gdcc/test-total-requests.js',
    'scripts/test-all/gdcc/test-gdcc-history-backend.js',
    'scripts/test-all/gdcc/test-gdcc-history-ui.js',
    'scripts/test-all/gdcc/test-template-api.js',
    'scripts/test-all/gdcc/test-dns-specific.js',
    'scripts/test-all/gdcc/test-ntbc-cfreport-capture.js',

    'scripts/test-all/api_discovery/test-api.js',
    'scripts/test-all/api_discovery/test-api-discovery.js',
    'scripts/test-all/api_discovery/test-api-subdomain-backend.js',
    'scripts/test-all/api_discovery/test-api-subdomain-ui.js',
    'scripts/test-all/api_discovery/test-openapi-export-loop.js',

    // Firewall scripts can be permission-limited; keep them last
    'scripts/test-all/firewall/test-firewall.js',
    'scripts/test-all/firewall/test-firewall-logs.js',
  ];

  if (skipFirewall) {
    tests = tests.filter((t) => !t.includes('/firewall/'));
  }
  if (only.length > 0) {
    tests = tests.filter((t) => only.some((needle) => t.includes(needle)));
    if (tests.length === 0) {
      throw new Error(`No tests matched --only ${only.join(', ')}`);
    }
  }

  const startedAt = Date.now();
  try {
    for (const t of tests) {
      console.log(`\n=== Running: ${t} ===`);
        // Default to headless for CI-like runs, but allow overriding.
        await runNodeScript(t, { HEADLESS: process.env.HEADLESS ?? '1' });
      }
    const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n✅ ALL E2E TESTS PASSED (${dur}s)`);
  } finally {
    if (serverProc) await stopProcess(serverProc);
  }
}

main().catch((err) => {
  console.error(`\n❌ E2E RUN FAILED: ${err.message}`);
  process.exit(1);
});
