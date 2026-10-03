import { buildExtension } from './build-extension.mjs';

console.log(JSON.stringify(await buildExtension('firefox', {
    release: process.argv.includes('--release'),
    testHttp: process.argv.includes('--test-http')
}), null, 2));
