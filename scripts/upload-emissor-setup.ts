/**
 * Publica installer/output/AgroRural-Setup-*.exe no Vercel Blob
 * e imprime a URL para EMISSOR_SETUP_URL.
 *
 * Uso:
 *   npm run env:pull
 *   npx tsx scripts/upload-emissor-setup.ts
 */
import { config as loadEnv } from "dotenv";
import { put } from "@vercel/blob";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

loadEnv({ path: ".env.production.local" });
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const OUTPUT_DIR = path.join(process.cwd(), "installer", "output");
const BLOB_EXE = "emissor/AgroRural-Setup.exe";
const BLOB_META = "emissor/setup.json";

async function findLatestSetup(): Promise<string> {
  const names = await readdir(OUTPUT_DIR).catch(() => [] as string[]);
  const exes = names.filter((n) => /^AgroRural-Setup-.*\.exe$/i.test(n));
  if (exes.length === 0) {
    throw new Error(
      `Nenhum AgroRural-Setup-*.exe em ${OUTPUT_DIR}. Gere com installer\\build-windows.ps1`
    );
  }
  const ranked = await Promise.all(
    exes.map(async (name) => {
      const full = path.join(OUTPUT_DIR, name);
      const info = await stat(full);
      return { full, name, mtime: info.mtimeMs, size: info.size };
    })
  );
  ranked.sort((a, b) => b.mtime - a.mtime);
  return ranked[0].full;
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN ausente. Rode npm run env:pull ou defina o token."
    );
  }

  const filePath = process.argv[2] || (await findLatestSetup());
  const buf = await readFile(filePath);
  const fileName = path.basename(filePath);
  console.log(`Enviando ${fileName} (${(buf.length / 1e6).toFixed(1)} MB) ...`);

  const blob = await put(BLOB_EXE, buf, {
    access: "public",
    token,
    allowOverwrite: true,
    contentType: "application/octet-stream",
    addRandomSuffix: false,
  });

  const meta = await put(
    BLOB_META,
    JSON.stringify(
      {
        url: blob.url,
        fileName,
        bytes: buf.length,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    {
      access: "public",
      token,
      allowOverwrite: true,
      contentType: "application/json",
      addRandomSuffix: false,
    }
  );

  console.log("");
  console.log("OK. URL do Setup:");
  console.log(blob.url);
  console.log("Meta:", meta.url);
  console.log("");
  console.log("No projeto Vercel (producao), defina:");
  console.log(`  EMISSOR_SETUP_URL=${blob.url}`);
  console.log("  (ou NEXT_PUBLIC_EMISSOR_SETUP_URL com o mesmo valor)");
  console.log("");
  console.log(
    "Exemplo: npx vercel env add EMISSOR_SETUP_URL production"
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
