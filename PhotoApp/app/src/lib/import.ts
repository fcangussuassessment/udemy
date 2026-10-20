import exifr from "exifr";
import { db, type Photo } from "../db/db";
import { useApp, toast, errorMessage } from "../store";
import { decode, resizeToBlob, sha256 } from "./images";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;
const THUMB_SIDE = 480;
const CONCURRENCY = 4;

interface Candidate {
  file: File;
  relativePath: string;
  folderId?: number;
  /** Guardar o original no navegador (importação sem acesso à pasta). */
  storeBlob: boolean;
}

async function* walk(dir: FileSystemDirectoryHandle, prefix = ""): AsyncGenerator<{ file: File; path: string }> {
  for await (const entry of dir.values()) {
    if (entry.name.startsWith(".")) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") yield* walk(entry as FileSystemDirectoryHandle, path);
    else if (IMAGE_EXT.test(entry.name)) yield { file: await (entry as FileSystemFileHandle).getFile(), path };
  }
}

/** RF-01: escolhe uma pasta do disco e importa recursivamente. */
export async function importFolder() {
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await window.showDirectoryPicker({ id: "lumina-library", mode: "read" });
  } catch {
    return; // usuário cancelou
  }
  const existing = (await db.folders.toArray()).find((f) => f.name === handle.name && !f.handle);
  let folderId: number;
  if (existing) {
    // Reconecta uma pasta restaurada de backup.
    await db.folders.update(existing.id, { handle });
    folderId = existing.id;
  } else {
    const same = await findSameFolder(handle);
    folderId = same ?? (await db.folders.add({ name: handle.name, handle }));
  }
  await scanFolder(folderId);
}

async function findSameFolder(handle: FileSystemDirectoryHandle) {
  for (const f of await db.folders.toArray()) {
    if (f.handle && (await f.handle.isSameEntry(handle))) return f.id;
  }
  return undefined;
}

/** RF-07: varre (de novo) uma pasta já cadastrada, adicionando arquivos novos. */
export async function scanFolder(folderId: number) {
  const folder = await db.folders.get(folderId);
  if (!folder?.handle) return;
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  try {
    for await (const { file, path } of walk(folder.handle)) {
      seen.add(path);
      candidates.push({ file, relativePath: path, folderId, storeBlob: false });
    }
  } catch (err) {
    toast(`Erro ao ler a pasta: ${errorMessage(err)}`, "error");
    return;
  }
  // Fotos cujo arquivo sumiu do disco vão para a lixeira do catálogo.
  const known = await db.photos.where("folderId").equals(folderId).toArray();
  const missing = known.filter((p) => !seen.has(p.relativePath) && !p.deletedAt);
  if (missing.length) {
    await db.photos.bulkUpdate(missing.map((p) => ({ key: p.id, changes: { deletedAt: Date.now() } })));
  }
  const knownPaths = new Set(known.map((p) => p.relativePath));
  await regenerateMissingThumbs(known.filter((p) => seen.has(p.relativePath)), candidates);
  await importCandidates(candidates.filter((c) => !knownPaths.has(c.relativePath)));
  await db.folders.update(folderId, { lastScannedAt: Date.now() });
}

/**
 * Arrastar e soltar: pastas viram pastas da biblioteca (quando suportado);
 * arquivos soltos são copiados para o navegador.
 */
export async function importDropped(dt: DataTransfer) {
  // Os handles precisam ser obtidos de forma síncrona, ainda dentro do evento de drop.
  const items = [...dt.items].filter((i) => i.kind === "file");
  const handles = items.map((i) => ("getAsFileSystemHandle" in i ? i.getAsFileSystemHandle() : null));
  const files = items.map((i) => i.getAsFile());
  const loose: File[] = [];
  for (let n = 0; n < items.length; n++) {
    const handle = await handles[n]?.catch(() => null);
    if (handle?.kind === "directory") {
      const dir = handle as FileSystemDirectoryHandle;
      const folderId = (await findSameFolder(dir)) ?? (await db.folders.add({ name: dir.name, handle: dir }));
      await scanFolder(folderId);
    } else if (files[n]) {
      loose.push(files[n]!);
    }
  }
  if (loose.length) await importFiles(loose);
}

