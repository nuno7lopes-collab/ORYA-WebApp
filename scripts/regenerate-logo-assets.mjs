import path from "node:path";
import sharp from "sharp";

const sourceArg = process.argv[2] || "public/brand/orya app logo.png";
const src = path.resolve(sourceArg);
const bg = "#0b101a";

async function makeTransparentIcon(outPath, size) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
}

async function makePaddedTransparent(outPath, size, ratio) {
  const inner = Math.round(size * ratio);
  const logo = await sharp(src)
    .trim()
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

async function makePaddedSolid(outPath, size, ratio, hex) {
  const inner = Math.round(size * ratio);
  const logo = await sharp(src)
    .trim()
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: hex,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

await makeTransparentIcon("public/brand/orya-logo.png", 800);
await makeTransparentIcon("public/brand/orya-logo-56.png", 56);
await makeTransparentIcon("public/brand/orya-logo-112.png", 112);
await makeTransparentIcon("public/brand/orya-logo-180.png", 180);
await makeTransparentIcon("public/brand/orya-logo-192.png", 192);
await makeTransparentIcon("public/brand/orya-logo-512.png", 512);

await makePaddedSolid("apps/mobile/assets/icon.png", 1024, 0.76, bg);
await makePaddedTransparent("apps/mobile/assets/adaptive-icon.png", 1024, 0.68);
await makePaddedTransparent("apps/mobile/assets/splash-icon.png", 1024, 0.54);
await makeTransparentIcon("apps/mobile/assets/favicon.png", 48);

console.log(`Logo assets regenerated from: ${src}`);
