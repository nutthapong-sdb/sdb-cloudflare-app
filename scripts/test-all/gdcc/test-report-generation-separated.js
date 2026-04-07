/**
 * Test: GDCC - Batch Report Generation (Separated Export)
 * 1. Navigate to GDCC
 * 2. Select Account → Zone → Subdomain
 * 3. Generate Dashboard
 * 4. Open "Create Report" modal
 * 5. Select 2 hosts
 * 6. Click "Export as separated files"
 * 7. Verify a .zip file is downloaded and contains .doc files
 */

const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');
const { setupBrowser, setupPage, login, log, colors, TMP_DOWNLOAD_DIR } = require('../libs/ui-helper');
const { navigateToGDCC, selectGDCCFilters, clickGenerateDashboard, GDCC_TEST_CONFIG } = require('../libs/gdcc-helper');

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDownloadZip(minMtimeMs, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const files = fs.readdirSync(TMP_DOWNLOAD_DIR);
    const found = files.find((f) => {
      if (!f.endsWith('.zip')) return false;
      if (f.endsWith('.crdownload')) return false;
      const p = path.join(TMP_DOWNLOAD_DIR, f);
      return fs.statSync(p).mtimeMs >= minMtimeMs;
    });
    if (found) return path.join(TMP_DOWNLOAD_DIR, found);
    await delay(1000);
  }
  return null;
}

(async () => {
  log('🚀 Starting Test: GDCC Separated Export (.zip)...', colors.cyan);
  const browser = await setupBrowser();
  try {
    const page = await setupPage(browser);
    await login(page);
    await navigateToGDCC(page);

    log('\n🔹 Step 1: Selecting Account/Zone/Subdomain...', colors.blue);
    await selectGDCCFilters(page, GDCC_TEST_CONFIG);

    log('\n🔹 Step 2: Generating Dashboard Data...', colors.blue);
    await clickGenerateDashboard(page);

  // Open Create Report modal
    await delay(1000);
    const opened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => (b.textContent || '').trim() === 'Create Report');
      if (!btn || btn.disabled) return false;
      btn.click();
      return true;
    });
    if (!opened) throw new Error('"Create Report" button not found or disabled');
    log('📋 Batch Report modal opened.', colors.blue);
    await delay(1500);

    // Ensure we are in Standard selection mode (department mode disables host checkboxes)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const standardBtn = btns.find((b) => (b.textContent || '').trim() === 'Standard');
      if (standardBtn) standardBtn.click();
    });
    await delay(500);

    // Wait for the host selection list to render
    await page.waitForSelector('input[placeholder="Filter sub-domains..."]', { visible: true, timeout: 15000 });

    // Select up to 2 subdomains from the modal host list (skip "No Subdomain")
    // Click a visible element inside the label (input is `hidden` in Tailwind).
    const picked = await page.evaluate(() => {
      const list = document.querySelector('div.flex-1.overflow-y-auto.pr-2.space-y-2.custom-scrollbar');
      if (!list) return [];

      const hostLabels = Array.from(list.querySelectorAll('label'))
        .filter((l) => {
          const inp = l.querySelector('input[type="checkbox"].hidden');
          return inp && !inp.disabled;
        });

      const candidates = hostLabels
        .map((label) => {
          const span = label.querySelector('span');
          const txt = (span ? span.textContent : label.textContent || '').trim();
          return { label, txt };
        })
        .filter((x) => x.txt && !x.txt.startsWith('No Subdomain'));

      const chosen = candidates.slice(0, 2);
      chosen.forEach((c) => {
        // Click the underlying checkbox input directly; the visible check UI is a div and the input is hidden.
        const inp = c.label.querySelector('input[type="checkbox"].hidden');
        if (inp) {
          inp.click();
          return;
        }
        c.label.click();
      });
      return chosen.map((c) => c.txt);
    });

    if (!picked || picked.length < 1) {
      throw new Error('Could not select any subdomain checkboxes in modal');
    }
    log(`☑️ Selected hosts: ${picked.join(', ')}`, colors.gray);
    await delay(800);

    // Wait until the export button becomes enabled (React state update)
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => (b.textContent || '').trim() === 'Export as separated files');
      return target && !target.disabled;
    }, { timeout: 30000 });

    // Click Export as separated files
    const exportClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => (b.textContent || '').trim() === 'Export as separated files');
      if (!target || target.disabled) return false;
      target.click();
      return true;
    });
    if (!exportClicked) throw new Error('Export as separated files button not found/disabled');
    log('⏳ Separated export started...', colors.blue);

    // Wait for zip download
    const startTime = Date.now();
    const zipPath = await waitForDownloadZip(startTime, 180000);
    if (!zipPath) throw new Error('Timeout: No .zip file downloaded');
    const zipSize = fs.statSync(zipPath).size;
    log(`✅ Downloaded: ${path.basename(zipPath)} (${zipSize.toLocaleString()} bytes)`, colors.green);

    // Verify zip contains .doc files
    const zipBuf = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipBuf);
    const names = Object.keys(zip.files);
    const docNames = names.filter((n) => n.endsWith('.doc'));
    if (docNames.length === 0) {
      throw new Error(`Zip does not contain any .doc files. Entries: ${names.slice(0, 10).join(', ')}`);
    }
    log(`📦 Zip contains ${docNames.length} .doc file(s)`, colors.green);

    // Cleanup
    try { fs.unlinkSync(zipPath); } catch (_) {}

    log('\n✅ GDCC Separated Export Test PASSED!', colors.green);
  } catch (error) {
    log(`❌ Test FAILED: ${error.message}`, colors.red);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
