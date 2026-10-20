import { create } from "zustand";
import { db, ensureTag, getSetting, type Photo } from "../db/db";
import { toast, errorMessage } from "../store";
import { authHeaders, canUseAI, handleUnauthorized } from "./auth";
import { blobToBase64, decode, resizeToBlob } from "./images";
import { getOriginalFile } from "./files";
import type { Adjustments } from "./editor/adjustments";

/** Lado maior da miniatura enviada à IA. Originais nunca saem do dispositivo (RNF-06). */
const AI_SIDE = 1024;
const CONCURRENCY = 2;

interface AnalysisResponse {
  tags: string[];
  description: string;
  altText: string;
  adjustments: Partial<Adjustments>;
}

export interface SearchInterpretation {
  terms: string[];
  year: number | null;
  month: number | null;
  minRating: number | null;
  favorite: boolean | null;
  orientation: "landscape" | "portrait" | "square" | null;
}

export class AIRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new AIRequestError(data.error ?? `Erro ${res.status}`, res.status);
  }
  return res.json();
}

export const aiEnabled = () => getSetting("aiConsent", false);

// --- Fila de análise (RF-55/RF-56) ---

export interface AIJobItem {
  photoId: number;
  status: "pending" | "running" | "done" | "error";
  error?: string;
}

interface QueueState {
  items: AIJobItem[];
  paused: boolean;
  running: number;
}

export const useAIQueue = create<QueueState>(() => ({ items: [], paused: false, running: 0 }));

function updateItem(photoId: number, patch: Partial<AIJobItem>) {
  useAIQueue.setState((s) => ({ items: s.items.map((i) => (i.photoId === photoId ? { ...i, ...patch } : i)) }));
}

/** Adiciona fotos à fila. Fotos já analisadas são ignoradas, salvo `force`. */
export async function enqueueAnalysis(photoIds: number[], force = false) {
  if (!(await aiEnabled())) {
    toast("Ative a IA em Configurações para analisar fotos.", "error");
    return 0;
  }
  if (!canUseAI()) {
    toast("Entre com sua conta Google para usar a IA.", "error");
    return 0;
  }
  const analyzed = new Set((await db.aiAnnotations.bulkGet(photoIds)).filter(Boolean).map((a) => a!.photoId));
  const inQueue = new Set(useAIQueue.getState().items.filter((i) => i.status !== "done" && i.status !== "error").map((i) => i.photoId));
  const ids = photoIds.filter((id) => (force || !analyzed.has(id)) && !inQueue.has(id));
  if (!ids.length) {
    toast("Essas fotos já foram analisadas.");
    return 0;
  }
  useAIQueue.setState((s) => ({
    items: [...s.items.filter((i) => !ids.includes(i.photoId)), ...ids.map((photoId) => ({ photoId, status: "pending" as const }))],
  }));
  pump();
  return ids.length;
}

export function pauseQueue(paused: boolean) {
  useAIQueue.setState({ paused });
  if (!paused) pump();
}

export function clearFinished() {
  useAIQueue.setState((s) => ({ items: s.items.filter((i) => i.status === "pending" || i.status === "running") }));
}

export function cancelPending() {
  useAIQueue.setState((s) => ({ items: s.items.filter((i) => i.status !== "pending") }));
}

function pump() {
  const s = useAIQueue.getState();
  if (s.paused) return;
  const free = CONCURRENCY - s.running;
  const next = s.items.filter((i) => i.status === "pending").slice(0, free);
  for (const item of next) {
    updateItem(item.photoId, { status: "running" });
    useAIQueue.setState((st) => ({ running: st.running + 1 }));
    analyzeOne(item.photoId)
      .then(() => updateItem(item.photoId, { status: "done" }))
      .catch((err) => {
        updateItem(item.photoId, { status: "error", error: errorMessage(err) });
        // Sem login ou servidor fora do ar: pausa para não falhar em cascata.
        if (err instanceof AIRequestError && (err.status === 401 || err.status === 429 || err.status >= 500)) {
          useAIQueue.setState({ paused: true });
          toast(`IA pausada: ${err.message}`, "error");
        }
      })
      .finally(() => {
        useAIQueue.setState((st) => ({ running: st.running - 1 }));
        pump();
      });
  }
}

/** Miniatura em JPEG sem metadados para envio à IA. */
async function aiPreview(photo: Photo): Promise<Blob> {
  let source: Blob;
  try {
    source = await getOriginalFile(photo);
  } catch {
    // Sem acesso ao original: usa a miniatura local.
    const thumb = await db.thumbs.get(photo.id);
    if (!thumb) throw new Error("Imagem indisponível.");
    source = thumb.original;
  }
  const bitmap = await decode(source);
  const blob = await resizeToBlob(bitmap, AI_SIDE, "image/jpeg", 0.85);
  bitmap.close();
  return blob;
}

async function analyzeOne(photoId: number) {
  const photo = await db.photos.get(photoId);
  if (!photo) return;
  const image = await blobToBase64(await aiPreview(photo));
  const result = await post<AnalysisResponse>("/api/ai/analyze", { image, mediaType: "image/jpeg" });
  const tagIds = await Promise.all(result.tags.map(ensureTag));
  await db.transaction("rw", db.aiAnnotations, db.photoTags, async () => {
    await db.aiAnnotations.put({
      photoId,
      model: "claude",
      description: result.description,
      altText: result.altText,
      suggested: result.adjustments,
      analyzedAt: Date.now(),
    });
    const existing = new Set((await db.photoTags.where("photoId").equals(photoId).toArray()).map((r) => r.tagId));
    await db.photoTags.bulkPut(
      tagIds.filter((t) => !existing.has(t)).map((tagId) => ({ photoId, tagId, source: "ai", status: "suggested" })),
    );
  });
}

/** RF-53: obtém (ou reutiliza do cache) a sugestão de ajustes da IA para uma foto. */
export async function suggestAdjustments(photoId: number): Promise<Partial<Adjustments>> {
  const cached = await db.aiAnnotations.get(photoId);
  if (cached) return cached.suggested;
  await analyzeOne(photoId);
  return (await db.aiAnnotations.get(photoId))?.suggested ?? {};
}

export function interpretQuery(query: string) {
  return post<SearchInterpretation>("/api/ai/search", { query });
}

/** Remove todas as descrições e tags geradas pela IA (US-07). */
export async function deleteAllAIData() {
  await db.transaction("rw", db.aiAnnotations, db.photoTags, async () => {
    await db.aiAnnotations.clear();
    const aiRows = await db.photoTags.filter((r) => r.source === "ai").toArray();
    await db.photoTags.bulkDelete(aiRows.map((r) => [r.photoId, r.tagId] as [number, number]));
  });
}
