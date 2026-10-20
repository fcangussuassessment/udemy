import { useVirtualizer } from "@tanstack/react-virtual";
import { useLiveQuery } from "dexie-react-hooks";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { db, type Photo } from "../db/db";
import { useApp } from "../store";
import { useThumbUrl } from "../lib/thumbs";
import { handlePhotoKey } from "../lib/actions";
import { reorderInAlbum } from "../lib/catalog";
import { Icon } from "./Icon";
import { COLOR_HEX } from "./colors";

const GAP = 6;
const HEADER_H = 44;

type Row = { kind: "header"; label: string; count: number } | { kind: "photos"; photos: Photo[] };

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/** RF-11: monta as linhas da grade, agrupando por mês quando ordenado por data. */
function buildRows(photos: Photo[], columns: number, grouped: boolean): Row[] {
  const rows: Row[] = [];
  const push = (list: Photo[]) => {
    for (let i = 0; i < list.length; i += columns) rows.push({ kind: "photos", photos: list.slice(i, i + columns) });
  };
  if (!grouped) {
    push(photos);
    return rows;
  }
  let group: Photo[] = [];
  let key = "";
  const flush = () => {
    if (!group.length) return;
    const label = monthFmt.format(group[0].takenAt);
    rows.push({ kind: "header", label: label[0].toUpperCase() + label.slice(1), count: group.length });
    push(group);
  };
  for (const p of photos) {
    const d = new Date(p.takenAt);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    if (k !== key) {
      flush();
      group = [];
      key = k;
    }
    group.push(p);
  }
  flush();
  return rows;
}

