// Normal Firefox packages never send requests to plaintext remote servers.
// An explicit integration-test package may opt into loopback HTTP only.
export function isSecureServiceUrl(value) {
    try {
        const url = new URL(value);
        if (url.username || url.password) return false;
        if (url.protocol === 'https:') return true;
        if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) return false;
        const origins = globalThis.chrome?.runtime?.getManifest?.().host_permissions || [];
        return origins.includes(`http://${url.hostname}/*`);
    } catch {
        return false;
    }
}
