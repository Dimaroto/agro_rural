import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PublicApiError } from "./public-api-error";

type UploadImageInput = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

/**
 * Produção (Vercel): Vercel Blob (token ou OIDC).
 * Local / HostGator: pasta public/uploads.
 */
export async function uploadImageFile({
  buffer,
  filename,
  contentType,
}: UploadImageInput): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
  const useBlob = Boolean(token) || isVercelRuntime();

  if (useBlob) {
    try {
      const blob = await put(`uploads/${filename}`, buffer, {
        access: "public",
        contentType,
        ...(token ? { token } : {}),
      });
      return blob.url;
    } catch (err) {
      logBlobUploadFailure(err);
      throw new PublicApiError(
        "Falha ao enviar imagem. Tente novamente ou contate o suporte."
      );
    }
  }

  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    logBlobUploadFailure(err);
    throw new PublicApiError(
      "Não foi possível salvar a imagem. Verifique permissões de escrita."
    );
  }
}

function logBlobUploadFailure(err: unknown) {
  console.error("[upload]", err);
}