/** Após restaurar um backup, as miniaturas são recriadas a partir dos originais. */
async function regenerateMissingThumbs(photos: Photo[], candidates: Candidate[]) {
  const have = new Set((await db.thumbs.bulkGet(photos.map((p) => p.id))).filter(Boolean).map((t) => t!.photoId));
  const byPath = new Map(candidates.map((c) => [c.relativePath, c.file]));
  for (const p of photos) {
    if (have.has(p.id)) continue;
    const file = byPath.get(p.relativePath);
    if (!file) continue;
    try {
      const bitmap = await decode(file);
      await db.thumbs.put({ photoId: p.id, original: await resizeToBlob(bitmap, THUMB_SIDE) });
      bitmap.close();
    } catch {
      /* arquivo ilegível */
    }
  }
}

/** RF-02: arquivos soltos (arrastar e soltar ou seletor) são copiados para o navegador. */
export async function importFiles(files: File[]) {
  const images = files.filter((f) => IMAGE_EXT.test(f.name) || f.type.startsWith("image/"));
  if (!images.length) {
    toast("Nenhuma imagem encontrada nos arquivos selecionados.", "error");
    return;
  }
  await importCandidates(
    images.map((file) => ({ file, relativePath: file.webkitRelativePath || file.name, storeBlob: true })),
  );
}

async function importCandidates(candidates: Candidate[]) {
  const { setImportProgress } = useApp.getState();
  const progress = { total: candidates.length, done: 0, added: 0, skipped: 0, cancelled: false };
  if (!candidates.length) {
    toast("Nenhuma foto nova encontrada.");
    return;
  }
  setImportProgress({ ...progress });
  const queue = [...candidates];

  const worker = async () => {
    while (queue.length && !useApp.getState().importProgress?.cancelled) {
      const c = queue.shift()!;
      try {
        (await importOne(c)) ? progress.added++ : progress.skipped++;
      } catch (err) {
        progress.skipped++;
        console.warn("Falha ao importar", c.relativePath, err);
      }
      progress.done++;
      const current = useApp.getState().importProgress;
      setImportProgress({ ...progress, cancelled: current?.cancelled ?? false });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const cancelled = useApp.getState().importProgress?.cancelled;
  setImportProgress(null);
  toast(
    `${cancelled ? "Importação cancelada. " : ""}${progress.added} foto(s) importada(s)` +
      (progress.skipped ? `, ${progress.skipped} ignorada(s) (duplicadas ou ilegíveis).` : "."),
    "success",
  );
}

async function importOne(c: Candidate): Promise<boolean> {
  const hash = await sha256(c.file);
  const dup = await db.photos.where("sha256").equals(hash).first();
  if (dup) {
    // Se a duplicata estava na lixeira por ter sumido do disco, ela "voltou".
    if (dup.deletedAt && dup.folderId === c.folderId && dup.relativePath === c.relativePath) {
      await db.photos.update(dup.id, { deletedAt: undefined });
    }
    return false;
  }

  const bitmap = await decode(c.file);
  const thumb = await resizeToBlob(bitmap, THUMB_SIDE);
  const { width, height } = bitmap;
  bitmap.close();

  let meta: Record<string, unknown> = {};
  try {
    meta = (await exifr.parse(c.file, { tiff: true, exif: true, gps: true, iptc: false, xmp: false })) ?? {};
  } catch {
    /* arquivo sem EXIF */
  }
  const taken = meta.DateTimeOriginal ?? meta.CreateDate;
  const name = c.relativePath.split("/").pop()!;

  const photo: Omit<Photo, "id"> = {
    folderId: c.folderId,
    relativePath: c.relativePath,
    fileName: name,
    fileSize: c.file.size,
    mimeType: c.file.type || "image/jpeg",
    sha256: hash,
    width,
    height,
    takenAt: taken instanceof Date && !isNaN(taken.getTime()) ? taken.getTime() : c.file.lastModified,
    importedAt: Date.now(),
    cameraMake: str(meta.Make),
    cameraModel: str(meta.Model),
    lens: str(meta.LensModel),
    iso: numOrUndef(meta.ISO),
    aperture: numOrUndef(meta.FNumber),
    shutterSpeed: numOrUndef(meta.ExposureTime),
    focalLength: numOrUndef(meta.FocalLength),
    gpsLat: numOrUndef(meta.latitude),
    gpsLng: numOrUndef(meta.longitude),
    rating: 0,
    favorite: 0,
    rejected: 0,
    edited: 0,
  };

  await db.transaction("rw", db.photos, db.thumbs, db.blobs, async () => {
    const id = await db.photos.add(photo);
    await db.thumbs.put({ photoId: id, original: thumb });
    if (c.storeBlob) await db.blobs.put({ photoId: id, blob: c.file });
  });
  return true;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const numOrUndef = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : undefined);
