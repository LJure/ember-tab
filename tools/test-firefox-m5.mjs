import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { By } from 'selenium-webdriver';

export async function runM5Tests({driver, check, runInExtension, evidence, uuid}) {
    await check('M5 normal package declares data and denies plaintext hosts', async () => {
        const manifest = await runInExtension('return chrome.runtime.getManifest()');
        assert.deepEqual(manifest.host_permissions, ['https://*/*']);
        assert.ok(manifest.browser_specific_settings.gecko.data_collection_permissions.required.includes('authenticationInfo'));
        let requests = 0;
        const server = createServer((_req,res) => { requests++; res.end('must not be contacted'); });
        await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
        try {
            const denied = await runInExtension(`try { await fetch(arguments[0]); return false; } catch { return true; }`, `http://127.0.0.1:${server.address().port}/privacy-probe`);
            assert.equal(denied, true);
            assert.equal(requests, 0);
        } finally { await new Promise(resolve => server.close(resolve)); }
    });
    await check('M5 packaged icons decode at declared sizes', async () => {
        const sizes = await runInExtension(`return await Promise.all([16,48,128].map(size => new Promise((resolve,reject) => { const image = new Image(); image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]); image.onerror=reject; image.src=chrome.runtime.getURL('assets/icons/icon'+size+'.png'); })))`);
        assert.deepEqual(sizes, [[16,16],[48,48],[128,128]]);
    });
    for (const locale of ['zh-CN','zh-TW','en']) {
        await check(`M5 about attribution and local privacy in ${locale}`, async () => {
            await driver.findElement(By.id('settingsBtn')).click();
            await driver.wait(async () => (await driver.findElements(By.css('[data-menu="about"]'))).length > 0, 5000);
            await driver.wait(async () => await driver.executeScript(`const el=document.getElementById('macSettingsOverlay'); return el && getComputedStyle(el).opacity==='1' && !el.getAnimations({subtree:true}).some(a=>a.playState==='running' && a.effect.getComputedTiming().iterations!==Infinity);`),5000);
            await driver.executeScript(`document.querySelector('[data-menu="general"]').click()`);
            await driver.wait(async () => (await driver.findElements(By.id('macInterfaceLanguage'))).length > 0,5000);
            await driver.findElement(By.css(`#macInterfaceLanguage option[value="${locale}"]`)).click();
            await driver.wait(async () => await driver.executeScript('return document.documentElement.lang===arguments[0]',locale),5000);
            await driver.executeScript(`document.querySelector('[data-menu="about"]').click()`);
            await driver.wait(async () => (await driver.findElements(By.css('.mac-about-name'))).length > 0 && (await driver.findElement(By.css('.mac-about-name')).getText()) === 'Ember Tab', 5000);
            assert.equal(await driver.findElement(By.css('.mac-about-name')).getText(),'Ember Tab');
            assert.match(await driver.findElement(By.css('.mac-about-footer')).getText(), /Aura Tab/);
            assert.ok((await driver.findElement(By.css('a[href="privacy.html"]')).getText()).length > 0);
            assert.equal(await driver.findElement(By.css('a[href="privacy.html"]')).getText(),locale==='en'?'Privacy Policy':locale==='zh-CN'?'隐私政策':'隱私權政策');
            await writeFile(path.join(evidence, `about-${locale}.png`),await driver.takeScreenshot(),'base64');
            await driver.executeScript(`document.getElementById('macSettingsClose').click()`);
            await driver.wait(async () => await driver.executeScript(`const el=document.getElementById('macSettingsOverlay'); return !el || getComputedStyle(el).display==='none' || getComputedStyle(el).opacity==='0';`),5000);
        });
    }
    await check('M5 Pexels photo credit remains visible and links to the work', async () => {
        const credit = await runInExtension(`
            const { LayoutManager } = await import('./scripts/domains/layout.js');
            const photo = { username: 'Review fixture', provider: 'pexels',
                page: 'https://www.pexels.com/photo/123/', userUrl: 'https://www.pexels.com/@fixture/' };
            const layout = new LayoutManager({ backgroundSystem: {
                whenReady: async () => {}, getCurrentBackground: () => photo
            } });
            layout._applyBackgroundVisibilitySettings({ showPhotoInfo: false });
            await layout._updatePhotoInfo();
            return { href: document.getElementById('photoAuthor').getAttribute('href'),
                name: document.getElementById('authorName').textContent,
                visible: document.getElementById('cornerTopRight').classList.contains('always-visible') };`);
        assert.deepEqual(credit, { href: 'https://www.pexels.com/photo/123/',
            name: 'Review fixture · Pexels', visible: true });
    });
    await check('M5 local privacy renders with no remote subresources', async () => {
        await driver.get(`moz-extension://${uuid}/privacy.html`);
        assert.match(await driver.findElement(By.css('body')).getText(),/WebDAV/);
        assert.deepEqual(await driver.executeScript('return performance.getEntriesByType("resource").map(e=>e.name).filter(u=>/^https?:/.test(u))'),[]);
        await writeFile(path.join(evidence,'privacy.png'),await driver.takeScreenshot(),'base64');
        await driver.get(`moz-extension://${uuid}/newtab.html`);
    });
}
