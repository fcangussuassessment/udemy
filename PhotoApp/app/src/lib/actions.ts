import { db } from "../db/db";
import { useApp, toast, errorMessage } from "../store";
import { addTag, addToAlbum, createAlbum, moveToTrash, setColorLabel, setRating, toggleFavorite, toggleRejected } from "./catalog";
import { COLOR_KEYS } from "../components/colors";
import { promptText } from "../components/Dialogs";
import { enqueueAnalysis } from "./ai";
import { exportName, exportPhoto, type ExportSettings } from "./editor/export";
import { saveBlob } from "./files";

/** Atalhos de teclado que agem sobre fotos (grade e visualizador). Retorna true se tratou. */
export function handlePhotoKey(e: KeyboardEvent, ids: number[]): boolean {
  if (!ids.length || e.ctrlKey || e.metaKey || e.altKey) return false;
  const k = e.key.toLowerCase();
  if (/^[0-5]$/.test(k)) setRating(ids, Number(k));
  else if (COLOR_KEYS[k]) setColorLabel(ids, COLOR_KEYS[k]);
  else if (k === "f") toggleFavorite(ids);
  else if (k === "x") toggleRejected(ids);
  else if (k === "e" && ids.length === 1) useApp.getState().openEditor(ids[0]);
  else if (k === "delete" || k === "backspace") trashWithToast(ids);
  else return false;
  return true;
}

export async function trashWithToast(ids: number[]) {
  if (useApp.getState().view.kind === "trash") return;
  await moveToTrash(ids);
  useApp.getState().clearSelection();
  toast(`${ids.length} foto(s) movida(s) para a lixeira.`);
}

export async function addToAlbumPrompt(ids: number[], albumId?: number) {
  if (albumId) {
    const n = await addToAlbum(albumId, ids);
    const album = await db.albums.get(albumId);
    toast(`${n} foto(s) adicionada(s) a "${album?.name}".`, "success");
    return;
  }
  const name = await promptText("Nome do novo álbum", "", "Criar álbum");
  if (!name) return;
  await createAlbum(name, ids);
  toast(`Álbum "${name}" criado com ${ids.length} foto(s).`, "success");
}

export async function addTagPrompt(ids: number[]) {
  const name = await promptText(`Adicionar tag a ${ids.length} foto(s)`, "", "Adicionar");
  if (!name) return;
  for (const part of name.split(",")) await addTag(ids, part);
  toast("Tag adicionada.", "success");
}

export async function analyzeWithToast(ids: number[], force = false) {
  const n = await enqueueAnalysis(ids, force);
  if (n) toast(`${n} foto(s) na fila de IA.`);
}

/** Exporta várias fotos para uma pasta (ou como downloads, se não houver suporte). */
export async function exportMany(ids: number[], settings: ExportSettings) {
  const photos = (await db.photos.bulkGet(ids)).filter((p) => !!p);
  let dir: FileSystemDirectoryHandle | null = null;
  if (photos.length > 1 && "showDirectoryPicker" in window) {
    try {
      dir = await window.showDirectoryPicker({ id: "lumina-export", mode: "readwrite" });
    } catch {
      return;
    }
  }
  let ok = 0;
  for (const p of photos) {
    try {
      const blob = await exportPhoto(p, settings);
      const name = exportName(p, settings.format);
      if (dir) {
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        await saveBlob(blob, name);
      }
      ok++;
    } catch (err) {
      toast(`Falha ao exportar ${p.fileName}: ${errorMessage(err)}`, "error");
    }
  }
  if (ok) toast(`${ok} foto(s) exportada(s).`, "success");
}
