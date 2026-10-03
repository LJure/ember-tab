import { createHash, createPublicKey } from 'node:crypto';

export function chromeIdentity(project) {
    const key = project.chromePublicKey;
    if (typeof key !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(key)) {
        throw new Error('Chrome public key must be canonical base64 SPKI');
    }
    const der = Buffer.from(key, 'base64');
    const publicKey = createPublicKey({ key: der, type: 'spki', format: 'der' });
    if (publicKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyDetails.modulusLength < 2048 ||
        publicKey.export({ type: 'spki', format: 'der' }).toString('base64') !== key) {
        throw new Error('Chrome public key must be an RSA SPKI key of at least 2048 bits');
    }
    const id = createHash('sha256').update(der).digest('hex').slice(0, 32)
        .replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
    if (project.chromeId !== id) throw new Error('Chrome ID does not match the configured public key');
    return { key, id };
}
