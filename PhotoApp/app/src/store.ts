import { create } from "zustand";
import type { ColorLabel } from "./db/db";

export type View =
  | { kind: "library" }
  | { kind: "favorites" }
  | { kind: "recent" }
  | { kind: "trash" }
  | { kind: "albums" }
  | { kind: "album"; id: number }
  | { kind: "tags" }
  | { kind: "tag"; id: number }
  | { kind: "folder"; id: number }
  | { kind: "ai" }
  | { kind: "settings" };

export type SortKey = "takenAt" | "importedAt" | "fileName" | "rating";

export interface Filters {
  minRating: number;
  colorLabel: ColorLabel | null;
  year: number | null;
  camera: string | null;
  orientation: "landscape" | "portrait" | "square" | null;
  showRejected: boolean;
  sort: SortKey;
  desc: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  minRating: 0,
  colorLabel: null,
  year: null,
  camera: null,
  orientation: null,
  showRejected: false,
  sort: "takenAt",
  desc: true,
};

export interface SearchResult {
  query: string;
  ids: Set<number>;
  reasons: Map<number, string[]>;
  mode: "ai" | "local";
  note?: string;
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

export interface ImportProgress {
  total: number;
  done: number;
  added: number;
  skipped: number;
  cancelled: boolean;
}

interface AppState {
  view: View;
  filters: Filters;
  tileSize: number;
  selection: Set<number>;
  anchorId: number | null;
  viewerId: number | null;
  editorId: number | null;
  infoOpen: boolean;
  paletteOpen: boolean;
  search: SearchResult | null;
  toasts: Toast[];
  importProgress: ImportProgress | null;
  /** Incrementado para forçar o recarregamento de miniaturas editadas. */
  thumbVersion: Record<number, number>;

  setView: (view: View) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  setTileSize: (size: number) => void;
  select: (ids: number[], mode?: "replace" | "toggle" | "add") => void;
  clearSelection: () => void;
  setAnchor: (id: number | null) => void;
  openViewer: (id: number | null) => void;
  openEditor: (id: number | null) => void;
  toggleInfo: () => void;
  setPaletteOpen: (open: boolean) => void;
  setSearch: (s: SearchResult | null) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  setImportProgress: (p: ImportProgress | null) => void;
  bumpThumb: (photoId: number) => void;
}

let toastSeq = 0;

export const useApp = create<AppState>((set, get) => ({
  view: { kind: "library" },
  filters: DEFAULT_FILTERS,
  tileSize: 180,
  selection: new Set(),
  anchorId: null,
  viewerId: null,
  editorId: null,
  infoOpen: true,
  paletteOpen: false,
  search: null,
  toasts: [],
  importProgress: null,
  thumbVersion: {},

  setView: (view) => set({ view, selection: new Set(), anchorId: null, search: null }),
  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS, sort: get().filters.sort, desc: get().filters.desc } }),
  setTileSize: (tileSize) => set({ tileSize }),
  select: (ids, mode = "replace") => {
    const next = mode === "replace" ? new Set<number>() : new Set(get().selection);
    for (const id of ids) {
      if (mode === "toggle" && next.has(id)) next.delete(id);
      else next.add(id);
    }
    set({ selection: next });
  },
  clearSelection: () => set({ selection: new Set(), anchorId: null }),
  setAnchor: (anchorId) => set({ anchorId }),
  openViewer: (viewerId) => set({ viewerId }),
  openEditor: (editorId) => set({ editorId }),
  toggleInfo: () => set({ infoOpen: !get().infoOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setSearch: (search) => set({ search, selection: new Set() }),
  toast: (text, kind = "info") => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => get().dismissToast(id), kind === "error" ? 7000 : 4000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setImportProgress: (importProgress) => set({ importProgress }),
  bumpThumb: (photoId) => set({ thumbVersion: { ...get().thumbVersion, [photoId]: (get().thumbVersion[photoId] ?? 0) + 1 } }),
}));

export const toast = (text: string, kind?: Toast["kind"]) => useApp.getState().toast(text, kind);

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
