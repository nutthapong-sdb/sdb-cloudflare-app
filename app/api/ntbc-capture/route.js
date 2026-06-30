import { connectChrome } from '@/lib/chrome-helper';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'domains';
        const qXStart = searchParams.get('xStart');
        const qXEnd = searchParams.get('xEnd');
        const qYStart = searchParams.get('yStart');
        const qYEnd = searchParams.get('yEnd');

        // Mock mode check using the bind-mounted db directory
        const mockModePath = path.join(process.cwd(), 'db', 'mock_capture.txt');
        if (fs.existsSync(mockModePath)) {
            console.log(`ℹ️ [MOCK MODE] Simulating capture for type: ${type}...`);
            const publicDir = path.join(process.cwd(), 'public');
            
            // Map types to filenames
            const fileMapping = {
                dns: 'captured-dns.png',
                traffic: 'captured-traffic.png',
                firewall: 'captured-firewall.png',
                'security-rules': 'captured-security-rules.png',
                argo: 'captured-argo.png',
                speed: 'captured-speed.png',
                'speed-mobile': 'captured-speed-mobile.png',
                domains: 'captured-domains.png'
            };
            
            const fileName = fileMapping[type] || 'captured-domains.png';
            const filePath = path.join(publicDir, fileName);
            
            let finalBuffer;
            if (fs.existsSync(filePath)) {
                finalBuffer = fs.readFileSync(filePath);
            } else {
                // Fallback to a 1x1 transparent PNG if the file doesn't exist
                finalBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
            }
            
            const responseData = {
                success: true,
                image: `data:image/png;base64,${finalBuffer.toString('base64')}`,
                filePath: `/${fileName}?t=${Date.now()}`
            };
            
            if (type === 'dns') {
                responseData.dnsPages = [responseData.image];
            }
            
            if (type === 'traffic') {
                for (let i = 1; i <= 5; i++) {
                    const subFile = `captured-traffic-sub${i}.png`;
                    const subPath = path.join(publicDir, subFile);
                    if (fs.existsSync(subPath)) {
                        const subBuf = fs.readFileSync(subPath);
                        responseData[`imageSub${i}`] = `data:image/png;base64,${subBuf.toString('base64')}`;
                        responseData[`filePathSub${i}`] = `/${subFile}?t=${Date.now()}`;
                    } else {
                        responseData[`imageSub${i}`] = responseData.image;
                        responseData[`filePathSub${i}`] = responseData.filePath;
                    }
                }
            }
            
            return Response.json(responseData);
        }

        console.log(`Connecting to Chrome on port 9222 for ${type} screenshot capture...`);
        const browser = await connectChrome();
        const pages = await browser.pages();
        // Find page with cloudflare, otherwise use the first page
        const page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];

        if (!page) {
            return Response.json({ success: false, error: 'No active browser page found' }, { status: 400 });
        }

        // Wait up to 3 seconds for either the login page to appear or the dashboard to load
        try {
            await page.waitForFunction(() => {
                const url = window.location.href;
                const text = document.body ? document.body.innerText.toLowerCase() : '';
                const hasLoginText = text.includes('sign in to cloudflare') || text.includes('log in to cloudflare');
                const hasLoginElement = !!(document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelector('a[href*="/login"]'));
                const isLoginPage = url.includes('/login') || url.includes('/sign-in') || hasLoginText || hasLoginElement;
                const hasDashboardElement = !!(document.querySelector('#react-app') || document.querySelector('[data-testid="zone-card"]') || document.querySelector('main'));
                return isLoginPage || hasDashboardElement;
            }, { timeout: 3000 });
        } catch (e) {
            console.log('Timeout waiting for page load state, checking current state...');
        }

        const isUnauthenticated = await page.evaluate(() => {
            const url = window.location.href;
            const text = document.body ? document.body.innerText.toLowerCase() : '';
            const hasLoginText = text.includes('sign in to cloudflare') || text.includes('log in to cloudflare');
            const hasLoginElement = !!(document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelector('a[href*="/login"]'));
            return url.includes('/login') || url.includes('/sign-in') || hasLoginText || hasLoginElement;
        });

        if (isUnauthenticated) {
            await browser.disconnect();
            return Response.json({ 
                success: false, 
                error: 'Cloudflare session is not authenticated. Please open the "Live Browser Monitor" (noVNC) from the Actions menu and log in to Cloudflare first.',
                errorType: 'unauthenticated'
            }, { status: 401 });
        }

        // 1. First wait exactly 3 seconds to allow initial scripts/redirect to stabilize
        console.log('Waiting 3 seconds for initial page initialization...');
        await new Promise(r => setTimeout(r, 3000));

        let pageIndex = 1;
        let hasNextPage = true;
        const pageBuffers = [];
        let sub1Buffer = null;
        let sub2Buffer = null;
        let sub3Buffer = null;
        let sub4Buffer = null;
        let sub5Buffer = null;

        while (hasNextPage) {
            console.log(`Processing page ${pageIndex} of ${type}...`);

            // 2. Wait dynamically for page elements to be loaded and verify NO lazy loading skeleton or spinner exists
            console.log(`Checking for lazy loading elements and waiting for ${type} page ${pageIndex} content to finish rendering...`);
            try {
                await page.waitForFunction((captureType) => {
                    const findElementByText = (selector, text) => {
                        const elements = Array.from(document.querySelectorAll(selector));
                        return elements.find(el => {
                            const content = el.textContent || '';
                            const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                            return isVisible && content.trim().toLowerCase().includes(text.toLowerCase());
                        });
                    };
                    
                    // Check if any visible skeleton loader, loading spinner, progress bar or spinner is active
                    const isLoaderActive = !!(
                        document.querySelector('[class*="skeleton"], [class*="loading"], [role="progressbar"], svg[class*="spin"], [class*="spinner"]') ||
                        Array.from(document.querySelectorAll('span, div, p')).find(el => {
                            const text = (el.textContent || '').toLowerCase();
                            return (el.offsetWidth > 0 || el.offsetHeight > 0) && (text.includes('loading') || text.includes('please wait'));
                        })
                    );

                    // Ensure heading H1-H4 title is visible
                    const headingText = captureType === 'traffic' ? 'traffic' : (captureType === 'dns' ? 'dns' : (captureType === 'firewall' ? 'security' : (captureType === 'security-rules' ? 'rules' : (captureType === 'argo' ? 'argo' : (captureType === 'speed' || captureType === 'speed-mobile' ? 'speed' : 'domains')))));
                    const heading = findElementByText('h1, h2, h3, h4', headingText);
                    // Ensure table body, pagination footer, or traffic chart is loaded
                    let tableOrFooter;
                    if (captureType === 'traffic' || captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                        tableOrFooter = findElementByText('div, span, button, p, td', 'requests') || findElementByText('div, span, h1, h2, h3, h4', 'traffic') || findElementByText('div, span, button, p, td', 'result') || document.querySelector('svg, canvas, button');
                    } else if (captureType === 'domains') {
                        tableOrFooter = document.querySelector('[data-testid="zone-card"]') || findElementByText('div, span, h1, h2, h3, p', 'sites') || document.querySelector('table');
                    } else {
                        tableOrFooter = findElementByText('div, span, button, p, td', 'of') || findElementByText('div, span, button, p, td', 'items') || document.querySelector('table');
                    }
                                          
                    // Complete if heading and footer/table exist AND no loading placeholders are active
                    return !!(heading && tableOrFooter && !isLoaderActive);
                }, { timeout: 15000 }, type);
                console.log(`${type} page ${pageIndex} loaded and verified: zero active lazy loading elements found.`);
                // Add a short stabilize delay for visual rendering animations
                await new Promise(r => setTimeout(r, 400));
            } catch (err) {
                console.warn(`Timeout waiting for page elements to finish lazy loading. Proceeding anyway:`, err.message);
            }

            // Evaluate coordinates for post-capture cropping (no viewport clipping)
            console.log('Calculating bounding box coordinates on active page...');
            let cropCoords = null;
            if (qXStart && qXEnd && qYStart && qYEnd && type !== 'domains' && type !== 'dns') {
                const xs = parseInt(qXStart, 10);
                const xe = parseInt(qXEnd, 10);
                const ys = parseInt(qYStart, 10);
                const ye = parseInt(qYEnd, 10);
                if (!isNaN(xs) && !isNaN(xe) && !isNaN(ys) && !isNaN(ye)) {
                    cropCoords = {
                        x: xs,
                        y: ys,
                        width: Math.max(10, xe - xs),
                        height: Math.max(10, ye - ys)
                    };
                    console.log('Using query custom crop coords:', cropCoords);
                }
            }

            if (!cropCoords) {
                cropCoords = await page.evaluate((captureType, qXS, qXE, qYS, qYE) => {
                const findLastElementByText = (selector, text) => {
                    const elements = Array.from(document.querySelectorAll(selector));
                    return elements.reverse().find(el => {
                        const content = el.textContent || '';
                        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                        return isVisible && content.trim().toLowerCase().includes(text.toLowerCase());
                    });
                };

                const findElementByText = (selector, text) => {
                    const elements = Array.from(document.querySelectorAll(selector));
                    return elements.find(el => {
                        const content = el.textContent || '';
                        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                        return isVisible && content.trim().toLowerCase().includes(text.toLowerCase());
                    });
                };

                // Look for visible headings containing target text
                const headingText = captureType === 'traffic' ? 'traffic' : (captureType === 'dns' ? 'dns' : (captureType === 'firewall' ? 'security' : (captureType === 'security-rules' ? 'rules' : (captureType === 'argo' ? 'argo' : (captureType === 'speed' || captureType === 'speed-mobile' ? 'speed' : 'domains')))));
                const heading = findElementByText('h1, h2, h3, h4', headingText) || 
                                findElementByText('span, div', headingText);
                // Look for visible pagination footer text containing item counts from the bottom-up
                const footer = (captureType === 'dns' || captureType === 'firewall' || captureType === 'security-rules')
                    ? (findLastElementByText('div, span, button, p, td', 'records added') || 
                       findLastElementByText('div, span, button, p, td', 'records') || 
                       findLastElementByText('div, span, button, p, td', 'of'))
                    : ((captureType === 'traffic' || captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile')
                        ? null
                        : (findLastElementByText('div, span, button, p, td', '1 - 5 of 5') || 
                           findLastElementByText('div, span, button, p, td', 'items') ||
                           findLastElementByText('div, span, button, p, td', '1 - ') ||
                           findLastElementByText('div, span, button, p, td', 'of')));

                if (!heading) {
                    console.warn(`${captureType} heading not found in page DOM`);
                    return null;
                }

                const scrollY = window.scrollY || window.pageYOffset || 0;
                const headingRect = heading.getBoundingClientRect();
                const headingTop = headingRect.top + scrollY;
                let absoluteBottom = window.innerHeight + scrollY;

                const siteFooter = document.querySelector('#site-footer') || document.querySelector('footer');
                if (captureType === 'dns') {
                    if (footer) {
                        const footerRect = footer.getBoundingClientRect();
                        absoluteBottom = footerRect.bottom + scrollY + 15;
                    } else {
                        const dnsRows = document.querySelectorAll('tr[data-testid="dns-table-row"]');
                        if (dnsRows && dnsRows.length > 0) {
                            const lastRow = dnsRows[dnsRows.length - 1];
                            const lastRowRect = lastRow.getBoundingClientRect();
                            absoluteBottom = lastRowRect.bottom + scrollY + 15;
                        } else {
                            const dnsTable = document.querySelector('table');
                            if (dnsTable) {
                                const tableRect = dnsTable.getBoundingClientRect();
                                absoluteBottom = tableRect.bottom + scrollY + 15;
                            } else if (siteFooter) {
                                absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10;
                            }
                        }
                    }
                } else if (footer) {
                    const footerRect = footer.getBoundingClientRect();
                    absoluteBottom = footerRect.bottom + scrollY;
                } else if (siteFooter) {
                    absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10;
                } else {
                    const listContainer = heading.closest('div')?.querySelector('table, ul, [role="table"], [class*="list"], svg, canvas, [class*="chart"]');
                    if (listContainer) {
                        absoluteBottom = listContainer.getBoundingClientRect().bottom + scrollY + 40;
                    }
                }

                if (captureType === 'traffic') {
                    absoluteBottom = absoluteBottom - Math.round(window.innerHeight * 0.03);
                } else if (captureType === 'firewall') {
                    const pixelsReduced = Math.round(window.innerHeight * 0.30);
                    absoluteBottom = absoluteBottom - pixelsReduced;
                    console.log(`${captureType} crop Yend reduced by 30% (${pixelsReduced}px)`);
                } else if (captureType === 'security-rules' || captureType === 'argo') {
                    // Yend must capture until above footer (#site-footer)
                    if (siteFooter) {
                        absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10;
                    }
                } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                    // Yend -10% of window.innerHeight from siteFooter top
                    if (siteFooter) {
                        absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10 - Math.round(window.innerHeight * 0.10);
                    } else {
                        absoluteBottom = absoluteBottom - Math.round(window.innerHeight * 0.10);
                    }
                }

                let startX;
                const parsedXS = parseInt(qXS, 10);
                if (!isNaN(parsedXS)) {
                    startX = parsedXS;
                } else {
                    startX = Math.round(window.innerWidth * 0.15);
                    if (captureType === 'domains') {
                        startX = Math.round(window.innerWidth * 0.18) + 50;
                    } else if (captureType === 'dns') {
                        startX = Math.round(window.innerWidth * 0.19);
                    } else if (captureType === 'traffic') {
                        startX = Math.round(window.innerWidth * 0.22);
                    } else if (captureType === 'firewall' || captureType === 'security-rules') {
                        startX = Math.round(window.innerWidth * 0.15);
                    } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                        startX = Math.round(window.innerWidth * 0.25);
                    }
                }

                let endX;
                const parsedXE = parseInt(qXE, 10);
                if (!isNaN(parsedXE)) {
                    endX = parsedXE;
                } else {
                    endX = Math.round(window.innerWidth * 0.90);
                    if (captureType === 'domains') {
                        endX = Math.round(window.innerWidth * 0.93);
                    } else if (captureType === 'dns') {
                        endX = Math.round(window.innerWidth * 0.96);
                    } else if (captureType === 'traffic') {
                        endX = Math.round(window.innerWidth * 0.92);
                    } else if (captureType === 'firewall') {
                        endX = Math.round(window.innerWidth * 0.90);
                    } else if (captureType === 'security-rules') {
                        endX = Math.round(window.innerWidth * 1.00);
                    } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                        endX = Math.round(window.innerWidth * 0.85);
                    }
                }

                let startY;
                const parsedYS = parseInt(qYS, 10);
                if (!isNaN(parsedYS)) {
                    startY = parsedYS;
                } else {
                    let yOffset = -20;
                    if (captureType === 'dns' || captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                        yOffset = -20 - Math.round(window.innerHeight * 0.02);
                    } else if (captureType === 'traffic') {
                        yOffset = -20 - Math.round(window.innerHeight * 0.01);
                    } else if (captureType === 'firewall' || captureType === 'security-rules') {
                        yOffset = -20;
                    }
                    startY = Math.max(0, headingTop + yOffset);
                }

                let targetHeight;
                if (captureType === 'domains' || captureType === 'dns') {
                    // Treat qYE as the offset to add to absoluteBottom height
                    // Positive adds height (extends downwards), negative reduces height (cuts upwards)
                    const parsedYE = parseInt(qYE, 10);
                    let offsetVal;
                    if (!isNaN(parsedYE)) {
                        offsetVal = parsedYE;
                    } else {
                        if (captureType === 'domains') {
                            offsetVal = footer ? 15 : -250;
                        } else {
                            // captureType === 'dns'
                            offsetVal = 15;
                        }
                    }
                    targetHeight = Math.max(150, (absoluteBottom - startY) + offsetVal);
                } else {
                    const parsedYE = parseInt(qYE, 10);
                    if (!isNaN(parsedYE)) {
                        targetHeight = Math.max(10, parsedYE - startY);
                    } else {
                        targetHeight = Math.max(150, (absoluteBottom - startY));
                        if (captureType === 'traffic') {
                            targetHeight = 900;
                        } else if (captureType === 'firewall') {
                            targetHeight = 700;
                        } else if (captureType === 'security-rules' || captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                            targetHeight = Math.max(150, (absoluteBottom - startY));
                        }
                    }
                }

                return {
                    x: startX,
                    y: startY,
                    width: endX - startX,
                    height: targetHeight
                };
            }, type, qXStart, qXEnd, qYStart, qYEnd);
            }

            // Retrieve document height to expand the viewport temporarily and prevent visual flickering from fullPage: true
            const originalViewportSize = await page.evaluate(() => {
                return {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    documentHeight: Math.max(
                        document.body.scrollHeight,
                        document.documentElement.scrollHeight,
                        document.body.offsetHeight,
                        document.documentElement.offsetHeight,
                        window.innerHeight
                    )
                };
            });

            console.log(`Temporarily resizing viewport height from ${originalViewportSize.height} to ${originalViewportSize.documentHeight} for full page capture...`);
            await page.setViewport({
                width: originalViewportSize.width,
                height: originalViewportSize.documentHeight
            });

            console.log('Capturing page screenshot (flicker-free)...');
            const fullScreenshotBase64 = await page.screenshot({
                encoding: 'base64',
                type: 'png'
            });

            // Restore viewport size to original window dimensions
            await page.setViewport({
                width: originalViewportSize.width,
                height: originalViewportSize.height
            });

            let pageBuffer = Buffer.from(fullScreenshotBase64, 'base64');

            // Apply sharp crop
            if (cropCoords) {
                try {
                    console.log('Programmatically cropping image using sharp:', cropCoords);
                    const image = sharp(pageBuffer);
                    const metadata = await image.metadata();

                    // Align coordinates with devicePixelRatio (since Retina displays scale pixels 2x)
                    const pagesDevicePixelRatio = await page.evaluate(() => window.devicePixelRatio || 1);

                    const scaleX = Math.round(cropCoords.x * pagesDevicePixelRatio);
                    const scaleY = Math.round(cropCoords.y * pagesDevicePixelRatio);
                    const scaleWidth = Math.round(cropCoords.width * pagesDevicePixelRatio);
                    const scaleHeight = Math.round(cropCoords.height * pagesDevicePixelRatio);

                    // Safe boundaries
                    const extractLeft = Math.max(0, Math.min(scaleX, metadata.width - 1));
                    const extractTop = Math.max(0, Math.min(scaleY, metadata.height - 1));
                    const extractWidth = Math.max(10, Math.min(scaleWidth, metadata.width - extractLeft));
                    const extractHeight = Math.max(10, Math.min(scaleHeight, metadata.height - extractTop));

                    if (type === 'traffic') {
                        // 1. Crop sub1 (900px height from startY on the initial Requests tab)
                        console.log('Cropping sub1 (900px height)...');
                        const scaleHeight900 = Math.round(900 * pagesDevicePixelRatio);
                        const extractHeight900 = Math.max(10, Math.min(scaleHeight900, metadata.height - extractTop));
                        sub1Buffer = await sharp(pageBuffer)
                            .extract({
                                left: extractLeft,
                                top: extractTop,
                                width: extractWidth,
                                height: extractHeight900
                            })
                            .toBuffer();

                        // 2. Click subsequent tabs and capture
                        const additionalTabs = [
                            { text: 'data transfer', key: 'sub2' },
                            { text: 'page views', key: 'sub3' },
                            { text: 'visits', key: 'sub4' },
                            { text: 'api requests', key: 'sub5' }
                        ];

                        const tabBuffers = {};

                        for (const tabInfo of additionalTabs) {
                            console.log(`Searching for "${tabInfo.text}" tab to click...`);
                            try {
                                const tabClicked = await page.evaluate((tabText) => {
                                    const anchors = Array.from(document.querySelectorAll('nav a, button, [role="tab"], a'));
                                    const target = anchors.find(a => {
                                        const text = (a.textContent || '').trim().toLowerCase();
                                        return text.includes(tabText);
                                    });
                                    if (target) {
                                        target.click();
                                        return true;
                                    }
                                    return false;
                                }, tabInfo.text);

                                if (tabClicked) {
                                    console.log(`Waiting 5 seconds for ${tabInfo.text} content...`);
                                    await new Promise(r => setTimeout(r, 5000));

                                    // Retrieve document height to expand the viewport temporarily
                                    const tempDocHeight = await page.evaluate(() => {
                                        return Math.max(
                                            document.body.scrollHeight,
                                            document.documentElement.scrollHeight,
                                            document.body.offsetHeight,
                                            document.documentElement.offsetHeight,
                                            window.innerHeight
                                        );
                                    });

                                    await page.setViewport({
                                        width: originalViewportSize.width,
                                        height: tempDocHeight
                                    });

                                    console.log(`Capturing ${tabInfo.text} page screenshot...`);
                                    const subScreenshotBase64 = await page.screenshot({
                                        encoding: 'base64',
                                        type: 'png'
                                    });

                                    await page.setViewport({
                                        width: originalViewportSize.width,
                                        height: originalViewportSize.height
                                    });

                                    const subFullBuffer = Buffer.from(subScreenshotBase64, 'base64');
                                    const subImage = sharp(subFullBuffer);
                                    const subMetadata = await subImage.metadata();

                                    // Find element with text "Requests volume by country"
                                    const requestsVolumeTop = await page.evaluate(() => {
                                        const findElementByText = (selector, text) => {
                                            const elements = Array.from(document.querySelectorAll(selector));
                                            return elements.find(el => {
                                                const content = el.textContent || '';
                                                const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                                                return isVisible && content.trim().toLowerCase().includes(text.toLowerCase());
                                            });
                                        };
                                        const el = findElementByText('h1, h2, h3, h4, h5, div, span, p', 'Requests volume by country');
                                        if (el) {
                                            return el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
                                        }
                                        return null;
                                    });

                                    let customSubHeight = scaleHeight900;
                                    if (requestsVolumeTop) {
                                        const relativeHeight = requestsVolumeTop - cropCoords.y - 15; // 15px safety margin above the heading
                                        customSubHeight = Math.round(relativeHeight * pagesDevicePixelRatio);
                                        console.log(`Dynamic ${tabInfo.text} height: ending before 'Requests volume by country' at height: ${relativeHeight}px (${customSubHeight} scaled px)`);
                                    }

                                    const extractHeightSub = Math.max(10, Math.min(customSubHeight, subMetadata.height - extractTop));

                                    const croppedBuf = await subImage
                                        .extract({
                                            left: extractLeft,
                                            top: extractTop,
                                            width: extractWidth,
                                            height: extractHeightSub
                                        })
                                        .toBuffer();
                                    
                                    tabBuffers[tabInfo.key] = croppedBuf;
                                    console.log(`${tabInfo.text} cropping completed successfully.`);
                                } else {
                                    console.warn(`Could not find or click the "${tabInfo.text}" tab.`);
                                }
                            } catch (tabErr) {
                                console.error(`Failed to process tab "${tabInfo.text}":`, tabErr);
                            }
                        }

                        sub2Buffer = tabBuffers.sub2 || null;
                        sub3Buffer = tabBuffers.sub3 || null;
                        sub4Buffer = tabBuffers.sub4 || null;
                        sub5Buffer = tabBuffers.sub5 || null;
                    }

                    // Proceed with standard crop for the main image
                    pageBuffer = await image
                        .extract({
                            left: extractLeft,
                            top: extractTop,
                            width: extractWidth,
                            height: extractHeight
                        })
                        .toBuffer();
                    console.log('Main cropping completed successfully.');
                } catch (err) {
                    console.error('Failed to crop screenshot with sharp:', err);
                }
            }

            pageBuffers.push(pageBuffer);

            // Handle Pagination for DNS Records
            if (type === 'dns') {
                const nextButtonStatus = await page.evaluate(() => {
                    const btn = document.querySelector('button[data-testid="undefined-next-page"]') || 
                                document.querySelector('button[aria-label="Next"]') || 
                                document.querySelector('button[title="Next"]');
                    if (!btn) return { exists: false };
                    
                    const isDisabled = btn.disabled || 
                                       btn.getAttribute('aria-disabled') === 'true' || 
                                       btn.hasAttribute('disabled');
                    return { exists: true, disabled: isDisabled };
                });

                if (nextButtonStatus.exists && !nextButtonStatus.disabled) {
                    console.log(`[Page ${pageIndex}] Clicking Next Page button...`);
                    await page.evaluate(() => {
                        const btn = document.querySelector('button[data-testid="undefined-next-page"]') || 
                                    document.querySelector('button[aria-label="Next"]') || 
                                    document.querySelector('button[title="Next"]');
                        btn.click();
                    });

                    // Wait 2.5 seconds for transition loading
                    await new Promise(r => setTimeout(r, 2500));
                    pageIndex++;
                } else {
                    console.log(`No active Next button found on page ${pageIndex}. Completing loop.`);
                    hasNextPage = false;
                }
            } else {
                hasNextPage = false;
            }
        }

        // Stitch page buffers vertically if multiple pages exist
        let finalBuffer = pageBuffers[0];
        if (pageBuffers.length > 1 && type !== 'dns') {
            console.log(`Stitching ${pageBuffers.length} captured page screenshots vertically...`);
            try {
                const imageMetadatas = await Promise.all(pageBuffers.map(buf => sharp(buf).metadata()));
                const totalHeight = imageMetadatas.reduce((sum, meta) => sum + meta.height, 0);
                const maxWidth = Math.max(...imageMetadatas.map(meta => meta.width));
                
                let yOffset = 0;
                const compositeList = pageBuffers.map((buf, idx) => {
                    const item = {
                        input: buf,
                        top: yOffset,
                        left: 0
                    };
                    yOffset += imageMetadatas[idx].height;
                    return item;
                });
                
                finalBuffer = await sharp({
                    create: {
                        width: maxWidth,
                        height: totalHeight,
                        channels: 4,
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    }
                })
                .composite(compositeList)
                .png()
                .toBuffer();
                console.log('Stitching completed successfully.');
            } catch (stitchErr) {
                console.error('Stitching images failed:', stitchErr);
                // Fallback to first page
            }
        }

        // Save to Next.js public directory inside the project
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }

        // Clean up old captured-dns-*.png files
        if (type === 'dns') {
            try {
                const files = fs.readdirSync(publicDir);
                for (const file of files) {
                    if (file.startsWith('captured-dns-') && file.endsWith('.png')) {
                        fs.unlinkSync(path.join(publicDir, file));
                    }
                }
            } catch (e) {
                console.error('Failed to clean up old dns capture files:', e);
            }
        }

        const fileName = type === 'dns' ? 'captured-dns.png' : (type === 'traffic' ? 'captured-traffic.png' : (type === 'firewall' ? 'captured-firewall.png' : (type === 'security-rules' ? 'captured-security-rules.png' : (type === 'argo' ? 'captured-argo.png' : (type === 'speed' ? 'captured-speed.png' : (type === 'speed-mobile' ? 'captured-speed-mobile.png' : 'captured-domains.png'))))));
        const filePath = path.join(publicDir, fileName);
        fs.writeFileSync(filePath, finalBuffer);
        console.log(`Screenshot saved to ${filePath}`);

        if (type === 'dns' && pageBuffers.length > 0) {
            for (let i = 0; i < pageBuffers.length; i++) {
                const pageFileName = `captured-dns-${i + 1}.png`;
                const pageFilePath = path.join(publicDir, pageFileName);
                fs.writeFileSync(pageFilePath, pageBuffers[i]);
                console.log(`Saved paginated DNS screenshot to ${pageFilePath}`);
            }
        }

        if (type === 'traffic') {
            if (sub1Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub1.png'), sub1Buffer);
                console.log('Saved traffic sub1 screenshot');
            }
            if (sub2Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub2.png'), sub2Buffer);
                console.log('Saved traffic sub2 screenshot');
            }
            if (sub3Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub3.png'), sub3Buffer);
                console.log('Saved traffic sub3 screenshot');
            }
            if (sub4Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub4.png'), sub4Buffer);
                console.log('Saved traffic sub4 screenshot');
            }
            if (sub5Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub5.png'), sub5Buffer);
                console.log('Saved traffic sub5 screenshot');
            }
        }

        await browser.disconnect();

        const finalImageBase64 = finalBuffer.toString('base64');
        const responseData = {
            success: true,
            image: `data:image/png;base64,${finalImageBase64}`,
            filePath: `/${fileName}?t=${Date.now()}`
        };

        if (type === 'dns') {
            responseData.dnsPages = pageBuffers.map(buf => `data:image/png;base64,${buf.toString('base64')}`);
        }

        if (type === 'traffic') {
            if (sub1Buffer) {
                responseData.imageSub1 = `data:image/png;base64,${sub1Buffer.toString('base64')}`;
                responseData.filePathSub1 = `/captured-traffic-sub1.png?t=${Date.now()}`;
            }
            if (sub2Buffer) {
                responseData.imageSub2 = `data:image/png;base64,${sub2Buffer.toString('base64')}`;
                responseData.filePathSub2 = `/captured-traffic-sub2.png?t=${Date.now()}`;
            }
            if (sub3Buffer) {
                responseData.imageSub3 = `data:image/png;base64,${sub3Buffer.toString('base64')}`;
                responseData.filePathSub3 = `/captured-traffic-sub3.png?t=${Date.now()}`;
            }
            if (sub4Buffer) {
                responseData.imageSub4 = `data:image/png;base64,${sub4Buffer.toString('base64')}`;
                responseData.filePathSub4 = `/captured-traffic-sub4.png?t=${Date.now()}`;
            }
            if (sub5Buffer) {
                responseData.imageSub5 = `data:image/png;base64,${sub5Buffer.toString('base64')}`;
                responseData.filePathSub5 = `/captured-traffic-sub5.png?t=${Date.now()}`;
            }
        }

        return Response.json(responseData);
    } catch (e) {
        console.error('Puppeteer remote capture error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
