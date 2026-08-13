import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brandDir = join(__dirname, "..", "public", "brand");
const source = join(brandDir, "saboart-source.png");
const output = join(brandDir, "saboart-wordmark.png");

if (!existsSync(source)) {
  console.error("Arquivo não encontrado: public/brand/saboart-source.png");
  process.exit(1);
}

mkdirSync(brandDir, { recursive: true });

const meta = await sharp(source).metadata();
const width = meta.width ?? 1024;
const height = meta.height ?? 1024;

function removeBlack(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 45 && g < 45 && b < 45) data[i + 3] = 0;
  }
}

/** Remove o ramo na faixa central superior (entre "Sabo" e "Art") */
function removeBranchStrokes(data, w, h) {
  const topZone = Math.floor(h * 0.26);
  const xStart = Math.floor(w * 0.28);
  const xEnd = Math.floor(w * 0.74);

  for (let y = 0; y < topZone; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const idx = (y * w + x) * 4;
      data[idx + 3] = 0;
    }
  }
}

const { data, info } = await sharp(source)
  .extract({
    left: Math.round(width * 0.04),
    top: Math.round(height * 0.04),
    width: Math.min(Math.round(width * 0.66), width - Math.round(width * 0.04)),
    height: Math.min(Math.round(height * 0.56), height - Math.round(height * 0.04)),
  })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

removeBlack(data);

const clusterBuf = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 8 })
  .png()
  .toBuffer();

const clusterMeta = await sharp(clusterBuf).metadata();
const cw = clusterMeta.width;
const ch = clusterMeta.height;

const { data: clusterData } = await sharp(clusterBuf)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const top = Math.round(ch * 0.18);
const textHeight = Math.min(Math.round(ch * 0.6), ch - top);
const left = 0;
const textWidth = cw;

const textBuf = await sharp(clusterData, {
  raw: { width: cw, height: ch, channels: 4 },
})
  .extract({ left, top, width: textWidth, height: textHeight })
  .png()
  .toBuffer();

const textMeta = await sharp(textBuf).metadata();
const { data: textData } = await sharp(textBuf)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

removeBranchStrokes(textData, textMeta.width, textMeta.height);

const cutBottom = Math.round(textMeta.height * 0.08);

await sharp(textData, {
  raw: { width: textMeta.width, height: textMeta.height, channels: 4 },
})
  .extract({
    left: 0,
    top: 0,
    width: textMeta.width,
    height: Math.max(1, textMeta.height - cutBottom),
  })
  .trim({ threshold: 8 })
  .extend({
    top: 16,
    bottom: 14,
    left: 22,
    right: 14,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(output);

const out = await sharp(output).metadata();
console.log(`Wordmark gerado: ${output} (${out.width}x${out.height})`);