export function PhotoGrid({ photos, manualOrder }: { photos: Photo[]; manualOrder: boolean }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const tileSize = useApp((s) => s.tileSize);
  const sort = useApp((s) => s.filters.sort);
  const search = useApp((s) => s.search);
  const view = useApp((s) => s.view);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((width - 24 + GAP) / (tileSize + GAP)));
  const cell = (width - 24 - GAP * (columns - 1)) / columns;
  const grouped = sort === "takenAt" && !search && !manualOrder;
  const rows = useMemo(() => buildRows(photos, columns, grouped), [photos, columns, grouped]);
  const order = useMemo(() => photos.map((p) => p.id), [photos]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].kind === "header" ? HEADER_H : cell + GAP),
    overscan: 6,
  });

  useEffect(() => virtualizer.measure(), [cell, rows, virtualizer]);

  // Rola até a foto aberta no visualizador ao fechar/navegar.
  const viewerId = useApp((s) => s.viewerId);
  useEffect(() => {
    if (!viewerId) return;
    const idx = rows.findIndex((r) => r.kind === "photos" && r.photos.some((p) => p.id === viewerId));
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [viewerId, rows, virtualizer]);

  // Atalhos da grade (RF-16/RF-13).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useApp.getState();
      if (st.viewerId || st.editorId || isTyping(e)) return;
      const sel = [...st.selection];
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        st.select(order);
        return;
      }
      if (e.key === "Escape") return st.clearSelection();
      if ((e.key === "Enter" || e.key === " ") && sel.length) {
        e.preventDefault();
        return st.openViewer(sel[0]);
      }
      if (e.key.toLowerCase() === "i") return st.toggleInfo();
      if (e.key.startsWith("Arrow") && order.length) {
        e.preventDefault();
        const cur = st.anchorId ? order.indexOf(st.anchorId) : -1;
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[e.key] ?? 0;
        const next = order[Math.min(order.length - 1, Math.max(0, cur + delta))];
        st.select([next], e.shiftKey ? "add" : "replace");
        st.setAnchor(next);
        return;
      }
      if (handlePhotoKey(e, sel)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, columns]);

  const onTileClick = (e: React.MouseEvent, id: number) => {
    const st = useApp.getState();
    if (e.shiftKey && st.anchorId) {
      const a = order.indexOf(st.anchorId);
      const b = order.indexOf(id);
      const [from, to] = a < b ? [a, b] : [b, a];
      st.select(order.slice(from, to + 1), e.ctrlKey || e.metaKey ? "add" : "replace");
      return;
    }
    st.select([id], e.ctrlKey || e.metaKey ? "toggle" : "replace");
    st.setAnchor(id);
  };

  const onDropReorder = view.kind === "album" && manualOrder && !search ? (dragged: number[], target: number) => reorderInAlbum(view.id, dragged[0], target) : undefined;

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto px-3 pt-2 pb-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) useApp.getState().clearSelection();
      }}
      role="grid"
      aria-label="Fotos"
      aria-multiselectable="true"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index];
          return (
            <div key={vi.key} style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)` }}>
              {row.kind === "header" ? (
                <div className="flex items-baseline gap-2 px-1 pt-4 pb-2" style={{ height: HEADER_H }}>
                  <h2 className="text-sm font-semibold">{row.label}</h2>
                  <span className="text-xs text-muted">{row.count}</span>
                </div>
              ) : (
                <div className="flex" style={{ gap: GAP, height: cell }} role="row">
                  {row.photos.map((p) => (
                    <Tile key={p.id} photo={p} size={cell} onClick={onTileClick} onDropReorder={onDropReorder} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

const Tile = memo(function Tile({
  photo,
  size,
  onClick,
  onDropReorder,
}: {
  photo: Photo;
  size: number;
  onClick: (e: React.MouseEvent, id: number) => void;
  onDropReorder?: (dragged: number[], target: number) => void;
}) {
  const url = useThumbUrl(photo.id);
  const selected = useApp((s) => s.selection.has(photo.id));
  const reasons = useApp((s) => s.search?.reasons.get(photo.id));
  const pendingAI = useLiveQuery(
    () => db.photoTags.where("photoId").equals(photo.id).filter((r) => r.status === "suggested").count(),
    [photo.id],
  );

  return (
    <div
      role="gridcell"
      aria-selected={selected}
      tabIndex={-1}
      className={`group relative cursor-pointer overflow-hidden rounded-md bg-panel-2 ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""} ${photo.rejected ? "opacity-40" : ""}`}
      style={{ width: size, height: size }}
      onClick={(e) => onClick(e, photo.id)}
      onDoubleClick={() => useApp.getState().openViewer(photo.id)}
      draggable
      onDragStart={(e) => {
        const sel = useApp.getState().selection;
        const ids = sel.has(photo.id) ? [...sel] : [photo.id];
        e.dataTransfer.setData("application/x-lumina-photos", JSON.stringify(ids));
        e.dataTransfer.effectAllowed = "copyMove";
      }}
      onDragOver={onDropReorder ? (e) => e.preventDefault() : undefined}
      onDrop={
        onDropReorder
          ? (e) => {
              const raw = e.dataTransfer.getData("application/x-lumina-photos");
              if (raw) onDropReorder(JSON.parse(raw), photo.id);
            }
          : undefined
      }
      title={photo.fileName}
    >
      {url ? (
        <img src={url} alt={photo.fileName} className="h-full w-full object-cover transition group-hover:scale-[1.02]" draggable={false} loading="lazy" />
      ) : (
        <div className="h-full w-full animate-pulse bg-panel-2" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-6 pb-1 text-white opacity-0 transition group-hover:opacity-100 data-[keep=true]:opacity-100" data-keep={photo.rating > 0 || !!photo.favorite || !!photo.colorLabel}>
        <span className="text-xs tracking-tight">{photo.rating ? "★".repeat(photo.rating) : ""}</span>
        <span className="flex items-center gap-1">
          {photo.edited ? <Icon name="edit" size={12} /> : null}
          {photo.favorite ? <Icon name="heart" size={13} filled className="text-red-400" /> : null}
          {photo.colorLabel && <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[photo.colorLabel] }} />}
        </span>
      </div>
      {!!pendingAI && (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-accent" title={`${pendingAI} tag(s) sugerida(s) pela IA`}>
          <Icon name="sparkles" size={11} />
        </span>
      )}
      {reasons && (
        <span className="absolute top-1.5 left-1.5 max-w-[85%] truncate rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{reasons.join(" · ")}</span>
      )}
    </div>
  );
});
