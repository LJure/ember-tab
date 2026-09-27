// Keep the deadline active through body consumption, and stop oversized streams
// before buffering the entire response in the extension process.
export async function fetchLimited(url, accept, maxBytes, timeoutMs = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'GET', credentials: 'omit', headers: { Accept: accept }, signal: controller.signal
        });
        if (!response.ok) { controller.abort(); return { ok: false, error: `HTTP ${response.status}` }; }
        if (Number(response.headers.get('content-length') || 0) > maxBytes) {
            controller.abort();
            return { ok: false, error: 'Response too large' };
        }
        const chunks = [];
        let length = 0;
        const reader = response.body?.getReader();
        if (reader) {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    length += value.byteLength;
                    if (length > maxBytes) {
                        controller.abort();
                        return { ok: false, error: 'Response too large' };
                    }
                    chunks.push(value);
                }
            } finally {
                reader.releaseLock();
            }
        } else {
            const data = new Uint8Array(await response.arrayBuffer());
            length = data.byteLength;
            if (length > maxBytes) return { ok: false, error: 'Response too large' };
            chunks.push(data);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return { ok: true, bytes: Array.from(bytes), contentType: response.headers.get('content-type') || '', finalUrl: response.url || url };
    } catch (error) {
        return { ok: false, error: controller.signal.aborted ? 'Request timed out' : String(error) };
    } finally {
        clearTimeout(timer);
    }
}
