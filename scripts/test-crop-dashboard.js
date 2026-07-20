const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: ['.env.local', '.env'] });

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const publicDir = path.join(__dirname, '../public');

async function setupBrowser() {
    try {
        const dns = require('dns');
        const axios = require('axios');
        let host = 'chrome-browser';
        host = await new Promise((resolve, reject) => {
            dns.lookup(host, (err, address) => err ? reject(err) : resolve(address));
        });
        const res = await axios.get(`http://${host}:9222/json/version`, { headers: { 'Host': 'localhost' } });
        const wsUrlObj = new URL(res.data.webSocketDebuggerUrl);
        const wsUrl = `ws://${host}:9222${wsUrlObj.pathname}${wsUrlObj.search}`;
        console.log(`Connected to remote Chrome (${host}:9222)`);
        return await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    } catch (e) {
        console.log(`Remote Chrome connection failed, launching local browser...`);
        return await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: null
        });
    }
}

async function selectGDCCDropdown(page, labelText, searchText) {
    console.log(`Selecting Dropdown [${labelText}] -> "${searchText}"...`);
    
    // Find the dropdown wrapper by label text
    const dropdownRoot = await page.evaluateHandle((label) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const targetLabel = labels.find(l => (l.textContent || '').toLowerCase().includes(label.toLowerCase()));
        if (!targetLabel) return null;
        
        // Find parent wrapper containing tabindex="0" div
        let parent = targetLabel.parentElement;
        while (parent) {
            if (parent.querySelector('div[tabindex="0"]')) {
                return parent;
            }
            parent = parent.parentElement;
        }
        return targetLabel.closest('div');
    }, labelText);

    if (!dropdownRoot || !(await dropdownRoot.asElement())) {
        throw new Error(`Could not find dropdown label: ${labelText}`);
    }

    const trigger = await dropdownRoot.$('div[tabindex="0"]');
    if (!trigger) {
        throw new Error(`Could not find dropdown trigger for label: ${labelText}`);
    }

    // Wait for trigger text to load (not "Loading...")
    await page.waitForFunction((el) => {
        const t = (el.textContent || '').trim();
        return t && !t.includes('Loading...');
    }, { timeout: 15000 }, trigger);

    await trigger.click();
    await new Promise(r => setTimeout(r, 1500));

    const clicked = await page.evaluate((root, searchStr) => {
        const container = root.querySelector('div[class*="absolute"]');
        if (!container) return false;
        
        // Find all options in the container
        const options = Array.from(container.querySelectorAll('div'));
        const lowerSearch = searchStr.toLowerCase();
        
        // Find option matching searchText
        const targetOption = options.find(opt => {
            const txt = (opt.textContent || '').trim().toLowerCase();
            return txt && !txt.includes('loading') && !txt.includes('no results') && txt.includes(lowerSearch);
        });

        if (targetOption) {
            targetOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            targetOption.click();
            return true;
        }
        return false;
    }, dropdownRoot, searchText);

    if (!clicked) {
        throw new Error(`Could not click option containing "${searchText}" in dropdown "${labelText}"`);
    }

    await new Promise(r => setTimeout(r, 2000));
}

async function run() {
    const browser = await setupBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        console.log('Logging in...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        if (page.url().includes('/login')) {
            await page.waitForSelector('input[type="text"]', { visible: true });
            await page.type('input[type="text"]', 'root');
            await page.type('input[type="password"]', 'password');
            await page.keyboard.press('Enter');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        }
        console.log('Login successful.');

        console.log('Navigating to GDCC Dashboard...');
        console.log('Waiting for Portal Home page to load...');
        await page.waitForSelector('h3', { visible: true, timeout: 15000 });
        
        console.log('Clicking GDCC System card on Portal...');
        await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('h3'));
            const target = cards.find(c => c.textContent.trim().includes('GDCC System'));
            if (target) {
                const cardDiv = target.closest('.group') || target.closest('div');
                if (cardDiv) cardDiv.click();
            }
        });
        await new Promise(r => setTimeout(r, 5000));
        console.log('Current URL is:', page.url());

        // Wait for GDCC Page dropdowns to load
        await selectGDCCDropdown(page, 'Select Account', '7 Solutions');
        await selectGDCCDropdown(page, 'Select Zone (Domain)', '');
        await selectGDCCDropdown(page, 'Select Subdomain', '');

        console.log('Clicking Generate Dashboard...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const genBtn = buttons.find(b => b.textContent.includes('Generate Dashboard'));
            if (genBtn) genBtn.click();
        });

        console.log('Waiting 10 seconds for charts/widgets to render...');
        await new Promise(r => setTimeout(r, 10000));

        // Save screenshot of the full viewport
        const screenshotPath = path.join(publicDir, 'captured-dashboard.png');
        console.log(`Current URL before screenshot: ${page.url()}`);
        console.log(`Taking full screenshot to: ${screenshotPath}`);
        await page.screenshot({ path: screenshotPath });

        // Let's crop the "Total Requests" + "Traffic Volume" cards
        const cropCoords = await page.evaluate(() => {
            // Find elements containing "Total Requests" or similar text
            const findCardByText = (text) => {
                const divs = Array.from(document.querySelectorAll('div, p, span, h3, h4'));
                const target = divs.find(d => d.textContent.trim().toLowerCase().includes(text.toLowerCase()));
                if (target) {
                    // Find card container wrapper
                    let parent = target.parentElement;
                    while (parent) {
                        if (parent.className.includes('border') || parent.className.includes('bg-') || parent.className.includes('rounded')) {
                            return parent;
                        }
                        parent = parent.parentElement;
                    }
                    return target;
                }
                return null;
            };

            const reqCard = findCardByText('Total Requests');
            const trafficCard = findCardByText('Traffic Volume') || findCardByText('Bandwidth') || findCardByText('Data Transfer') || findCardByText('Traffic');
            
            if (reqCard && trafficCard) {
                const r1 = reqCard.getBoundingClientRect();
                const r2 = trafficCard.getBoundingClientRect();
                
                const xStart = Math.min(r1.left, r2.left) - 15;
                const xEnd = Math.max(r1.right, r2.right) + 15;
                const yStart = Math.min(r1.top, r2.top) - 15;
                const yEnd = Math.max(r1.bottom, r2.bottom) + 15;
                
                return {
                    x: Math.round(xStart),
                    y: Math.round(yStart),
                    width: Math.round(xEnd - xStart),
                    height: Math.round(yEnd - yStart)
                };
            }
            
            // Default bounding box for top cards in standard GDCC layout
            return {
                x: 280,
                y: 160,
                width: 1300,
                height: 260
            };
        });

        console.log('Crop coordinates calculated:', cropCoords);

        // Apply crop using sharp
        const croppedPath = path.join(publicDir, 'test-cropped-dashboard.png');
        console.log(`Cropping dashboard cards to: ${croppedPath}`);
        await sharp(screenshotPath)
            .extract({
                left: 272,
                top: 224,
                width: 536,
                height: 495
            })
            .toFile(croppedPath);

        console.log('✅ Cropping completed successfully!');
    } catch (err) {
        console.error('Error during dashboard capture:', err);
    } finally {
        await browser.close();
    }
}

run();
