import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  detectImageMimeType,
  extensionForImageMime,
} from "@/lib/image-magic-bytes";
import { resolvePublicErrorMessage } from "@/lib/public-api-error";
import { uploadImageFile } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }

    const maxSize = 4.5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "A imagem deve ter no máximo 4,5 MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentType = detectImageMimeType(buffer);
    if (!contentType) {
      return NextResponse.json(
        {
          error:
            "Formato inválido. Use JPG, PNG, WebP ou GIF. Fotos HEIC do iPhone precisam ser convertidas antes.",
        },
        { status: 400 }
      );
    }

    const ext = extensionForImageMime(contentType);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const url = await uploadImageFile({
      buffer,
      filename,
      contentType,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json(
      {
        error:
          resolvePublicErrorMessage(
            err,
            "Erro ao enviar a foto. Tente novamente."
          ),
      },
      { status: 500 }
    );
  }
}
