import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type ColorLabel } from "../db/db";
import { useApp, toast } from "../store";
import { addTagPrompt, addToAlbumPrompt, analyzeWithToast, trashWithToast } from "../lib/actions";
import { purge, removeFromAlbum, restoreFromTrash, setColorLabel, setRating, toggleFavorite, toggleRejected, acceptSuggestedTags } from "../lib/catalog";
import { confirmAction } from "./Dialogs";
import { ExportDialog } from "./ExportDialog";
import { Icon } from "./Icon";
import { COLOR_HEX, COLOR_NAME } from "./colors";

/** Barra de ações em lote para a seleção atual (RF-16). */
export function BatchBar() {
  const selection = useApp((s) => s.selection);
  const view = useApp((s) => s.view);
  const ids = [...selection];
  const albums = useLiveQuery(() => db.albums.orderBy("name").toArray(), []);
  const [exporting, setExporting] = useState(false);
  if (!ids.length) return null;

  if (view.kind === "trash") {
    return (
      <Bar count={ids.length}>
        <button className="btn" onClick={() => restoreFromTrash(ids).then(() => useApp.getState().clearSelection())}>
          Restaurar
        </button>
        <button
          className="btn btn-danger"
          onClick={async () => {
            const r = await confirmAction(
              `Excluir ${ids.length} foto(s) definitivamente?`,
              "Elas serão removidas do catálogo, junto com tags, álbuns e edições.",
              { confirmLabel: "Excluir", danger: true, checkbox: "Apagar também os arquivos originais do disco" },
            );
            if (!r.ok) return;
            const failures = await purge(ids, r.checked);
            useApp.getState().clearSelection();
            toast(failures.length ? `Não foi possível apagar do disco: ${failures.join(", ")}` : "Fotos excluídas.", failures.length ? "error" : "success");
          }}
        >
          Excluir definitivamente
        </button>
      </Bar>
    );
  }

  return (
    <Bar count={ids.length}>
      <div className="flex items-center" role="group" aria-label="Avaliação">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className="px-0.5 text-muted hover:text-accent" onClick={() => setRating(ids, n)} title={`${n} estrela(s) (${n})`} aria-label={`${n} estrelas`}>
            <Icon name="star" size={15} />
          </button>
        ))}
        <button className="ml-1 text-xs text-muted hover:text-fg" onClick={() => setRating(ids, 0)} title="Sem nota (0)">
          0
        </button>
      </div>
      <button className="btn-ghost btn !px-2" onClick={() => toggleFavorite(ids)} title="Favorita (F)" aria-label="Favorita">
        <Icon name="heart" />
      </button>
      <button className="btn-ghost btn !px-2" onClick={() => toggleRejected(ids)} title="Rejeitar (X)" aria-label="Rejeitar">
        <Icon name="ban" />
      </button>
      <div className="flex items-center gap-1" role="group" aria-label="Rótulo de cor">
        {(Object.keys(COLOR_HEX) as ColorLabel[]).map((c) => (
          <button key={c} className="h-4 w-4 rounded-full" style={{ background: COLOR_HEX[c] }} onClick={() => setColorLabel(ids, c)} title={COLOR_NAME[c]} aria-label={COLOR_NAME[c]} />
        ))}
        <button className="text-muted hover:text-fg" onClick={() => setColorLabel(ids, undefined)} title="Sem rótulo" aria-label="Sem rótulo">
          <Icon name="x" size={14} />
        </button>
      </div>
      <span className="h-5 w-px bg-line" />
      <select
        className="input !w-auto !py-1"
        value=""
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = "";
          addToAlbumPrompt(ids, v === "new" ? undefined : Number(v));
        }}
        aria-label="Adicionar ao álbum"
      >
        <option value="" disabled>Adicionar ao álbum…</option>
        <option value="new">+ Novo álbum</option>
        {albums?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {view.kind === "album" && (
        <button className="btn" onClick={() => removeFromAlbum(view.id, ids).then(() => useApp.getState().clearSelection())}>
          Remover do álbum
        </button>
      )}
      <button className="btn" onClick={() => addTagPrompt(ids)}>
        <Icon name="tag" /> Tag
      </button>
      <button className="btn" onClick={() => analyzeWithToast(ids)} title="Gerar tags e descrições com IA">
        <Icon name="sparkles" /> Analisar com IA
      </button>
      <button className="btn" onClick={() => acceptSuggestedTags(ids).then(() => toast("Tags sugeridas aceitas.", "success"))} title="Aceitar todas as tags sugeridas">
        <Icon name="check" /> Aceitar sugestões
      </button>
      <button className="btn" onClick={() => setExporting(true)}>
        <Icon name="download" /> Exportar
      </button>
      <button className="btn-ghost btn !px-2 text-danger" onClick={() => trashWithToast(ids)} title="Mover para a lixeira (Delete)" aria-label="Mover para a lixeira">
        <Icon name="trash" />
      </button>
      {exporting && <ExportDialog ids={ids} onClose={() => setExporting(false)} />}
    </Bar>
  );
}

function Bar({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/95 px-3 py-2 shadow-2xl backdrop-blur">
      <span className="pr-1 text-sm font-medium">{count} selecionada(s)</span>
      {children}
      <button className="btn-ghost btn !px-2" onClick={() => useApp.getState().clearSelection()} title="Limpar seleção (Esc)" aria-label="Limpar seleção">
        <Icon name="x" />
      </button>
    </div>
  );
}
