import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useApp } from "../store";
import { useAIQueue, pauseQueue, clearFinished, cancelPending } from "../lib/ai";
import { analyzeWithToast } from "../lib/actions";
import { useThumbUrl } from "../lib/thumbs";
import { Icon } from "../components/Icon";

const STATUS: Record<string, string> = { pending: "Na fila", running: "Analisando…", done: "Concluída", error: "Erro" };

/** RF-55: fila de análise com progresso, pausa e retomada. */
export function AIQueueView() {
  const { items, paused } = useAIQueue();
  const stats = useLiveQuery(async () => {
    const [total, analyzed] = await Promise.all([db.photos.filter((p) => !p.deletedAt).count(), db.aiAnnotations.count()]);
    return { total, analyzed };
  }, []);
  const done = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error").length;
  const active = items.filter((i) => i.status === "pending" || i.status === "running").length;

  const analyzeAll = async () => {
    const ids = await db.photos.filter((p) => !p.deletedAt).primaryKeys();
    analyzeWithToast(ids);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 grid max-w-3xl grid-cols-3 gap-4">
        <Stat label="Fotos analisadas" value={`${stats?.analyzed ?? 0} / ${stats?.total ?? 0}`} />
        <Stat label="Na fila" value={String(active)} />
        <Stat label="Concluídas nesta sessão" value={`${done}${errors ? ` · ${errors} erro(s)` : ""}`} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={analyzeAll}>
          <Icon name="sparkles" /> Analisar fotos ainda não analisadas
        </button>
        <button className="btn" onClick={() => pauseQueue(!paused)} disabled={!active}>
          <Icon name={paused ? "play" : "pause"} /> {paused ? "Retomar" : "Pausar"}
        </button>
        <button className="btn" onClick={cancelPending} disabled={!active}>Cancelar pendentes</button>
        <button className="btn-ghost btn" onClick={clearFinished} disabled={!done && !errors}>Limpar concluídas</button>
      </div>
      {active > 0 && (
        <div className="mb-4 h-2 max-w-3xl overflow-hidden rounded-full bg-panel-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${(100 * (done + errors)) / items.length}%` }} />
        </div>
      )}
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Apenas uma miniatura reduzida de cada foto (sem EXIF e sem localização) é enviada para a IA. Fotos já analisadas não são reenviadas.
      </p>
      <ul className="max-w-3xl divide-y divide-line">
        {items.map((i) => <QueueRow key={i.photoId} photoId={i.photoId} status={i.status} error={i.error} />)}
      </ul>
      {items.length === 0 && <p className="text-muted">A fila está vazia. Selecione fotos e clique em “Analisar com IA”.</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function QueueRow({ photoId, status, error }: { photoId: number; status: string; error?: string }) {
  const url = useThumbUrl(photoId);
  const photo = useLiveQuery(() => db.photos.get(photoId), [photoId]);
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <button className="h-10 w-10 shrink-0 overflow-hidden rounded bg-panel-2" onClick={() => useApp.getState().openViewer(photoId)} aria-label="Abrir">
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </button>
      <span className="min-w-0 flex-1 truncate">{photo?.fileName}</span>
      <span className={status === "error" ? "text-danger" : status === "done" ? "text-ok" : "text-muted"} title={error}>
        {STATUS[status]}{error ? `: ${error}` : ""}
      </span>
    </li>
  );
}
