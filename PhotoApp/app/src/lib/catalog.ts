import { db, ensureTag, type ColorLabel, type Photo } from "../db/db";
import { deleteOriginalFromDisk } from "./files";

const changeAll = (ids: number[], changes: Partial<Photo>) =>
  db.photos.bulkUpdate(ids.map((key) => ({ key, changes })));

export const setRating = (ids: number[], rating: number) => changeAll(ids, { rating });
export const setColorLabel = (ids: number[], colorLabel: ColorLabel | undefined) => changeAll(ids, { colorLabel });

export async function toggleFavorite(ids: number[]) {
  const photos = await db.photos.bulkGet(ids);
  const allFav = photos.every((p) => p?.favorite);
  await changeAll(ids, { favorite: allFav ? 0 : 1 });
}

export async function toggleRejected(ids: number[]) {
  const photos = await db.photos.bulkGet(ids);
  const allRejected = photos.every((p) => p?.rejected);
  await changeAll(ids, { rejected: allRejected ? 0 : 1 });
}

// --- Lixeira (RF-19) ---

export const moveToTrash = (ids: number[]) => changeAll(ids, { deletedAt: Date.now() });
export const restoreFromTrash = (ids: number[]) => changeAll(ids, { deletedAt: undefined });

/** Remove do catálogo (e opcionalmente do disco) de forma definitiva. */
export async function purge(ids: number[], alsoFromDisk: boolean) {
  const failures: string[] = [];
  if (alsoFromDisk) {
    for (const p of await db.photos.bulkGet(ids)) {
      if (!p) continue;
      try {
        await deleteOriginalFromDisk(p);
      } catch {
        failures.push(p.fileName);
      }
    }
  }
  await db.transaction(
    "rw",
    [db.photos, db.thumbs, db.blobs, db.albumPhotos, db.photoTags, db.edits, db.aiAnnotations],
    async () => {
      await db.photos.bulkDelete(ids);
      await db.thumbs.bulkDelete(ids);
      await db.blobs.bulkDelete(ids);
      await db.edits.bulkDelete(ids);
      await db.aiAnnotations.bulkDelete(ids);
      await db.albumPhotos.where("photoId").anyOf(ids).delete();
      await db.photoTags.where("photoId").anyOf(ids).delete();
    },
  );
  return failures;
}

// --- Tags (RF-30 a RF-33) ---

export async function addTag(photoIds: number[], name: string) {
  if (!name.trim()) return;
  const tagId = await ensureTag(name);
  await db.photoTags.bulkPut(photoIds.map((photoId) => ({ photoId, tagId, source: "manual", status: "accepted" })));
}

export async function removeTag(photoIds: number[], tagId: number) {
  await db.photoTags.bulkDelete(photoIds.map((photoId) => [photoId, tagId] as [number, number]));
}

export async function acceptSuggestedTags(photoIds: number[], tagId?: number) {
  const rows = await db.photoTags.where("photoId").anyOf(photoIds).toArray();
  const pending = rows.filter((r) => r.status === "suggested" && (tagId === undefined || r.tagId === tagId));
  await db.photoTags.bulkPut(pending.map((r) => ({ ...r, status: "accepted" })));
}

export async function rejectSuggestedTags(photoIds: number[], tagId?: number) {
  const rows = await db.photoTags.where("photoId").anyOf(photoIds).toArray();
  const pending = rows.filter((r) => r.status === "suggested" && (tagId === undefined || r.tagId === tagId));
  await db.photoTags.bulkDelete(pending.map((r) => [r.photoId, r.tagId] as [number, number]));
}

export async function renameTag(tagId: number, newName: string) {
  const name = newName.trim().toLowerCase();
  if (!name) return;
  const other = await db.tags.where("name").equals(name).first();
  if (other && other.id !== tagId) return mergeTags(tagId, other.id);
  await db.tags.update(tagId, { name });
}

/** Move todas as fotos de `fromId` para `intoId` e apaga `fromId`. */
export async function mergeTags(fromId: number, intoId: number) {
  await db.transaction("rw", db.tags, db.photoTags, async () => {
    const rows = await db.photoTags.where("tagId").equals(fromId).toArray();
    await db.photoTags.bulkPut(rows.map((r) => ({ ...r, tagId: intoId })));
    await db.photoTags.where("tagId").equals(fromId).delete();
    await db.tags.delete(fromId);
  });
}

export async function deleteTag(tagId: number) {
  await db.transaction("rw", db.tags, db.photoTags, async () => {
    await db.photoTags.where("tagId").equals(tagId).delete();
    await db.tags.delete(tagId);
  });
}

// --- Álbuns (RF-20 a RF-22) ---

export async function createAlbum(name: string, photoIds: number[] = []) {
  const albumId = await db.albums.add({ name: name.trim() || "Novo álbum", createdAt: Date.now(), coverPhotoId: photoIds[0] });
  await addToAlbum(albumId, photoIds);
  return albumId;
}

export async function addToAlbum(albumId: number, photoIds: number[]) {
  const existing = await db.albumPhotos.where("albumId").equals(albumId).toArray();
  const have = new Set(existing.map((r) => r.photoId));
  let position = existing.reduce((m, r) => Math.max(m, r.position), 0);
  const rows = photoIds.filter((id) => !have.has(id)).map((photoId) => ({ albumId, photoId, position: ++position }));
  await db.albumPhotos.bulkPut(rows);
  const album = await db.albums.get(albumId);
  if (album && !album.coverPhotoId && photoIds[0]) await db.albums.update(albumId, { coverPhotoId: photoIds[0] });
  return rows.length;
}

export async function removeFromAlbum(albumId: number, photoIds: number[]) {
  await db.albumPhotos.bulkDelete(photoIds.map((id) => [albumId, id] as [number, number]));
  const album = await db.albums.get(albumId);
  if (album?.coverPhotoId && photoIds.includes(album.coverPhotoId)) {
    const first = await db.albumPhotos.where("albumId").equals(albumId).first();
    await db.albums.update(albumId, { coverPhotoId: first?.photoId });
  }
}

export const renameAlbum = (albumId: number, name: string) => db.albums.update(albumId, { name: name.trim() });
export const setAlbumCover = (albumId: number, photoId: number) => db.albums.update(albumId, { coverPhotoId: photoId });

export async function deleteAlbum(albumId: number) {
  await db.transaction("rw", db.albums, db.albumPhotos, async () => {
    await db.albumPhotos.where("albumId").equals(albumId).delete();
    await db.albums.delete(albumId);
  });
}

/** Reordena (RF-22): move `photoId` para a posição de `beforeId` dentro do álbum. */
export async function reorderInAlbum(albumId: number, photoId: number, beforeId: number) {
  const rows = (await db.albumPhotos.where("albumId").equals(albumId).toArray()).sort((a, b) => a.position - b.position);
  const moving = rows.find((r) => r.photoId === photoId);
  if (!moving || photoId === beforeId) return;
  const rest = rows.filter((r) => r.photoId !== photoId);
  const idx = rest.findIndex((r) => r.photoId === beforeId);
  rest.splice(idx < 0 ? rest.length : idx, 0, moving);
  await db.albumPhotos.bulkPut(rest.map((r, i) => ({ ...r, position: i + 1 })));
}
