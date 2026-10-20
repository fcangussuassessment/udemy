import { db } from "../db/db";
import { saveBlob } from "./files";

/**
 * RF-74: exporta o catálogo (metadados, álbuns, tags, edições e dados da IA) em JSON.
 * Miniaturas e arquivos originais não entram no backup; o acesso às pastas é refeito ao restaurar.
 */
export async function exportBackup() {
  const data = {
    app: "lumina",
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: (await db.folders.toArray()).map(({ handle: _h, ...f }) => f),
    photos: await db.photos.toArray(),
    albums: await db.albums.toArray(),
    albumPhotos: await db.albumPhotos.toArray(),
    tags: await db.tags.toArray(),
    photoTags: await db.photoTags.toArray(),
    edits: await db.edits.toArray(),
    presets: await db.presets.toArray(),
    aiAnnotations: await db.aiAnnotations.toArray(),
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  await saveBlob(blob, `lumina-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

/** Restaura um backup, substituindo o catálogo atual. Retorna o número de fotos. */
export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "lumina") throw new Error("Arquivo não é um backup do Lumina.");
  const tables = [db.folders, db.photos, db.albums, db.albumPhotos, db.tags, db.photoTags, db.edits, db.presets, db.aiAnnotations];
  await db.transaction("rw", [...tables, db.thumbs, db.blobs], async () => {
    for (const t of [...tables, db.thumbs, db.blobs]) await t.clear();
    await db.folders.bulkAdd(data.folders ?? []);
    await db.photos.bulkAdd(data.photos ?? []);
    await db.albums.bulkAdd(data.albums ?? []);
    await db.albumPhotos.bulkAdd(data.albumPhotos ?? []);
    await db.tags.bulkAdd(data.tags ?? []);
    await db.photoTags.bulkAdd(data.photoTags ?? []);
    await db.edits.bulkAdd(data.edits ?? []);
    await db.presets.bulkAdd(data.presets ?? []);
    await db.aiAnnotations.bulkAdd(data.aiAnnotations ?? []);
  });
  return (data.photos ?? []).length;
}
