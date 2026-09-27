import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { By } from 'selenium-webdriver';

export async function runWallhavenTests({ driver, check, runInExtension: run, evidence }) {
    const openSettings = async () => {
        // The settings click handler is registered after deferred quicklinks startup.
        await driver.wait(async () => {
            if (await driver.executeScript(`return document.getElementById('macSettingsOverlay').getAttribute('aria-hidden')==='false';`)) return true;
            await driver.findElement(By.id('settingsBtn')).click();
            return false;
        }, 15000);
        await driver.wait(async () => await driver.executeScript(`return getComputedStyle(document.getElementById('macSettingsOverlay')).opacity==='1';`), 5000);
    };
    const closeSettings = async () => {
        await driver.executeScript(`document.getElementById('macSettingsClose').click()`);
        await driver.wait(async () => await driver.executeScript(`return getComputedStyle(document.getElementById('macSettingsOverlay')).opacity==='0';`), 5000);
    };
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
        await check(`Wallhaven appearance controls in ${locale}`, async () => {
            await openSettings();
            await driver.executeScript(`document.querySelector('[data-menu="general"]').click()`);
            await driver.wait(async () => (await driver.findElements(By.id('macInterfaceLanguage'))).length > 0, 5000);
            await driver.findElement(By.css(`#macInterfaceLanguage option[value="${locale}"]`)).click();
            await driver.wait(async () => await driver.executeScript('return document.documentElement.lang===arguments[0]', locale), 5000);
            await driver.executeScript(`document.querySelector('[data-menu="appearance"]').click()`);
            await driver.wait(async () => (await driver.findElements(By.id('macBgSource'))).length > 0, 5000);
            const choices = await driver.executeScript(`return [...document.querySelector('#macBgSource').options].map(o=>o.value);`);
            assert.deepEqual(choices, ['files', 'wallhaven', 'pexels', 'bing']);
            await driver.findElement(By.css('#macBgSource option[value="wallhaven"]')).click();
            await driver.wait(async () => await driver.findElement(By.id('macWallhavenUsername')).isDisplayed(), 5000);
            assert.ok((await driver.findElement(By.css('[data-i18n="wallhavenCollectionHint"]')).getText()).includes('SFW'));
            const bounds = await driver.executeScript(`const key=document.getElementById('macWallhavenApiKey').getBoundingClientRect(); const row=document.getElementById('macWallhavenApiRow').getBoundingClientRect(); return {width:key.width,right:key.right,rowRight:row.right};`);
            assert.ok(bounds.width > 100 && bounds.right <= bounds.rowRight, JSON.stringify(bounds));
            await writeFile(path.join(evidence, `wallhaven-${locale}.png`), await driver.takeScreenshot(), 'base64');
            await closeSettings();
        });
    }
    if (!process.argv.includes('--wallhaven-live')) return;
    await driver.manage().setTimeouts({ script: 30000 });
    await check('Wallhaven live public collection through UI, uploader and favorite metadata', async () => {
        await openSettings();
        await driver.executeScript(`document.querySelector('[data-menu="appearance"]').click()`);
        await driver.wait(async () => (await driver.findElements(By.id('macWallhavenUsername'))).length > 0, 5000);
        await driver.findElement(By.id('macWallhavenUsername')).sendKeys('havenwall');
        await driver.findElement(By.id('macWallhavenCollectionId')).sendKeys('16063');
        await driver.findElement(By.id('macWallhavenApply')).click();
        await closeSettings();
        await driver.wait(async () => await driver.executeScript(`return document.getElementById('authorName').textContent.startsWith('Uploaded by ');`), 60000);
        const state = await run(`const settings=(await chrome.storage.sync.get('backgroundSettings')).backgroundSettings;
            const photo=(await chrome.storage.local.get('currentBackground')).currentBackground;
            return {collection:settings.wallhaven,invalidKey:Object.hasOwn(settings.apiKeys,'undefined'),photo};`);
        assert.deepEqual(state.collection, { username: 'havenwall', collectionId: '16063' });
        assert.equal(state.invalidKey, false);
        assert.equal(state.photo.provider, 'wallhaven');
        assert.equal(await driver.findElement(By.id('authorName')).getText(), `Uploaded by ${state.photo.username}`);
        assert.equal(await driver.findElement(By.id('photoAuthor')).getText(), `Uploaded by ${state.photo.username}`);
        await driver.findElement(By.id('favoriteBgBtn')).click();
        await driver.wait(async () => await run(`return Boolean((await chrome.storage.local.get('libraryItems')).libraryItems?.[arguments[0]]);`, state.photo.id), 15000);
        const favorite = await run(`return (await chrome.storage.local.get('libraryItems')).libraryItems[arguments[0]];`, state.photo.id);
        assert.equal(favorite.username, state.photo.username);
        assert.equal(favorite.page, `https://wallhaven.cc/w/${state.photo.id}`);
        await writeFile(path.join(evidence, 'wallhaven-live.json'), JSON.stringify({ id: state.photo.id, collection: state.collection, uploader: state.photo.username, page: favorite.page }, null, 2));
        await driver.wait(async () => await driver.executeScript(`return !document.getElementById('background-wrapper').getAnimations({subtree:true}).some(animation=>animation.playState==='running');`), 5000);
        await writeFile(path.join(evidence, 'wallhaven-uploader.png'), await driver.takeScreenshot(), 'base64');
        await run(`const {backgroundSettings}=await chrome.storage.sync.get('backgroundSettings'); await chrome.storage.sync.set({backgroundSettings:{...backgroundSettings,type:'files',frequency:'never'}});`);
    });
}
