// Optional authoring tool. Normal builds use the checked-in rendered assets.
// Pass the path to sharp's module entry (sharp 0.35.4 used for these exports).
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { default: sharp } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'sharp');
const root = new URL('../', import.meta.url);
const svg = name => readFile(new URL(`assets/brand/${name}.svg`, root));
for (const size of [16, 48, 128]) {
    await writeFile(new URL(`assets/icons/icon${size}.png`, root), await sharp(await svg('ember')).resize(size, size).png().toBuffer());
}
for (const name of ['photo', 'setting']) {
    await writeFile(new URL(`assets/icons/${name}.jpg`, root), await sharp(await svg(name)).resize(256, 256).jpeg({ quality: 95 }).toBuffer());
}
await writeFile(new URL('assets/backgrounds/Background1.jpg', root), await sharp(await svg('background')).jpeg({ quality: 90 }).toBuffer());
