import Dexie, { type EntityTable } from "dexie";
import type { Adjustments } from "../lib/editor/adjustments";

export type ColorLabel = "red" | "yellow" | "green" | "blue" | "purple";

export interface Folder {
  id: number;
  name: string;
  /** Ausente em pastas restauradas de backup ou importadas sem a File System Access API. */
  handle?: FileSystemDirectoryHandle;
  lastScannedAt?: number;
}

export interface Photo {
  id: number;
  folderId?: number;
  /** Caminho relativo à pasta, com "/" como separador. */
  relativePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  width: number;
  height: number;
  takenAt: number;
  importedAt: number;
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  iso?: number;
  aperture?: number;
  shutterSpeed?: number;
  focalLength?: number;
  gpsLat?: number;
  gpsLng?: number;
  rating: number;
  favorite: 0 | 1;
  colorLabel?: ColorLabel;
  rejected: 0 | 1;
  deletedAt?: number;
  edited: 0 | 1;
}

/** Arquivo original guardado no navegador quando não há acesso direto à pasta. */
export interface StoredBlob {
  photoId: number;
  blob: Blob;
}

export interface Thumb {
  photoId: number;
  original: Blob;
  edited?: Blob;
}

export interface Album {
  id: number;
  name: string;
  coverPhotoId?: number;
  createdAt: number;
}

export interface AlbumPhoto {
  albumId: number;
  photoId: number;
  position: number;
}

export interface Tag {
  id: number;
  name: string;
}

export type TagSource = "manual" | "ai";
export type TagStatus = "suggested" | "accepted";

export interface PhotoTag {
  photoId: number;
  tagId: number;
  source: TagSource;
  status: TagStatus;
}

export interface Edit {
  photoId: number;
  adjustments: Adjustments;
  updatedAt: number;
}

export interface Preset {
  id: number;
  name: string;
  adjustments: Partial<Adjustments>;
}

export interface AIAnnotation {
  photoId: number;
  model: string;
  description: string;
  altText: string;
  suggested: Partial<Adjustments>;
  analyzedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const db = new Dexie("lumina") as Dexie & {
  folders: EntityTable<Folder, "id">;
  photos: EntityTable<Photo, "id">;
  blobs: EntityTable<StoredBlob, "photoId">;
  thumbs: EntityTable<Thumb, "photoId">;
  albums: EntityTable<Album, "id">;
  albumPhotos: Dexie.Table<AlbumPhoto, [number, number]>;
  tags: EntityTable<Tag, "id">;
  photoTags: Dexie.Table<PhotoTag, [number, number]>;
  edits: EntityTable<Edit, "photoId">;
  presets: EntityTable<Preset, "id">;
  aiAnnotations: EntityTable<AIAnnotation, "photoId">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  folders: "++id, name",
  photos: "++id, folderId, sha256, takenAt, rating, favorite, colorLabel, deletedAt, [folderId+relativePath]",
  blobs: "photoId",
  thumbs: "photoId",
  albums: "++id, name",
  albumPhotos: "[albumId+photoId], albumId, photoId",
  tags: "++id, &name",
  photoTags: "[photoId+tagId], photoId, tagId",
  edits: "photoId",
  presets: "++id",
  aiAnnotations: "photoId",
  settings: "key",
});

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}

/** Busca ou cria a tag pelo nome (sem diferenciar maiúsculas). */
export async function ensureTag(rawName: string): Promise<number> {
  const name = rawName.trim().toLowerCase();
  const existing = await db.tags.where("name").equals(name).first();
  if (existing) return existing.id;
  return db.tags.add({ name });
}
