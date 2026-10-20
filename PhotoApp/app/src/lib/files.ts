import { db, type Folder, type Photo } from "../db/db";

export const supportsFolderAccess = typeof window !== "undefined" && "showDirectoryPicker" in window;

export class PermissionNeededError extends Error {
  constructor(public folder: Folder) {
    super(`Acesso à pasta "${folder.name}" precisa ser autorizado novamente.`);
  }
}

export async function hasPermission(handle: FileSystemHandle, mode: FileSystemPermissionMode = "read") {
  return (await handle.queryPermission({ mode })) === "granted";
}

/** Deve ser chamada a partir de um gesto do usuário (clique). */
export async function requestPermission(handle: FileSystemHandle, mode: FileSystemPermissionMode = "read") {
  if (await hasPermission(handle, mode)) return true;
  return (await handle.requestPermission({ mode })) === "granted";
}

async function resolveFileHandle(root: FileSystemDirectoryHandle, relativePath: string) {
  const parts = relativePath.split("/");
  let dir = root;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  return dir.getFileHandle(parts[parts.length - 1]);
}

/** Retorna o arquivo original de uma foto, do disco ou do armazenamento do navegador. */
export async function getOriginalFile(photo: Photo): Promise<Blob> {
  const stored = await db.blobs.get(photo.id);
  if (stored) return stored.blob;
  const folder = photo.folderId ? await db.folders.get(photo.folderId) : undefined;
  if (!folder?.handle) throw new Error("Arquivo original indisponível. Reconecte a pasta em Configurações.");
  if (!(await hasPermission(folder.handle))) throw new PermissionNeededError(folder);
  const fh = await resolveFileHandle(folder.handle, photo.relativePath);
  return fh.getFile();
}

/** Apaga o arquivo original do disco (pede permissão de escrita). */
export async function deleteOriginalFromDisk(photo: Photo) {
  const stored = await db.blobs.get(photo.id);
  if (stored) return; // não há arquivo em disco, só a cópia no navegador
  const folder = photo.folderId ? await db.folders.get(photo.folderId) : undefined;
  if (!folder?.handle) throw new Error("Pasta desconectada.");
  if (!(await requestPermission(folder.handle, "readwrite"))) throw new Error("Permissão de escrita negada.");
  const parts = photo.relativePath.split("/");
  let dir = folder.handle;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  await dir.removeEntry(parts[parts.length - 1]);
}

/** Pastas que existem mas cujo acesso o navegador revogou. */
export async function foldersNeedingPermission(): Promise<Folder[]> {
  const folders = await db.folders.toArray();
  const result: Folder[] = [];
  for (const f of folders) if (f.handle && !(await hasPermission(f.handle))) result.push(f);
  return result;
}

export async function saveBlob(blob: Blob, suggestedName: string) {
  if ("showSaveFilePicker" in window) {
    try {
      const ext = suggestedName.split(".").pop() ?? "jpg";
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: "Imagem", accept: { [blob.type as `${string}/${string}`]: [`.${ext}` as const] } }],
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return;
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
