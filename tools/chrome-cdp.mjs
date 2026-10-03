import { By } from 'selenium-webdriver';

export async function enableDeveloperMode(driver) {
    await driver.get('chrome://extensions/');
    await driver.wait(async()=>await driver.executeScript('return !!document.querySelector("extensions-manager")?.shadowRoot?.querySelector("extensions-toolbar")?.shadowRoot?.querySelector("#devMode");'),10000);
    const manager=await (await driver.findElement(By.css('extensions-manager'))).getShadowRoot();
    const toolbar=await (await manager.findElement(By.css('extensions-toolbar'))).getShadowRoot();
    const toggle=await toolbar.findElement(By.css('#devMode'));
    const wasEnabled=await toggle.getAttribute('aria-checked')==='true';
    if(!wasEnabled) await toggle.click();
    await driver.wait(async()=>await toggle.getAttribute('aria-checked')==='true',5000);
    return wasEnabled;
}

// Browser-scope CDP is required for Extensions.loadUnpacked and worker inspection.
export async function connectCdp(address) {
    const { webSocketDebuggerUrl } = await (await fetch('http://' + address + '/json/version')).json();
    const socket = new WebSocket(webSocketDebuggerUrl);
    const pending = new Map(), events = [], handlers = new Map();
    let nextId = 0;
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const { resolve, reject, timer } = pending.get(message.id);
            clearTimeout(timer); pending.delete(message.id);
            if (message.error) reject(new Error(JSON.stringify(message.error)));
            else resolve(message.result);
        } else if (message.method) {
            events.push(message); handlers.get(message.method)?.(message);
        }
    });
    return {
        events,
        onEvent(method, handler) { handlers.set(method, handler); },
        command(method, params = {}, sessionId) {
            return new Promise((resolve, reject) => {
                const id = ++nextId;
                const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
                pending.set(id, { resolve, reject, timer });
                socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
            });
        },
        close() { socket.close(); }
    };
}
