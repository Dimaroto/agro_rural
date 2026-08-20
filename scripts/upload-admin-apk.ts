/**
 * Publica o APK Android no Vercel Blob.
 *
 * Uso:
 *   npx tsx scripts/upload-admin-apk.ts
 *   npx tsx scripts/upload-admin-apk.ts caminho/arquivo.apk
 */
import { config as loadEnv } from "dotenv";
import { put } from "@vercel/blob";
import { readFile, stat } from "fs/promises";
import path from "path";

loadEnv({ path: ".env.production.local" });
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const DEFAULT_APK = path.join(
  process.cwd(),
  "public",
  "downloads",
  "AgroRural-Admin.apk"
);
const BLOB_APK = "admin/AgroRural-Admin.apk";
const BLOB_META = "admin/apk.json";

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN ausente. Rode npm run env:pull ou defina o token."
    );
  }

  const filePath = process.argv[2] || DEFAULT_APK;
  const info = await stat(filePath);
  const buf = await readFile(filePath);
  const fileName = path.basename(filePath);
  console.log(`Enviando ${fileName} (${(info.size / 1e6).toFixed(1)} MB) ...`);

  const blob = await put(BLOB_APK, buf, {
    access: "public",
    token,
    allowOverwrite: true,
    contentType: "application/vnd.android.package-archive",
    addRandomSuffix: false,
  });

  const meta = await put(
    BLOB_META,
    JSON.stringify(
      {
        url: blob.url,
        fileName,
        bytes: info.size,
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
  console.log("OK. URL do APK:");
  console.log(blob.url);
  console.log("Meta:", meta.url);
  console.log("");
  console.log("Defina na Vercel / .env:");
  console.log(`  NEXT_PUBLIC_ADMIN_APK_URL=${blob.url}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
