import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type Photo } from "../db/db";
import { useApp, toast } from "../store";
import { useThumbUrl } from "../lib/thumbs";
import { acceptSuggestedTags, addTag, rejectSuggestedTags, removeTag, setRating, toggleFavorite } from "../lib/catalog";
import { analyzeWithToast } from "../lib/actions";
import { Icon } from "./Icon";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function shutter(s?: number) {
  if (!s) return undefined;
  return s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}s`;
}

/** Painel direito com metadados, tags, álbuns e dados da IA (RF-12, RF-30, RF-33). */
export function InfoPanel({ photoIds }: { photoIds: number[] }) {
  const photos = useLiveQuery(() => db.photos.bulkGet(photoIds), [photoIds.join(",")]);
  const list = (photos ?? []).filter((p): p is Photo => !!p);
  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel p-4" aria-label="Informações">
      {list.length === 0 && <p className="text-sm text-muted">Selecione uma foto para ver os detalhes. Use Shift ou Ctrl para selecionar várias.</p>}
      {list.length === 1 && <SingleInfo photo={list[0]} />}
      {list.length > 1 && (
        <>
          <h2 className="mb-3 font-semibold">{list.length} fotos selecionadas</h2>
          <TagEditor photoIds={list.map((p) => p.id)} />
        </>
      )}
    </aside>
  );
}

function SingleInfo({ photo }: { photo: Photo }) {
  const url = useThumbUrl(photo.id);
  const ai = useLiveQuery(() => db.aiAnnotations.get(photo.id), [photo.id]);
  const albums = useLiveQuery(async () => {
    const rows = await db.albumPhotos.where("photoId").equals(photo.id).toArray();
    return (await db.albums.bulkGet(rows.map((r) => r.albumId))).filter((a) => !!a);
  }, [photo.id]);

  const exif = [
    [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" "),
    photo.lens,
    [photo.focalLength && `${Math.round(photo.focalLength)} mm`, photo.aperture && `f/${photo.aperture}`, shutter(photo.shutterSpeed), photo.iso && `ISO ${photo.iso}`].filter(Boolean).join(" · "),
  ].filter(Boolean);

  return (
    <div className="space-y-5 text-sm">
      {url && (
        <button className="block w-full overflow-hidden rounded-md" onClick={() => useApp.getState().openViewer(photo.id)} aria-label="Abrir no visualizador">
          <img src={url} alt={ai?.altText || photo.fileName} className="max-h-48 w-full object-contain" />
        </button>
      )}
      <div>
        <h2 className="truncate font-semibold" title={photo.relativePath}>{photo.fileName}</h2>
        <p className="text-muted">{dateFmt.format(photo.takenAt)}</p>
        <p className="text-muted">{photo.width} × {photo.height} · {formatBytes(photo.fileSize)}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex" role="radiogroup" aria-label="Avaliação">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating([photo.id], photo.rating === n ? 0 : n)} className={n <= photo.rating ? "text-accent" : "text-muted"} aria-label={`${n} estrelas`} role="radio" aria-checked={photo.rating === n}>
              <Icon name="star" filled={n <= photo.rating} />
            </button>
          ))}
        </div>
        <button onClick={() => toggleFavorite([photo.id])} className={photo.favorite ? "text-red-400" : "text-muted"} aria-label="Favorita" aria-pressed={!!photo.favorite}>
          <Icon name="heart" filled={!!photo.favorite} />
        </button>
        <button className="btn ml-auto !py-1" onClick={() => useApp.getState().openEditor(photo.id)}>
          <Icon name="edit" /> Editar
        </button>
      </div>

      {exif.length > 0 && (
        <section>
          <h3 className="section-title">Câmera</h3>
          {exif.map((l) => <p key={l}>{l}</p>)}
        </section>
      )}
      {photo.gpsLat !== undefined && photo.gpsLng !== undefined && (
        <section>
          <h3 className="section-title">Local</h3>
          <a className="text-accent hover:underline" href={`https://www.openstreetmap.org/?mlat=${photo.gpsLat}&mlon=${photo.gpsLng}#map=15/${photo.gpsLat}/${photo.gpsLng}`} target="_blank" rel="noreferrer">
            {photo.gpsLat.toFixed(5)}, {photo.gpsLng.toFixed(5)} ↗
          </a>
        </section>
      )}

      <TagEditor photoIds={[photo.id]} />

      {albums && albums.length > 0 && (
        <section>
          <h3 className="section-title">Álbuns</h3>
          <div className="flex flex-wrap gap-1">
            {albums.map((a) => (
              <button key={a!.id} className="chip hover:border-accent" onClick={() => useApp.getState().setView({ kind: "album", id: a!.id })}>
                {a!.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="section-title flex items-center gap-1"><Icon name="sparkles" size={12} /> IA</h3>
        {ai ? (
          <div className="space-y-2">
            <p>{ai.description}</p>
            <div className="rounded-md bg-panel-2 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between text-muted">
                Texto alternativo
                <button className="hover:text-fg" onClick={() => navigator.clipboard.writeText(ai.altText).then(() => toast("Copiado."))}>Copiar</button>
              </div>
              {ai.altText}
            </div>
            <button className="text-xs text-muted hover:text-fg" onClick={() => analyzeWithToast([photo.id], true)}>Analisar novamente</button>
          </div>
        ) : (
          <button className="btn w-full" onClick={() => analyzeWithToast([photo.id])}>
            <Icon name="sparkles" /> Analisar com IA
          </button>
        )}
      </section>
    </div>
  );
}

export function TagEditor({ photoIds }: { photoIds: number[] }) {
  const [value, setValue] = useState("");
  const data = useLiveQuery(async () => {
    const rows = await db.photoTags.where("photoId").anyOf(photoIds).toArray();
    const tags = await db.tags.toArray();
    const byId = new Map(tags.map((t) => [t.id, t.name]));
    const agg = new Map<number, { name: string; count: number; suggested: number }>();
    for (const r of rows) {
      const e = agg.get(r.tagId) ?? { name: byId.get(r.tagId) ?? "?", count: 0, suggested: 0 };
      e.count++;
      if (r.status === "suggested") e.suggested++;
      agg.set(r.tagId, e);
    }
    return { entries: [...agg].sort((a, b) => a[1].name.localeCompare(b[1].name)), all: tags.map((t) => t.name).sort() };
  }, [photoIds.join(",")]);

  const accepted = data?.entries.filter(([, e]) => e.suggested < e.count) ?? [];
  const suggested = data?.entries.filter(([, e]) => e.suggested > 0) ?? [];
  const partial = photoIds.length > 1;

  const submit = async () => {
    for (const part of value.split(",")) await addTag(photoIds, part);
    setValue("");
  };

  return (
    <section>
      <h3 className="section-title">Tags</h3>
      <div className="mb-2 flex flex-wrap gap-1">
        {accepted.map(([id, e]) => (
          <span key={id} className="chip">
            <button className="hover:text-accent" onClick={() => useApp.getState().setView({ kind: "tag", id })}>{e.name}</button>
            {partial && e.count < photoIds.length && <span className="text-muted">{e.count}</span>}
            <button className="text-muted hover:text-danger" onClick={() => removeTag(photoIds, id)} aria-label={`Remover tag ${e.name}`}>
              <Icon name="x" size={11} />
            </button>
          </span>
        ))}
        {accepted.length === 0 && <span className="text-xs text-muted">Nenhuma tag.</span>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input className="input" list="lumina-tags" placeholder="Adicionar tag (Enter)" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Adicionar tag" />
        <datalist id="lumina-tags">{data?.all.map((t) => <option key={t} value={t} />)}</datalist>
      </form>

      {suggested.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1"><Icon name="sparkles" size={11} className="text-accent" /> Sugeridas pela IA</span>
            <span className="flex gap-2">
              <button className="hover:text-ok" onClick={() => acceptSuggestedTags(photoIds)}>Aceitar todas</button>
              <button className="hover:text-danger" onClick={() => rejectSuggestedTags(photoIds)}>Rejeitar</button>
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {suggested.map(([id, e]) => (
              <span key={id} className="chip border-dashed !border-accent/60">
                {e.name}
                <button className="text-muted hover:text-ok" onClick={() => acceptSuggestedTags(photoIds, id)} aria-label={`Aceitar ${e.name}`}>
                  <Icon name="check" size={11} />
                </button>
                <button className="text-muted hover:text-danger" onClick={() => rejectSuggestedTags(photoIds, id)} aria-label={`Rejeitar ${e.name}`}>
                  <Icon name="x" size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
