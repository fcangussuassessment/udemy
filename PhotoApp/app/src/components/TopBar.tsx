import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { db, type ColorLabel } from "../db/db";
import { useApp, DEFAULT_FILTERS, type SortKey, type View } from "../store";
import { importFiles, importFolder } from "../lib/import";
import { supportsFolderAccess } from "../lib/files";
import { runSearch } from "../lib/search";
import { Icon } from "./Icon";
import { COLOR_HEX } from "./colors";

export function useViewTitle(view: View): string {
  return (
    useLiveQuery(async () => {
      switch (view.kind) {
        case "library": return "Biblioteca";
        case "favorites": return "Favoritas";
        case "recent": return "Importadas recentemente";
        case "trash": return "Lixeira";
        case "albums": return "Álbuns";
        case "tags": return "Tags";
        case "ai": return "Fila de IA";
        case "settings": return "Configurações";
        case "album": return (await db.albums.get(view.id))?.name ?? "Álbum";
        case "tag": return `#${(await db.tags.get(view.id))?.name ?? "tag"}`;
        case "folder": return (await db.folders.get(view.id))?.name ?? "Pasta";
      }
    }, [view]) ?? ""
  );
}

export function TopBar({ count }: { count?: number }) {
  const view = useApp((s) => s.view);
  const title = useViewTitle(view);
  const search = useApp((s) => s.search);
  const filters = useApp((s) => s.filters);
  const setFilters = useApp((s) => s.setFilters);
  const tileSize = useApp((s) => s.tileSize);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const years = useLiveQuery(async () => {
    const set = new Set<number>();
    await db.photos.orderBy("takenAt").eachKey((k) => set.add(new Date(k as number).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, []);
  const cameras = useLiveQuery(async () => {
    const set = new Set<string>();
    await db.photos.each((p) => p.cameraModel && set.add(p.cameraModel));
    return [...set].sort();
  }, []);

  useEffect(() => {
    if (!search) setQuery("");
  }, [search]);

  // Ctrl/Cmd+K foca a busca (RF-60).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await runSearch(query);
    } finally {
      setBusy(false);
    }
  };

  const activeFilters =
    (filters.minRating ? 1 : 0) + (filters.colorLabel ? 1 : 0) + (filters.year ? 1 : 0) + (filters.camera ? 1 : 0) + (filters.orientation ? 1 : 0) + (filters.showRejected ? 1 : 0);
  const gridView = !["albums", "tags", "ai", "settings"].includes(view.kind);

  return (
    <header className="border-b border-line bg-panel">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{title}</h1>
          {gridView && count !== undefined && <p className="text-xs text-muted">{count.toLocaleString("pt-BR")} foto(s)</p>}
        </div>
        <form
          className="relative ml-auto w-full max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            className="input pr-16 pl-8"
            placeholder='Buscar: "praia ao pôr do sol", tag:viagem ano:2024…'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                useApp.getState().setSearch(null);
                inputRef.current?.blur();
              }
            }}
            aria-label="Buscar fotos"
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">{busy ? "…" : "Ctrl K"}</span>
        </form>
        {gridView && (
          <>
            <button className={`btn ${activeFilters ? "!border-accent" : ""}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              Filtros{activeFilters ? ` (${activeFilters})` : ""}
            </button>
            <input
              type="range"
              min={110}
              max={360}
              value={tileSize}
              onChange={(e) => useApp.getState().setTileSize(Number(e.target.value))}
              className="!w-24"
              aria-label="Tamanho das miniaturas"
            />
            <button className="btn-ghost btn !px-2" onClick={() => useApp.getState().toggleInfo()} title="Painel de informações (I)" aria-label="Painel de informações">
              <Icon name="info" />
            </button>
          </>
        )}
        {supportsFolderAccess ? (
          <button className="btn btn-primary" onClick={importFolder}>
            <Icon name="folder" /> Adicionar pasta
          </button>
        ) : null}
        <button className="btn" onClick={() => fileRef.current?.click()} title="Importar arquivos" aria-label="Importar arquivos">
          <Icon name="upload" /> {supportsFolderAccess ? "" : "Importar fotos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) importFiles([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>

      {gridView && showFilters && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-sm">
          <label className="flex items-center gap-1.5">
            Nota mínima
            <select className="input !w-auto" value={filters.minRating} onChange={(e) => setFilters({ minRating: Number(e.target.value) })}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n ? "★".repeat(n) : "Qualquer"}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1" role="group" aria-label="Rótulo de cor">
            {(Object.keys(COLOR_HEX) as ColorLabel[]).map((c) => (
              <button
                key={c}
                className={`h-5 w-5 rounded-full border-2 ${filters.colorLabel === c ? "border-fg" : "border-transparent"}`}
                style={{ background: COLOR_HEX[c] }}
                onClick={() => setFilters({ colorLabel: filters.colorLabel === c ? null : c })}
                aria-label={`Rótulo ${c}`}
                aria-pressed={filters.colorLabel === c}
              />
            ))}
          </div>
          <select className="input !w-auto" value={filters.year ?? ""} onChange={(e) => setFilters({ year: e.target.value ? Number(e.target.value) : null })} aria-label="Ano">
            <option value="">Todos os anos</option>
            {years?.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input !w-auto" value={filters.camera ?? ""} onChange={(e) => setFilters({ camera: e.target.value || null })} aria-label="Câmera">
            <option value="">Todas as câmeras</option>
            {cameras?.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input !w-auto" value={filters.orientation ?? ""} onChange={(e) => setFilters({ orientation: (e.target.value || null) as never })} aria-label="Orientação">
            <option value="">Qualquer orientação</option>
            <option value="landscape">Paisagem</option>
            <option value="portrait">Retrato</option>
            <option value="square">Quadrada</option>
          </select>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={filters.showRejected} onChange={(e) => setFilters({ showRejected: e.target.checked })} />
            Mostrar rejeitadas
          </label>
          <span className="ml-auto flex items-center gap-1.5">
            Ordenar
            <select className="input !w-auto" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value as SortKey })}>
              <option value="takenAt">Data da foto</option>
              <option value="importedAt">Data de importação</option>
              <option value="fileName">Nome</option>
              <option value="rating">Avaliação</option>
            </select>
            <button className="btn !px-2" onClick={() => setFilters({ desc: !filters.desc })} aria-label="Inverter ordem">
              {filters.desc ? "↓" : "↑"}
            </button>
          </span>
          <button className="btn-ghost btn" onClick={() => useApp.getState().resetFilters()} disabled={JSON.stringify({ ...filters, sort: "takenAt", desc: true }) === JSON.stringify(DEFAULT_FILTERS)}>
            Limpar
          </button>
        </div>
      )}

      {search && (
        <div className="flex items-center gap-2 border-t border-line bg-panel-2/50 px-4 py-1.5 text-sm">
          {search.mode === "ai" && <Icon name="sparkles" className="text-accent" />}
          <span>
            {search.ids.size} resultado(s) para <strong>“{search.query}”</strong>
            {search.mode === "ai" ? " — busca inteligente" : ""}
          </span>
          {search.note && <span className="text-muted">· {search.note}</span>}
          <button className="btn-ghost btn ml-auto !py-0.5" onClick={() => useApp.getState().setSearch(null)}>
            <Icon name="x" size={14} /> Limpar busca
          </button>
        </div>
      )}
    </header>
  );
}
