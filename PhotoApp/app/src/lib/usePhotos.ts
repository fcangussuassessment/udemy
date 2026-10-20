import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db, type Photo } from "../db/db";
import { useApp, type Filters, type View } from "../store";
import { orientationOf } from "./search";

const RECENT_MS = 1000 * 60 * 60 * 24 * 30;

async function photosForView(view: View): Promise<{ photos: Photo[]; order?: number[] }> {
  switch (view.kind) {
    case "trash":
      return { photos: await db.photos.filter((p) => Boolean(p.deletedAt)).toArray() };
    case "favorites":
      return { photos: await db.photos.where("favorite").equals(1).filter((p) => !p.deletedAt).toArray() };
    case "recent": {
      const since = Date.now() - RECENT_MS;
      return { photos: await db.photos.filter((p) => !p.deletedAt && p.importedAt >= since).toArray() };
    }
    case "album": {
      const rows = (await db.albumPhotos.where("albumId").equals(view.id).toArray()).sort((a, b) => a.position - b.position);
      const photos = (await db.photos.bulkGet(rows.map((r) => r.photoId))).filter((p): p is Photo => !!p && !p.deletedAt);
      return { photos, order: rows.map((r) => r.photoId) };
    }
    case "tag": {
      const ids = (await db.photoTags.where("tagId").equals(view.id).toArray()).map((r) => r.photoId);
      return { photos: (await db.photos.bulkGet(ids)).filter((p): p is Photo => !!p && !p.deletedAt) };
    }
    case "folder":
      return { photos: await db.photos.where("folderId").equals(view.id).filter((p) => !p.deletedAt).toArray() };
    default:
      return { photos: await db.photos.filter((p) => !p.deletedAt).toArray() };
  }
}

export function applyFilters(photos: Photo[], f: Filters, trash: boolean): Photo[] {
  return photos.filter((p) => {
    if (!trash && !f.showRejected && p.rejected) return false;
    if (f.minRating && p.rating < f.minRating) return false;
    if (f.colorLabel && p.colorLabel !== f.colorLabel) return false;
    if (f.year && new Date(p.takenAt).getFullYear() !== f.year) return false;
    if (f.camera && p.cameraModel !== f.camera) return false;
    if (f.orientation && orientationOf(p) !== f.orientation) return false;
    return true;
  });
}

function sortPhotos(photos: Photo[], f: Filters): Photo[] {
  const dir = f.desc ? -1 : 1;
  const key = f.sort;
  return [...photos].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "pt-BR", { numeric: true }) * dir;
    return (((va as number) ?? 0) - ((vb as number) ?? 0)) * dir || (a.takenAt - b.takenAt) * dir;
  });
}

/** Lista de fotos visível para a visão, filtros e busca atuais. */
export function useVisiblePhotos() {
  const view = useApp((s) => s.view);
  const filters = useApp((s) => s.filters);
  const search = useApp((s) => s.search);
  const data = useLiveQuery(() => photosForView(view), [view]);

  const photos = useMemo(() => {
    if (!data) return undefined;
    let list = applyFilters(data.photos, filters, view.kind === "trash");
    if (search) {
      const rank = new Map([...search.reasons.keys()].map((id, i) => [id, i]));
      return list.filter((p) => search.ids.has(p.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    }
    // Em álbuns, a ordem manual vale quando a ordenação não foi alterada.
    if (data.order && filters.sort === "takenAt" && filters.desc) {
      const pos = new Map(data.order.map((id, i) => [id, i]));
      return list.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    }
    list = sortPhotos(list, filters);
    return list;
  }, [data, filters, search, view.kind]);

  return { photos, manualOrder: Boolean(data?.order) };
}
