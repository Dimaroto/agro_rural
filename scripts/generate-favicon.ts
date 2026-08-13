/**
 * Gera favicon e ícones PWA a partir de uma imagem (fundo preto → transparente).
 * Uso: npx tsx scripts/generate-favicon.ts <caminho-da-imagem>
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..");

async function toTransparentLogo(input: Buffer) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  const out = Buffer.from(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const isDark = r < 20 && g < 20 && b < 20;
      if (isDark) {
        out[i + 3] = 0;
      } else {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.08);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const side = Math.max(cropW, cropH);
  const left = Math.max(0, Math.floor(minX - (side - cropW) / 2));
  const top = Math.max(0, Math.floor(minY - (side - cropH) / 2));
  const extractW = Math.min(side, width - left);
  const extractH = Math.min(side, height - top);

  return sharp(out, {
    raw: { width, height, channels: 4 },
  })
    .extract({ left, top, width: extractW, height: extractH })
    .resize(side, side, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function buildIco(pngBuffers: Buffer[]) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  for (const buf of pngBuffers) offset += buf.length;

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);

  let o = 6;
  let dataOffset = headerSize;
  for (let i = 0; i < count; i++) {
    const w = pngBuffers[i].readUInt32BE(16);
    const h = pngBuffers[i].readUInt32BE(20);
    out.writeUInt8(w > 255 ? 0 : w, o);
    out.writeUInt8(h > 255 ? 0 : h, o + 1);
    out.writeUInt8(0, o + 2);
    out.writeUInt8(0, o + 3);
    out.writeUInt16LE(1, o + 4);
    out.writeUInt16LE(32, o + 6);
    out.writeUInt32LE(pngBuffers[i].length, o + 8);
    out.writeUInt32LE(dataOffset, o + 12);
    o += 16;
    dataOffset += pngBuffers[i].length;
  }

  let pos = headerSize;
  for (const buf of pngBuffers) {
    buf.copy(out, pos);
    pos += buf.length;
  }
  return out;
}

async function writePng(base: Buffer, dest: string, size: number) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await sharp(base)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(dest);
  console.log("wrote", path.relative(ROOT, dest));
}

async function main() {
  const srcArg = process.argv[2];
  if (!srcArg) {
    throw new Error("Informe o caminho da imagem.");
  }
  const src = path.resolve(srcArg);
  if (!fs.existsSync(src)) {
    throw new Error(`Arquivo não encontrado: ${src}`);
  }

  const input = await fs.promises.readFile(src);
  const base = await toTransparentLogo(input);

  await fs.promises.mkdir(path.join(ROOT, "public", "brand"), {
    recursive: true,
  });
  await fs.promises.copyFile(src, path.join(ROOT, "public", "brand", "logo-source.png"));
  await fs.promises.writeFile(
    path.join(ROOT, "public", "brand", "favicon-source.png"),
    base
  );

  await writePng(base, path.join(ROOT, "app", "icon.png"), 512);
  await writePng(base, path.join(ROOT, "app", "apple-icon.png"), 180);
  await writePng(base, path.join(ROOT, "public", "icons", "icon-192.png"), 192);
  await writePng(base, path.join(ROOT, "public", "icons", "icon-512.png"), 512);
  await writePng(base, path.join(ROOT, "public", "favicon.png"), 32);

  const icoPngs = await Promise.all(
    [16, 32, 48].map((s) =>
      sharp(base)
        .resize(s, s, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
    )
  );
  const icoPath = path.join(ROOT, "app", "favicon.ico");
  await fs.promises.writeFile(icoPath, buildIco(icoPngs));
  console.log("wrote", path.relative(ROOT, icoPath));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
