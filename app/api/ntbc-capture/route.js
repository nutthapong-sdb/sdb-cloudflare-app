import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'domains';

        console.log(`Connecting to Chrome on port 9222 for ${type} screenshot capture...`);
        const browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null
        });
        const pages = await browser.pages();
        // Find page with cloudflare, otherwise use the first page
        const page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];

        if (!page) {
            return Response.json({ success: false, error: 'No active browser page found' }, { status: 400 });
        }

        // 1. First wait exactly 3 seconds to allow initial scripts/redirect to stabilize
        console.log('Waiting 3 seconds for initial page initialization...');
        await new Promise(r => setTimeout(r, 3000));

        let pageIndex = 1;
        let hasNextPage = true;
        const pageBuffers = [];

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
                    const headingText = captureType === 'traffic' ? 'traffic' : (captureType === 'dns' ? 'dns' : 'domains');
                    const heading = findElementByText('h1, h2, h3, h4', headingText);
                    // Ensure table body, pagination footer, or traffic chart is loaded
                    const tableOrFooter = captureType === 'traffic'
                        ? (findElementByText('div, span, button, p, td', 'requests') || findElementByText('div, span, h1, h2, h3, h4', 'traffic') || document.querySelector('svg, canvas'))
                        : (findElementByText('div, span, button, p, td', 'of') || 
                           findElementByText('div, span, button, p, td', 'items') ||
                           document.querySelector('table'));
                                          
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
            const cropCoords = await page.evaluate((captureType) => {
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
                const headingText = captureType === 'traffic' ? 'traffic' : (captureType === 'dns' ? 'dns' : 'domains');
                const heading = findElementByText('h1, h2, h3, h4', headingText) || 
                                findElementByText('span, div', headingText);
                // Look for visible pagination footer text containing item counts from the bottom-up
                const footer = captureType === 'dns'
                    ? (findLastElementByText('div, span, button, p, td', 'records added') || 
                       findLastElementByText('div, span, button, p, td', 'of'))
                    : (captureType === 'traffic' 
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
                if (siteFooter) {
                    absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10;
                } else if (footer) {
                    const footerRect = footer.getBoundingClientRect();
                    absoluteBottom = footerRect.bottom + scrollY;
                } else {
                    const listContainer = heading.closest('div')?.querySelector('table, ul, [role="table"], [class*="list"], svg, canvas, [class*="chart"]');
                    if (listContainer) {
                        absoluteBottom = listContainer.getBoundingClientRect().bottom + scrollY + 40;
                    }
                }

                let yOffset = -20;
                if (captureType === 'dns') {
                    yOffset = -20 - Math.round(window.innerHeight * 0.02);
                } else if (captureType === 'traffic') {
                    yOffset = -20 - Math.round(window.innerHeight * 0.01);
                }

                let startX = Math.round(window.innerWidth * 0.15);
                if (captureType === 'dns') {
                    startX = Math.round(window.innerWidth * 0.19);
                } else if (captureType === 'traffic') {
                    startX = Math.round(window.innerWidth * 0.20);
                }

                let endX = Math.round(window.innerWidth * 0.90);
                if (captureType === 'dns') {
                    endX = Math.round(window.innerWidth * 0.96);
                }

                const startY = Math.max(0, headingTop + yOffset);

                return {
                    x: startX,
                    y: startY,
                    width: endX - startX,
                    height: Math.max(150, (absoluteBottom - startY) + 20)
                };
            }, type);

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

                    pageBuffer = await image
                        .extract({
                            left: extractLeft,
                            top: extractTop,
                            width: extractWidth,
                            height: extractHeight
                        })
                        .toBuffer();
                    console.log('Cropping completed successfully.');
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
        if (pageBuffers.length > 1) {
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
        const fileName = type === 'dns' ? 'captured-dns.png' : 'captured-domains.png';
        const filePath = path.join(publicDir, fileName);
        fs.writeFileSync(filePath, finalBuffer);
        console.log(`Screenshot saved to ${filePath}`);

        await browser.disconnect();

        const finalImageBase64 = finalBuffer.toString('base64');

        return Response.json({
            success: true,
            image: `data:image/png;base64,${finalImageBase64}`,
            filePath: `/${fileName}?t=${Date.now()}`
        });
    } catch (e) {
        console.error('Puppeteer remote capture error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
