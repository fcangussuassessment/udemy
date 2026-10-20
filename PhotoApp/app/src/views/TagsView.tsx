import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "../db/db";
import { useApp, toast } from "../store";
import { deleteTag, mergeTags, renameTag } from "../lib/catalog";
import { confirmAction, promptText } from "../components/Dialogs";
import { Icon } from "../components/Icon";

/** RF-32: gerenciador de tags — renomear, mesclar, excluir e ver o uso. */
export function TagsView() {
  const [filter, setFilter] = useState("");
  const tags = useLiveQuery(async () => {
    const [list, rows] = await Promise.all([db.tags.toArray(), db.photoTags.toArray()]);
    const count = new Map<number, { total: number; ai: number; suggested: number }>();
    for (const r of rows) {
      const c = count.get(r.tagId) ?? { total: 0, ai: 0, suggested: 0 };
      c.total++;
      if (r.source === "ai") c.ai++;
      if (r.status === "suggested") c.suggested++;
      count.set(r.tagId, c);
    }
    return list.map((t) => ({ ...t, ...(count.get(t.id) ?? { total: 0, ai: 0, suggested: 0 }) })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, []);

  const shown = tags?.filter((t) => t.name.includes(filter.toLowerCase())) ?? [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <input className="input max-w-xs" placeholder="Filtrar tags…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar tags" />
        <span className="text-sm text-muted">{tags?.length ?? 0} tag(s)</span>
      </div>
      {tags?.length === 0 && <p className="text-muted">Nenhuma tag ainda. Adicione tags pelo painel de informações ou deixe a IA sugerir.</p>}
      <table className="w-full max-w-3xl text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">Tag</th>
            <th className="py-2 font-medium">Fotos</th>
            <th className="py-2 font-medium">Origem</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((t) => (
            <tr key={t.id} className="border-t border-line">
              <td className="py-2">
                <button className="hover:text-accent" onClick={() => useApp.getState().setView({ kind: "tag", id: t.id })}>
                  {t.name}
                </button>
              </td>
              <td className="py-2">{t.total}</td>
              <td className="py-2 text-muted">
                {t.ai > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="sparkles" size={11} className="text-accent" /> IA {t.ai}
                    {t.suggested > 0 && ` (${t.suggested} pendente${t.suggested > 1 ? "s" : ""})`}
                  </span>
                )}
                {t.total - t.ai > 0 && <span className="ml-2">manual {t.total - t.ai}</span>}
              </td>
              <td className="py-2 text-right whitespace-nowrap">
                <button
                  className="btn-ghost btn !px-2 !py-1"
                  onClick={async () => {
                    const name = await promptText("Renomear tag (use um nome existente para mesclar)", t.name, "Salvar");
                    if (name) await renameTag(t.id, name);
                  }}
                >
                  Renomear
                </button>
                <button
                  className="btn-ghost btn !px-2 !py-1"
                  onClick={async () => {
                    const into = await promptText(`Mesclar "${t.name}" em qual tag?`, "", "Mesclar");
                    if (!into) return;
                    const target = await db.tags.where("name").equals(into.toLowerCase()).first();
                    if (!target) return toast("Tag de destino não encontrada.", "error");
                    if (target.id !== t.id) await mergeTags(t.id, target.id);
                  }}
                >
                  Mesclar
                </button>
                <button
                  className="btn-ghost btn !px-2 !py-1 text-danger"
                  onClick={async () => {
                    const r = await confirmAction(`Excluir a tag "${t.name}"?`, `Ela será removida de ${t.total} foto(s).`, { confirmLabel: "Excluir", danger: true });
                    if (r.ok) await deleteTag(t.id);
                  }}
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
