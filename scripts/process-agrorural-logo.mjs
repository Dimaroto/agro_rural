import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brandDir = join(__dirname, "..", "public", "brand");
const input = join(brandDir, "agrorural-logo-source.png");
const output = join(brandDir, "agrorural-logo.png");

mkdirSync(brandDir, { recursive: true });

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const isBlack = max < 50 && max - min < 20;
  if (isBlack) data[i + 3] = 0;
}

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 8 })
  .png()
  .toFile(output);

const meta = await sharp(output).metadata();
console.log(`Logo gerada: ${output} (${meta.width}x${meta.height})`);
