import { useLiveQuery } from "dexie-react-hooks";
import { db, type Album } from "../db/db";
import { useApp } from "../store";
import { createAlbum, deleteAlbum, renameAlbum } from "../lib/catalog";
import { useThumbUrl } from "../lib/thumbs";
import { confirmAction, promptText } from "../components/Dialogs";
import { Icon } from "../components/Icon";

export function AlbumsView() {
  const albums = useLiveQuery(async () => {
    const list = await db.albums.orderBy("name").toArray();
    return Promise.all(list.map(async (a) => ({ album: a, count: await db.albumPhotos.where("albumId").equals(a.id).count() })));
  }, []);

  const create = async () => {
    const name = await promptText("Nome do novo álbum", "", "Criar");
    if (name) await createAlbum(name);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
        <button onClick={create} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent">
          <Icon name="plus" size={28} />
          Novo álbum
        </button>
        {albums?.map(({ album, count }) => <AlbumCard key={album.id} album={album} count={count} />)}
      </div>
      {albums?.length === 0 && <p className="mt-6 text-muted">Selecione fotos na biblioteca e use “Adicionar ao álbum”, ou arraste fotos para um álbum na barra lateral.</p>}
    </div>
  );
}

function AlbumCard({ album, count }: { album: Album; count: number }) {
  const cover = useThumbUrl(album.coverPhotoId);
  return (
    <div className="group">
      <button className="block aspect-square w-full overflow-hidden rounded-xl bg-panel-2" onClick={() => useApp.getState().setView({ kind: "album", id: album.id })}>
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <Icon name="album" size={40} className="m-auto text-muted" />}
      </button>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{album.name}</div>
          <div className="text-xs text-muted">{count} foto(s)</div>
        </div>
        <div className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            className="btn-ghost btn !px-1.5"
            aria-label="Renomear"
            onClick={async () => {
              const name = await promptText("Renomear álbum", album.name, "Salvar");
              if (name) await renameAlbum(album.id, name);
            }}
          >
            <Icon name="edit" size={14} />
          </button>
          <button
            className="btn-ghost btn !px-1.5 text-danger"
            aria-label="Excluir"
            onClick={async () => {
              const r = await confirmAction(`Excluir o álbum "${album.name}"?`, "As fotos continuam na biblioteca.", { confirmLabel: "Excluir", danger: true });
              if (r.ok) await deleteAlbum(album.id);
            }}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
