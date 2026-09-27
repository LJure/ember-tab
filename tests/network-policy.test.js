import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSecureServiceUrl } from '../scripts/shared/network-policy.js';
import { WebDAVClient } from '../scripts/shared/webdav-client.js';

afterEach(() => vi.restoreAllMocks());
describe('WebDAV transport boundary', () => {
    it('rejects remote plaintext and embedded credentials before network access', () => {
        for (const baseUrl of ['http://dav.example.test', 'https://user:secret@dav.example.test', 'file:///backup', 'http://localhost.evil.test']) {
            expect(isSecureServiceUrl(baseUrl)).toBe(false);
            expect(() => new WebDAVClient({baseUrl})).toThrow(/HTTPS/);
        }
        expect(isSecureServiceUrl('https://dav.example.test/path')).toBe(true);
    });
    it('allows loopback only in an explicitly declared test package', () => {
        chrome.runtime.getManifest = vi.fn().mockReturnValue({host_permissions:['https://*/*']});
        expect(isSecureServiceUrl('http://127.0.0.1:8080')).toBe(false);
        chrome.runtime.getManifest.mockReturnValue({host_permissions:['http://127.0.0.1/*']});
        expect(isSecureServiceUrl('http://127.0.0.1:8080')).toBe(true);
        expect(isSecureServiceUrl('http://example.test')).toBe(false);
    });
});
