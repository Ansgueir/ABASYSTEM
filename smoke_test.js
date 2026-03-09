const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('Navigating to login...');
        await page.goto('http://170.55.79.9:9000/login', { waitUntil: 'networkidle' });
        console.log('Current URL after goto(login):', page.url());

        // Fill credentials
        await page.fill('input#email', 'qa-super@abasystem.com');
        await page.fill('input#password', 'Abasystem2026*');

        // Setup role if needed (office button)
        const officeBtn = await page.getByRole('button', { name: 'Office' });
        if (officeBtn) await officeBtn.click();

        console.log('Submitting login form...');
        await page.click('button[type="submit"]');

        console.log('Waiting for Navigation...');
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        console.log('URL after login:', page.url());

        console.log('Navigating to Vault...');
        await page.goto('http://170.55.79.9:9000/office/vault', { waitUntil: 'networkidle' });

        // Screenshot
        await page.screenshot({ path: 'C:/Users/Andyf/Documents/vault_screenshot.png' });
        console.log('Screenshot saved to document path!');

    } catch (e) {
        console.error('Error in script:', e);
        await page.screenshot({ path: 'C:/Users/Andyf/Documents/vault_screenshot_error.png' });
    } finally {
        await browser.close();
    }
})();
