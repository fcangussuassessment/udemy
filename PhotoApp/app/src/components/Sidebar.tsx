import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef } from "react";
import { db } from "../db/db";
import { useApp, type View } from "../store";
import { useAuth, renderGoogleButton, signOut } from "../lib/auth";
import { useAIQueue } from "../lib/ai";
import { addToAlbum, createAlbum } from "../lib/catalog";
import { promptText } from "./Dialogs";
import { Icon } from "./Icon";
import { toast } from "../store";

const same = (a: View, b: View) => a.kind === b.kind && ("id" in a ? a.id : 0) === ("id" in b ? b.id : 0);

function Item({ view, icon, label, count, onDropPhotos }: { view: View; icon: string; label: string; count?: number; onDropPhotos?: (ids: number[]) => void }) {
  const current = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const active = same(current, view);
  return (
    <button
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition ${active ? "bg-panel-2 font-medium text-fg" : "text-muted hover:bg-panel-2 hover:text-fg"}`}
      onClick={() => setView(view)}
      onDragOver={onDropPhotos ? (e) => e.preventDefault() : undefined}
      onDrop={
        onDropPhotos
          ? (e) => {
              const ids = e.dataTransfer.getData("application/x-lumina-photos");
              if (ids) onDropPhotos(JSON.parse(ids));
            }
          : undefined
      }
    >
      <Icon name={icon} className="shrink-0" />
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="ml-auto text-xs text-muted">{count}</span>}
    </button>
  );
}

export function Sidebar() {
  const albums = useLiveQuery(() => db.albums.orderBy("name").toArray(), []);
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const counts = useLiveQuery(async () => {
    // Contagens pelos índices, sem carregar as fotos.
    const [total, trash, favorites] = await Promise.all([
      db.photos.count(),
      db.photos.where("deletedAt").above(0).count(),
      db.photos.where("favorite").equals(1).filter((p) => !p.deletedAt).count(),
    ]);
    return { library: total - trash, favorites, trash };
  }, []);
  const queueActive = useAIQueue((s) => s.items.filter((i) => i.status === "pending" || i.status === "running").length);

  const newAlbum = async () => {
    const name = await promptText("Nome do novo álbum", "", "Criar");
    if (name) await createAlbum(name);
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-2 px-4 py-4">
        <img src="/icon.svg" alt="" className="h-7 w-7" />
        <span className="text-lg font-semibold tracking-tight">Lumina</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4" aria-label="Navegação">
        <div className="space-y-0.5">
          <Item view={{ kind: "library" }} icon="library" label="Biblioteca" count={counts?.library} />
          <Item view={{ kind: "favorites" }} icon="heart" label="Favoritas" count={counts?.favorites} />
          <Item view={{ kind: "recent" }} icon="clock" label="Importadas recentemente" />
          <Item view={{ kind: "trash" }} icon="trash" label="Lixeira" count={counts?.trash || undefined} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <button className="section-title !mb-0 hover:text-fg" onClick={() => useApp.getState().setView({ kind: "albums" })}>
              Álbuns
            </button>
            <button className="text-muted hover:text-fg" onClick={newAlbum} title="Novo álbum" aria-label="Novo álbum">
              <Icon name="plus" size={14} />
            </button>
          </div>
          <div className="space-y-0.5">
            {albums?.map((a) => (
              <Item
                key={a.id}
                view={{ kind: "album", id: a.id }}
                icon="album"
                label={a.name}
                onDropPhotos={async (ids) => {
                  const n = await addToAlbum(a.id, ids);
                  toast(`${n} foto(s) adicionada(s) a "${a.name}".`, "success");
                }}
              />
            ))}
            {albums?.length === 0 && <p className="px-2.5 text-xs text-muted">Nenhum álbum ainda.</p>}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="section-title px-2.5">Organizar</div>
          <Item view={{ kind: "tags" }} icon="tag" label="Tags" />
          <Item view={{ kind: "ai" }} icon="sparkles" label="Fila de IA" count={queueActive || undefined} />
        </div>

        {folders && folders.length > 0 && (
          <div className="space-y-0.5">
            <div className="section-title px-2.5">Pastas</div>
            {folders.map((f) => (
              <Item key={f.id} view={{ kind: "folder", id: f.id }} icon="folder" label={f.name} />
            ))}
          </div>
        )}
      </nav>
      <div className="border-t border-line p-2">
        <Item view={{ kind: "settings" }} icon="settings" label="Configurações" />
        <Account />
      </div>
    </aside>
  );
}

function Account() {
  const { ready, required, user, serverOnline, clientId } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ready && required && clientId && !user && btnRef.current) renderGoogleButton(btnRef.current);
  }, [ready, required, clientId, user]);

  if (!ready) return null;
  if (!serverOnline)
    return (
      <p className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted">
        <Icon name="wifi_off" size={14} /> Servidor de IA offline
      </p>
    );
  if (!required) return <p className="px-2.5 py-2 text-xs text-muted">Modo dev: IA sem login</p>;
  if (!user) return <div ref={btnRef} className="px-1 py-2" />;
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      {user.picture ? (
        <img src={user.picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-2 text-xs">{user.name[0]}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{user.name}</div>
        <div className="truncate text-xs text-muted">{user.email}</div>
      </div>
      <button className="text-muted hover:text-fg" onClick={signOut} title="Sair" aria-label="Sair">
        <Icon name="logout" />
      </button>
    </div>
  );
}
