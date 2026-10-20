import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db, type Photo } from "../db/db";
import { useApp, errorMessage } from "../store";
import { getOriginalFile, PermissionNeededError, requestPermission } from "../lib/files";
import { useThumbUrl } from "../lib/thumbs";
import { handlePhotoKey } from "../lib/actions";
import { ColorRenderer, renderFull } from "../lib/editor/renderer";
import { loadSource } from "../lib/editor/export";
import { InfoPanel } from "./InfoPanel";
import { Icon } from "./Icon";

const SCREEN_SIDE = 2560;

/** Carrega a imagem para exibição: original, ou renderizada com as edições. */
function useDisplayImage(photo: Photo | undefined) {
  const [state, setState] = useState<{ url?: string; error?: string; permission?: PermissionNeededError }>({});
  const [retry, setRetry] = useState(0);
  const thumbVersion = useApp((s) => (photo ? s.thumbVersion[photo.id] ?? 0 : 0));

  useEffect(() => {
    if (!photo) return;
    let alive = true;
    let url: string | undefined;
    setState({});
    (async () => {
      try {
        let blob: Blob;
        if (photo.edited) {
          const edit = await db.edits.get(photo.id);
          const renderer = new ColorRenderer();
          const src = await loadSource(photo, renderer, SCREEN_SIDE);
          const out = edit ? renderFull(renderer, src, edit.adjustments) : null;
          blob = out ? await out.convertToBlob({ type: "image/jpeg", quality: 0.92 }) : await getOriginalFile(photo);
          src.close();
          renderer.dispose();
        } else {
          blob = await getOriginalFile(photo);
        }
        url = URL.createObjectURL(blob);
        if (alive) setState({ url });
      } catch (err) {
        if (alive) setState(err instanceof PermissionNeededError ? { permission: err } : { error: errorMessage(err) });
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo?.id, photo?.edited, thumbVersion, retry]);

  return { ...state, retry: () => setRetry((n) => n + 1) };
}

export function Viewer({ order }: { order: number[] }) {
  const viewerId = useApp((s) => s.viewerId)!;
  const infoOpen = useApp((s) => s.infoOpen);
  const photo = useLiveQuery(() => db.photos.get(viewerId), [viewerId]);
  const thumb = useThumbUrl(viewerId);
  const { url, error, permission, retry } = useDisplayImage(photo);
  const [zoom, setZoom] = useState(false);
  const index = order.indexOf(viewerId);

  const go = (delta: number) => {
    const next = order[index + delta];
    if (next) {
      useApp.getState().openViewer(next);
      useApp.getState().select([next]);
      useApp.getState().setAnchor(next);
      setZoom(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useApp.getState().editorId) return;
      if (e.key === "Escape") useApp.getState().openViewer(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key.toLowerCase() === "i") useApp.getState().toggleInfo();
      else if (e.key.toLowerCase() === "z") setZoom((z) => !z);
      else if (!handlePhotoKey(e, [viewerId])) return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const strip = order.slice(Math.max(0, index - 7), index + 8);

  return (
    <div className="fixed inset-0 z-40 flex bg-black text-white" role="dialog" aria-label="Visualizador">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-4 py-2 text-sm">
          <button className="btn-ghost btn !px-2 text-white" onClick={() => useApp.getState().openViewer(null)} aria-label="Fechar (Esc)">
            <Icon name="x" />
          </button>
          <span className="truncate">{photo?.fileName}</span>
          <span className="text-white/50">{index + 1} / {order.length}</span>
          <span className="ml-auto" />
          <button className="btn-ghost btn !px-2 text-white" onClick={() => setZoom((z) => !z)} title="Zoom 100% (Z)">{zoom ? "Ajustar" : "100%"}</button>
          <button className="btn-ghost btn text-white" onClick={() => useApp.getState().openEditor(viewerId)}>
            <Icon name="edit" /> Editar
          </button>
          <button className="btn-ghost btn !px-2 text-white" onClick={() => useApp.getState().toggleInfo()} aria-label="Informações (I)">
            <Icon name="info" />
          </button>
        </div>

        <div className={`relative flex-1 ${zoom ? "overflow-auto" : "flex items-center justify-center overflow-hidden"}`} onDoubleClick={() => setZoom((z) => !z)}>
          {permission ? (
            <div className="m-auto max-w-sm space-y-3 text-center">
              {thumb && <img src={thumb} alt="" className="mx-auto max-h-64 opacity-60" />}
              <p>{permission.message}</p>
              <button className="btn btn-primary" onClick={async () => (await requestPermission(permission.folder.handle!)) && retry()}>
                Autorizar acesso à pasta
              </button>
            </div>
          ) : error ? (
            <p className="m-auto text-white/70">{error}</p>
          ) : (
            <img
              src={url ?? thumb ?? undefined}
              alt={photo?.fileName ?? ""}
              className={zoom ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}
              draggable={false}
            />
          )}
          {index > 0 && (
            <button className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => go(-1)} aria-label="Anterior">
              <Icon name="left" size={22} />
            </button>
          )}
          {index < order.length - 1 && (
            <button className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => go(1)} aria-label="Próxima">
              <Icon name="right" size={22} />
            </button>
          )}
        </div>

        <div className="flex justify-center gap-1.5 overflow-hidden px-4 py-2">
          {strip.map((id) => (
            <StripThumb key={id} id={id} active={id === viewerId} onClick={() => go(order.indexOf(id) - index)} />
          ))}
        </div>
      </div>
      {infoOpen && (
        <div className="flex h-full text-fg">
          <InfoPanel photoIds={[viewerId]} />
        </div>
      )}
    </div>
  );
}

function StripThumb({ id, active, onClick }: { id: number; active: boolean; onClick: () => void }) {
  const url = useThumbUrl(id);
  return (
    <button onClick={onClick} className={`h-14 w-14 shrink-0 overflow-hidden rounded ${active ? "ring-2 ring-accent" : "opacity-60 hover:opacity-100"}`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}
