import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { By } from 'selenium-webdriver';

export async function testIconChooser({ driver, run, check, origin, evidence }) {
    const url = origin + '/choices';
    const click = async selector => {
        const button = await driver.findElement(By.css(selector));
        await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', button);
        await button.click();
    };
    const item = await run(`const {store}=await import('./scripts/domains/quicklinks/store.js');return store.addItem({title:'Icon chooser test',url:arguments[0],icon:''});`, url);
    const changelogClose = await driver.findElements(By.css('.changelog-open .changelog-btn-close'));
    if (changelogClose.length) await changelogClose[0].click();
    const read = () => run(`const {iconCache}=await import('./scripts/platform/icon-cache.js');const {buildIconCacheKey}=await import('./scripts/shared/text.js');await iconCache.init();const e=await iconCache.get(buildIconCacheKey(arguments[0]));return e?{width:e.width,source:e.sourceUrl,userSelected:e.userSelected}:null;`, url);
    const open = async () => {
        await run('window.dispatchEvent(new CustomEvent("quicklink:edit",{detail:{item:arguments[0]}}));', item);
        await driver.wait(async () => await driver.findElement(By.id('quicklinkChooseIconBtn')).isDisplayed(), 5000);
    };
    try {
        await check('manual icon candidates apply exact choice without changing the shortcut URL', async () => {
            await open(); await click('#quicklinkChooseIconBtn');
            await driver.wait(async () => await driver.findElement(By.id('quicklinkChooseIconBtn')).isEnabled() && (await driver.findElements(By.css('.quicklink-icon-candidate'))).length >= 2, 15000);
            const candidates = await run('return Array.from(document.querySelectorAll(".quicklink-icon-candidate")).map(b=>({label:b.textContent,size:b.querySelector("small").textContent}));');
            assert.equal(candidates.filter(x => x.size === '32 × 32').length, 1);
            const geometry = await run('const panel=document.getElementById("quicklinkIconCandidates");const list=document.getElementById("quicklinkIconCandidatesList");return {panel:panel.getBoundingClientRect().width,dialog:document.querySelector(".quicklink-dialog").getBoundingClientRect().width,overflow:list.scrollWidth-list.clientWidth};');
            assert(geometry.panel > geometry.dialog * 0.7, 'Candidate panel should span the editor width');
            assert(geometry.overflow <= 1, 'Candidates should not create horizontal overflow');
            await driver.wait(async () => await run('return document.getAnimations({subtree:true}).length === 0;'), 5000);
            await writeFile(path.join(evidence, 'icon-chooser.png'), Buffer.from(await driver.takeScreenshot(), 'base64'));
            const buttons = await driver.findElements(By.css('.quicklink-icon-candidate'));
            const target = buttons[candidates.findIndex(x => x.size === '32 × 32')];
            await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', target);
            await target.click();
            await driver.wait(async () => (await read())?.userSelected, 5000);
            const choice = await read();
            assert.equal(choice.width, 32); assert.equal(choice.source, origin + '/choice-small.png');
            assert.equal(await driver.findElement(By.id('quicklinkUrlInput')).getAttribute('value'), url);
        });
        await check('chosen icon survives link save and page reload; browsing or closing does not replace it', async () => {
            await click('#quicklinkSaveBtn');
            await driver.wait(async () => !(await driver.findElement(By.id('quicklinkDialogOverlay')).isDisplayed()), 5000);
            await driver.navigate().refresh();
            await driver.wait(async () => await driver.findElement(By.id('quicklinksAddBtn')).isDisplayed(), 10000);
            assert.equal((await read()).userSelected, true); assert.equal((await read()).width, 32);
            await open(); await click('#quicklinkChooseIconBtn');
            await driver.wait(async () => await driver.findElement(By.id('quicklinkChooseIconBtn')).isEnabled(), 15000);
            await click('#quicklinkCancelBtn');
            assert.equal((await read()).userSelected, true); assert.equal((await read()).width, 32);
        });
        await check('explicit icon refresh restores automatic choice and clears the manual preference', async () => {
            await open(); await click('#quicklinkRefreshIconBtn');
            await driver.wait(async () => await driver.findElement(By.id('quicklinkRefreshIconBtn')).isEnabled(), 15000);
            const refreshed = await read();
            assert.equal(refreshed.userSelected, false); assert.equal(refreshed.source, origin + '/choice-vector.svg');
            await click('#quicklinkCancelBtn');
        });
    } finally {
        await run('const {store}=await import("./scripts/domains/quicklinks/store.js");await store.deleteItem(arguments[0]);', item._id);
    }
}
