import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "./db/db";
import { useApp } from "./store";
import { useVisiblePhotos } from "./lib/usePhotos";
import { importDropped, importFolder } from "./lib/import";
import { foldersNeedingPermission, requestPermission, supportsFolderAccess } from "./lib/files";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { PhotoGrid } from "./components/PhotoGrid";
import { InfoPanel } from "./components/InfoPanel";
import { BatchBar } from "./components/BatchBar";
import { Viewer } from "./components/Viewer";
import { Editor } from "./components/Editor";
import { DialogHost } from "./components/Dialogs";
import { Icon } from "./components/Icon";
import { AlbumsView } from "./views/AlbumsView";
import { TagsView } from "./views/TagsView";
import { AIQueueView } from "./views/AIQueueView";
import { SettingsView } from "./views/SettingsView";

export default function App() {
  const view = useApp((s) => s.view);
  const viewerId = useApp((s) => s.viewerId);
  const editorId = useApp((s) => s.editorId);
  const infoOpen = useApp((s) => s.infoOpen);
  const selection = useApp((s) => s.selection);
  const { photos, manualOrder } = useVisiblePhotos();
  const [dragOver, setDragOver] = useState(false);

  const isGrid = !["albums", "tags", "ai", "settings"].includes(view.kind);
  const order = photos?.map((p) => p.id) ?? [];
  const viewerOrder = viewerId && !order.includes(viewerId) ? [viewerId] : order;

  return (
    <div
      className="flex h-full"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(false);
        importDropped(e.dataTransfer);
      }}
    >
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar count={photos?.length} />
        <PermissionBanner />
        <ImportProgressBar />
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {view.kind === "albums" && <AlbumsView />}
            {view.kind === "tags" && <TagsView />}
            {view.kind === "ai" && <AIQueueView />}
            {view.kind === "settings" && <SettingsView />}
            {isGrid && photos && (photos.length ? <PhotoGrid photos={photos} manualOrder={manualOrder} /> : <EmptyState />)}
            {isGrid && <BatchBar />}
          </div>
          {isGrid && infoOpen && <InfoPanel photoIds={[...selection]} />}
        </div>
      </main>

      {viewerId && <Viewer order={viewerOrder} />}
      {editorId && <Editor />}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-accent bg-black/50 text-xl font-semibold text-white">
          Solte as fotos ou pastas para importar
        </div>
      )}
      <DialogHost />
      <Toasts />
    </div>
  );
}

function EmptyState() {
  const view = useApp((s) => s.view);
  const search = useApp((s) => s.search);
  const total = useLiveQuery(() => db.photos.count(), []);

  if (total === 0 && view.kind === "library") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <img src="/icon.svg" alt="" className="h-16 w-16" />
        <h2 className="text-2xl font-semibold">Bem-vindo ao Lumina</h2>
        <p className="max-w-md text-muted">
          Organize, edite e encontre suas fotos com IA. As fotos ficam no seu computador: o Lumina só lê as pastas que você escolher.
        </p>
        {supportsFolderAccess ? (
          <button className="btn btn-primary !px-5 !py-2.5 text-base" onClick={importFolder}>
            <Icon name="folder" size={18} /> Adicionar pasta de fotos
          </button>
        ) : (
          <p className="text-sm text-muted">Use o botão de importar no topo ou arraste fotos para esta janela.</p>
        )}
        <p className="text-xs text-muted">Você também pode arrastar fotos e pastas para esta janela.</p>
      </div>
    );
  }
  const messages: Record<string, string> = {
    favorites: "Nenhuma favorita ainda. Pressione F em uma foto para favoritá-la.",
    trash: "A lixeira está vazia.",
    album: "Este álbum está vazio. Selecione fotos na biblioteca e use “Adicionar ao álbum”.",
    recent: "Nenhuma foto importada nos últimos 30 dias.",
  };
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-muted">
      {search ? "Nenhuma foto encontrada para essa busca." : (messages[view.kind] ?? "Nenhuma foto corresponde aos filtros atuais.")}
    </div>
  );
}

/** Pede reautorização quando o navegador revoga o acesso às pastas. */
function PermissionBanner() {
  const [folders, setFolders] = useState<Awaited<ReturnType<typeof foldersNeedingPermission>>>([]);
  const check = () => foldersNeedingPermission().then(setFolders);
  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  if (!folders.length) return null;
  return (
    <div className="flex items-center gap-3 border-b border-line bg-accent/15 px-4 py-2 text-sm">
      <Icon name="folder" className="text-accent" />
      <span>O navegador precisa da sua autorização para abrir os originais de {folders.map((f) => `“${f.name}”`).join(", ")}.</span>
      <button
        className="btn btn-primary ml-auto !py-1"
        onClick={async () => {
          for (const f of folders) await requestPermission(f.handle!);
          check();
        }}
      >
        Autorizar
      </button>
    </div>
  );
}

function ImportProgressBar() {
  const p = useApp((s) => s.importProgress);
  if (!p) return null;
  const pct = p.total ? Math.round((100 * p.done) / p.total) : 0;
  return (
    <div className="border-b border-line bg-panel px-4 py-2 text-sm" role="status">
      <div className="mb-1 flex items-center gap-3">
        <span>Importando… {p.done} de {p.total} ({p.added} nova(s))</span>
        <button className="btn-ghost btn ml-auto !py-0.5" onClick={() => useApp.getState().setImportProgress({ ...p, cancelled: true })} disabled={p.cancelled}>
          {p.cancelled ? "Cancelando…" : "Cancelar"}
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border bg-panel px-3 py-2 text-sm shadow-xl ${t.kind === "error" ? "border-danger/60" : t.kind === "success" ? "border-ok/50" : "border-line"}`}
        >
          <span className="flex-1">{t.text}</span>
          <button className="text-muted hover:text-fg" onClick={() => useApp.getState().dismissToast(t.id)} aria-label="Fechar">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
