import { db, type Photo } from "../../db/db";
import { getOriginalFile } from "../files";
import { decode, resizeToBlob } from "../images";
import { DEFAULT_ADJUSTMENTS, type Adjustments } from "./adjustments";
import { ColorRenderer, renderFull } from "./renderer";

export type ExportFormat = "image/jpeg" | "image/png" | "image/webp";

export interface ExportSettings {
  format: ExportFormat;
  /** Lado maior em pixels; 0 = tamanho original. */
  maxSide: number;
  quality: number; // 0..1
}

export const FORMAT_EXT: Record<ExportFormat, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function exportName(photo: Photo, format: ExportFormat) {
  return `${photo.fileName.replace(/\.[^.]+$/, "")}-lumina.${FORMAT_EXT[format]}`;
}

/** Bitmap do original, reduzido se exceder o limite de textura da GPU. */
export async function loadSource(photo: Photo, renderer: ColorRenderer, maxSide = Infinity): Promise<ImageBitmap> {
  const file = await getOriginalFile(photo);
  const bitmap = await decode(file);
  const limit = Math.min(maxSide, renderer.maxTextureSize);
  if (Math.max(bitmap.width, bitmap.height) <= limit) return bitmap;
  const scale = limit / Math.max(bitmap.width, bitmap.height);
  const resized = await createImageBitmap(bitmap, {
    resizeWidth: Math.round(bitmap.width * scale),
    resizeHeight: Math.round(bitmap.height * scale),
    resizeQuality: "high",
  });
  bitmap.close();
  return resized;
}

/**
 * RF-49: renderiza a foto com as edições e codifica no formato escolhido.
 * Reencodar pelo canvas remove EXIF/GPS do arquivo exportado.
 */
export async function exportPhoto(photo: Photo, settings: ExportSettings, adjustments?: Adjustments): Promise<Blob> {
  const a = adjustments ?? (await db.edits.get(photo.id))?.adjustments ?? DEFAULT_ADJUSTMENTS;
  const renderer = new ColorRenderer();
  try {
    const src = await loadSource(photo, renderer);
    const out = renderFull(renderer, src, a);
    src.close();
    if (settings.maxSide && Math.max(out.width, out.height) > settings.maxSide) {
      return resizeToBlob(out, settings.maxSide, settings.format, settings.quality);
    }
    return out.convertToBlob({ type: settings.format, quality: settings.quality });
  } finally {
    renderer.dispose();
  }
}
