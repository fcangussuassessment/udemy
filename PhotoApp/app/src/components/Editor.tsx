import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db/db";
import { useApp, toast, errorMessage } from "../store";
import {
  BUILTIN_PRESETS,
  DEFAULT_ADJUSTMENTS,
  SLIDERS,
  isDefault,
  mergeAdjustments,
  type Adjustments,
  type CropRect,
} from "../lib/editor/adjustments";
import { ColorRenderer, drawGeometry } from "../lib/editor/renderer";
import { exportName, exportPhoto, loadSource } from "../lib/editor/export";
import { PermissionNeededError, requestPermission, saveBlob } from "../lib/files";
import { aiEnabled, suggestAdjustments } from "../lib/ai";
import { canUseAI } from "../lib/auth";
import { promptText } from "./Dialogs";
import { ExportDialog } from "./ExportDialog";
import { Icon } from "./Icon";
import { isTyping } from "./PhotoGrid";

const PREVIEW_SIDE = 2048;
const THUMB_SIDE = 480;

const RATIOS: { label: string; value: number | "original" | null }[] = [
  { label: "Livre", value: null },
  { label: "Original", value: "original" },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
];

/** Copiar/colar ajustes entre fotos (RF-48). */
let clipboard: Adjustments | null = null;

/** Editor não-destrutivo (RF-40 a RF-48). */
export function Editor() {
  const photoId = useApp((s) => s.editorId)!;
  const photo = useLiveQuery(() => db.photos.get(photoId), [photoId]);
  const userPresets = useLiveQuery(() => db.presets.toArray(), []);

  const [history, setHistory] = useState<Adjustments[]>([DEFAULT_ADJUSTMENTS]);
  const [cursor, setCursor] = useState(0);
  const adj = history[cursor];
  const [cropMode, setCropMode] = useState(false);
  const [ratio, setRatio] = useState<number | "original" | null>(null);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | PermissionNeededError | null>(null);
  const [reload, setReload] = useState(0);

  const rendererRef = useRef<ColorRenderer | null>(null);
  const sourceRef = useRef<ImageBitmap | null>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);

  // Carrega as edições salvas e a imagem de trabalho.
  useEffect(() => {
    let alive = true;
    setReady(false);
    setLoadError(null);
    (async () => {
      const p = await db.photos.get(photoId);
      if (!p) return;
      const saved = await db.edits.get(photoId);
      if (alive && !loadedRef.current) {
        setHistory([saved ? { ...DEFAULT_ADJUSTMENTS, ...saved.adjustments } : DEFAULT_ADJUSTMENTS]);
        setCursor(0);
        loadedRef.current = true;
      }
      try {
        const renderer = rendererRef.current ?? new ColorRenderer();
        rendererRef.current = renderer;
        const src = await loadSource(p, renderer, PREVIEW_SIDE);
        if (!alive) return src.close();
        sourceRef.current?.close();
        sourceRef.current = src;
        renderer.setImage(src);
        setReady(true);
      } catch (err) {
        if (alive) setLoadError(err instanceof PermissionNeededError ? err : errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [photoId, reload]);

  useEffect(
    () => () => {
      sourceRef.current?.close();
      rendererRef.current?.dispose();
    },
    [],
  );

  // Renderiza a prévia sempre que os ajustes mudam (RNF-04).
  useEffect(() => {
    const renderer = rendererRef.current;
    const after = afterRef.current;
    if (!ready || !renderer || !after) return;
    const frame = requestAnimationFrame(() => {
      const geometryOnly = cropMode ? { ...adj, crop: { x: 0, y: 0, w: 1, h: 1 } } : adj;
      renderer.render(adj);
      paint(renderer.canvas, geometryOnly, after);
      if (compare && beforeRef.current) {
        renderer.render(DEFAULT_ADJUSTMENTS);
        paint(renderer.canvas, geometryOnly, beforeRef.current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [adj, ready, cropMode, compare]);

  // Salva automaticamente (a edição é só uma lista de instruções; o original nunca muda).
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => persist(photoId, adj, false), 500);
    return () => clearTimeout(t);
  }, [adj, photoId]);

  const commit = useCallback(
    (next: Adjustments) => {
      setHistory((h) => [...h.slice(0, cursor + 1), next].slice(-200));
      setCursor((c) => Math.min(c + 1, 199));
    },
    [cursor],
  );

  /** Ajuste contínuo (arrastar slider) substitui o passo atual em vez de empilhar. */
  const [dragging, setDragging] = useState(false);
  const change = (patch: Partial<Adjustments>) => {
    const next = { ...adj, ...patch };
    if (dragging) setHistory((h) => h.map((a, i) => (i === cursor ? next : a)));
    else commit(next);
  };

  const undo = () => setCursor((c) => Math.max(0, c - 1));
  const redo = () => setCursor((c) => Math.min(history.length - 1, c + 1));

  const close = async () => {
    await persist(photoId, adj, true);
    useApp.getState().bumpThumb(photoId);
    useApp.getState().openEditor(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        e.stopImmediatePropagation();
        if (cropMode) setCropMode(false);
        else close();
      } else if (!mod && e.key === "\\") setCompare((c) => !c);
      else if (!mod && e.key.toLowerCase() === "c") setCropMode((c) => !c);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const enhance = async () => {
    if (!(await aiEnabled())) return toast("Ative a IA em Configurações.", "error");
    if (!canUseAI()) return toast("Entre com sua conta Google para usar a IA.", "error");
    setAiBusy(true);
    try {
      const s = await suggestAdjustments(photoId);
      commit(mergeAdjustments(adj, s));
      toast("Ajustes da IA aplicados. Use Desfazer para reverter.", "success");
    } catch (err) {
      toast(`Não foi possível aprimorar: ${errorMessage(err)}`, "error");
    } finally {
      setAiBusy(false);
    }
  };

  const savePreset = async () => {
    const name = await promptText("Nome da predefinição", "", "Salvar");
    if (!name) return;
    const { rotate: _r, flipH: _f, straighten: _s, crop: _c, ...color } = adj;
    await db.presets.add({ name, adjustments: color });
    toast("Predefinição salva.", "success");
  };

  const src = sourceRef.current;
  const imageRatio = src ? (adj.rotate % 2 ? src.height / src.width : src.width / src.height) : 1;
  const effectiveRatio = ratio === "original" ? imageRatio : ratio;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-label="Editor">
      <header className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2">
        <button className="btn-ghost btn" onClick={close}>
          <Icon name="left" /> Voltar
        </button>
        <span className="truncate text-sm font-medium">{photo?.fileName}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost btn !px-2" onClick={undo} disabled={cursor === 0} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
            <Icon name="undo" />
          </button>
          <button className="btn-ghost btn !px-2" onClick={redo} disabled={cursor >= history.length - 1} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">
            <Icon name="redo" />
          </button>
          <span className="mx-1 text-xs text-muted">{cursor} passo(s)</span>
          <button className={`btn ${compare ? "!border-accent" : ""}`} onClick={() => setCompare((c) => !c)} title="Antes/depois (\)" aria-pressed={compare}>
            <Icon name="compare" /> Antes/depois
          </button>
          <button className="btn" onClick={() => commit(DEFAULT_ADJUSTMENTS)} disabled={isDefault(adj)} title="Voltar ao original">
            Original
          </button>
          <button className="btn" onClick={() => setExporting(true)}>
            <Icon name="download" /> Exportar
          </button>
          <button className="btn btn-primary" onClick={close}>
            Concluir
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 items-center justify-center bg-black/90 p-6">
          {loadError ? (
            loadError instanceof PermissionNeededError ? (
              <div className="space-y-3 text-center text-white">
                <p>{loadError.message}</p>
                <button className="btn btn-primary" onClick={async () => (await requestPermission(loadError.folder.handle!)) && setReload((n) => n + 1)}>
                  Autorizar acesso
                </button>
              </div>
            ) : (
              <p className="text-white/70">{loadError}</p>
            )
          ) : (
            <div className="relative inline-flex max-h-full max-w-full">
              <canvas ref={afterRef} className="block max-h-[calc(100vh-7rem)] max-w-full" />
              {compare && (
                <>
                  <canvas
                    ref={beforeRef}
                    className="absolute inset-0 h-full w-full"
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                  />
                  <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${split}%` }} />
                  <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 text-xs text-white">Antes</span>
                  <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 text-xs text-white">Depois</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={split}
                    onChange={(e) => setSplit(Number(e.target.value))}
                    className="absolute inset-x-0 bottom-2 mx-auto !w-1/2"
                    aria-label="Divisão antes/depois"
                  />
                </>
              )}
              {cropMode && ready && (
                <CropOverlay
                  crop={adj.crop}
                  ratio={effectiveRatio}
                  canvasRef={afterRef}
                  onStart={() => commit({ ...adj })}
                  onChange={(crop) => setHistory((h) => h.map((a, i) => (i === cursor ? { ...a, crop } : a)))}
                />
              )}
            </div>
          )}
          {!ready && !loadError && <p className="absolute text-white/70">Carregando…</p>}
        </div>

        <aside className="w-80 shrink-0 space-y-6 overflow-y-auto border-l border-line bg-panel p-4" onPointerDown={() => setDragging(false)}>
          <section>
            <h3 className="section-title flex items-center gap-1"><Icon name="sparkles" size={12} /> IA</h3>
            <button className="btn w-full" onClick={enhance} disabled={aiBusy}>
              <Icon name="sparkles" /> {aiBusy ? "Analisando…" : "Aprimorar com IA"}
            </button>
          </section>

          <section>
            <h3 className="section-title">Corte e rotação</h3>
            <div className="mb-2 flex flex-wrap gap-1">
              <button className={`btn ${cropMode ? "!border-accent" : ""}`} onClick={() => setCropMode((c) => !c)} aria-pressed={cropMode} title="Cortar (C)">
                <Icon name="crop" /> {cropMode ? "Concluir corte" : "Cortar"}
              </button>
              <button className="btn !px-2" onClick={() => commit({ ...adj, rotate: ((adj.rotate + 1) % 4) as Adjustments["rotate"], crop: DEFAULT_ADJUSTMENTS.crop })} title="Girar 90°" aria-label="Girar 90 graus">
                <Icon name="rotate" />
              </button>
              <button className="btn !px-2" onClick={() => commit({ ...adj, flipH: !adj.flipH })} title="Espelhar" aria-label="Espelhar">
                <Icon name="flip" />
              </button>
              <button className="btn-ghost btn" onClick={() => commit({ ...adj, crop: DEFAULT_ADJUSTMENTS.crop, straighten: 0 })}>Redefinir</button>
            </div>
            {cropMode && (
              <div className="mb-2 flex flex-wrap gap-1">
                {RATIOS.map((r) => (
                  <button
                    key={r.label}
                    className={`chip ${ratio === r.value ? "!border-accent text-accent" : ""}`}
                    onClick={() => {
                      setRatio(r.value);
                      const target = r.value === "original" ? imageRatio : r.value;
                      if (target && src) commit({ ...adj, crop: fitRatio(adj.crop, target, imageRatio) });
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            <Slider label="Endireitar" value={adj.straighten} min={-45} max={45} step={0.1} onChange={(v) => change({ straighten: v })} onDrag={setDragging} suffix="°" />
          </section>

          {SLIDERS.map((group) => (
            <section key={group.section}>
              <h3 className="section-title">{group.section}</h3>
              <div className="space-y-2.5">
                {group.items.map((s) => (
                  <Slider key={s.key} label={s.label} value={adj[s.key]} min={s.min} max={s.max} step={s.step} onChange={(v) => change({ [s.key]: v })} onDrag={setDragging} />
                ))}
              </div>
            </section>
          ))}

          <section>
            <h3 className="section-title">Predefinições</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {[...BUILTIN_PRESETS, ...(userPresets ?? [])].map((p, i) => (
                <button key={`${p.name}-${i}`} className="btn !justify-start truncate" onClick={() => commit(mergeAdjustments({ ...DEFAULT_ADJUSTMENTS, rotate: adj.rotate, flipH: adj.flipH, straighten: adj.straighten, crop: adj.crop }, p.adjustments))}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button className="btn-ghost btn" onClick={savePreset}>+ Salvar atual</button>
              <button className="btn-ghost btn" onClick={() => { clipboard = adj; toast("Ajustes copiados."); }}>Copiar ajustes</button>
              <button className="btn-ghost btn" disabled={!clipboard} onClick={() => clipboard && commit({ ...clipboard })}>Colar ajustes</button>
            </div>
          </section>
        </aside>
      </div>

      {exporting && photo && (
        <ExportDialog
          ids={[photoId]}
          onClose={() => setExporting(false)}
          onExport={async (settings) => {
            try {
              const blob = await exportPhoto(photo, settings, adj);
              await saveBlob(blob, exportName(photo, settings.format));
            } catch (err) {
              toast(`Falha ao exportar: ${errorMessage(err)}`, "error");
            }
          }}
        />
      )}
    </div>
  );
}

/** Aplica geometria e corte do canvas colorido para o canvas de exibição. */
function paint(colored: HTMLCanvasElement | OffscreenCanvas, a: Adjustments, target: HTMLCanvasElement) {
  const oriented = new OffscreenCanvas(1, 1);
  drawGeometry(colored, a, oriented);
  const cw = Math.max(1, Math.round(a.crop.w * oriented.width));
  const ch = Math.max(1, Math.round(a.crop.h * oriented.height));
  if (target.width !== cw || target.height !== ch) {
    target.width = cw;
    target.height = ch;
  }
  target.getContext("2d")!.drawImage(oriented, a.crop.x * oriented.width, a.crop.y * oriented.height, cw, ch, 0, 0, cw, ch);
}

async function persist(photoId: number, adjustments: Adjustments, withThumb: boolean) {
  if (isDefault(adjustments)) {
    await db.edits.delete(photoId);
    await db.photos.update(photoId, { edited: 0 });
    if (withThumb) await db.thumbs.update(photoId, { edited: undefined });
    return;
  }
  await db.edits.put({ photoId, adjustments, updatedAt: Date.now() });
  await db.photos.update(photoId, { edited: 1 });
  if (!withThumb) return;
  try {
    const photo = await db.photos.get(photoId);
    if (!photo) return;
    const blob = await exportPhoto(photo, { format: "image/webp", maxSide: THUMB_SIDE, quality: 0.82 }, adjustments);
    await db.thumbs.update(photoId, { edited: blob });
  } catch {
    /* sem acesso ao original: mantém a miniatura anterior */
  }
}

/** Ajusta o retângulo de corte à proporção pedida, centralizado. */
function fitRatio(crop: CropRect, ratio: number, imageRatio: number): CropRect {
  // Em coordenadas normalizadas: (w / h) * imageRatio = ratio
  let w = crop.w;
  let h = (w * imageRatio) / ratio;
  if (h > 1) {
    h = 1;
    w = (h * ratio) / imageRatio;
  }
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  return { w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function Slider({ label, value, min, max, step, onChange, onDrag, suffix = "" }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; onDrag: (d: boolean) => void; suffix?: string }) {
  const display = step < 1 ? value.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(value));
  return (
    <label className="block" onDoubleClick={() => onChange(0)} title="Clique duas vezes para zerar">
      <span className="mb-0.5 flex justify-between text-xs">
        <span>{label}</span>
        <span className={value ? "text-accent" : "text-muted"}>{value > 0 ? "+" : ""}{display}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={(e) => {
          e.stopPropagation();
          onChange(value); // empilha um passo de histórico no início do arraste
          onDrag(true);
        }}
        onPointerUp={() => onDrag(false)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

type Handle = "move" | "nw" | "ne" | "sw" | "se";

/** Retângulo de corte arrastável sobre a imagem (RF-40). */
function CropOverlay({
  crop,
  ratio,
  canvasRef,
  onStart,
  onChange,
}: {
  crop: CropRect;
  ratio: number | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onStart: () => void;
  onChange: (c: CropRect) => void;
}) {
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    overlayRef.current?.setPointerCapture(e.pointerId);
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: crop };
    onStart(); // novo passo no histórico, para o Desfazer voltar ao corte anterior
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    const s = d.start;
    const MIN = 0.05;

    if (d.handle === "move") {
      onChange({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }
    const left = d.handle === "nw" || d.handle === "sw";
    const top = d.handle === "nw" || d.handle === "ne";
    // O canto oposto fica fixo.
    const fx = left ? s.x + s.w : s.x;
    const fy = top ? s.y + s.h : s.y;
    const maxW = left ? fx : 1 - fx;
    const maxH = top ? fy : 1 - fy;
    let w = clamp((left ? -dx : dx) + s.w, MIN, maxW);
    let h = clamp((top ? -dy : dy) + s.h, MIN, maxH);
    if (ratio) {
      const imageRatio = rect.width / rect.height; // normalizado → pixels
      h = (w * imageRatio) / ratio;
      if (h > maxH) {
        h = maxH;
        w = (h * ratio) / imageRatio;
      }
    }
    onChange({ x: left ? fx - w : fx, y: top ? fy - h : fy, w, h });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const corner = "absolute h-3.5 w-3.5 rounded-sm border-2 border-white bg-black/40";
  return (
    <div ref={overlayRef} className="absolute inset-0 touch-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div
        className="absolute cursor-move border border-white/90"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.w * 100}%`,
          height: `${crop.h * 100}%`,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          backgroundImage:
            "linear-gradient(to right, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.4%, transparent 66.5%, rgba(255,255,255,.35) 66.6%, transparent 66.7%), linear-gradient(to bottom, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.4%, transparent 66.5%, rgba(255,255,255,.35) 66.6%, transparent 66.7%)",
        }}
        onPointerDown={onPointerDown("move")}
      >
        <span className={`${corner} -top-1.5 -left-1.5 cursor-nw-resize`} onPointerDown={onPointerDown("nw")} />
        <span className={`${corner} -top-1.5 -right-1.5 cursor-ne-resize`} onPointerDown={onPointerDown("ne")} />
        <span className={`${corner} -bottom-1.5 -left-1.5 cursor-sw-resize`} onPointerDown={onPointerDown("sw")} />
        <span className={`${corner} -right-1.5 -bottom-1.5 cursor-se-resize`} onPointerDown={onPointerDown("se")} />
      </div>
    </div>
  );
}
