const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '..', 'apps', 'web', 'public', 'assets', 'marketing', 'educore-poster.svg');

(async () => {
  const targets = [
    { suffix: '-1080x1350', width: 1080 },
    { suffix: '-2160x2700', width: 2160 },
  ];
  for (const t of targets) {
    const out = src.replace(/\.svg$/, `${t.suffix}.png`);
    await sharp(src, { density: 384 })
      .resize({ width: t.width })
      .png({ quality: 92, compressionLevel: 9 })
      .toFile(out);
    const meta = await sharp(out).metadata();
    console.log(`${path.basename(out)}  ${meta.width}x${meta.height}  ${require('fs').statSync(out).size} bytes`);
  }
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});