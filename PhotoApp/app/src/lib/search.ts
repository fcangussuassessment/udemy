import { db, type Photo } from "../db/db";
import { useApp, type SearchResult } from "../store";
import { aiEnabled, interpretQuery, type SearchInterpretation } from "./ai";
import { canUseAI } from "./auth";

/** Normaliza para comparação sem acentos e sem maiúsculas. */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Parsed {
  text: string[];
  tags: string[];
  year?: number;
  minRating?: number;
  favorite?: boolean;
  camera?: string;
  album?: string;
  orientation?: SearchInterpretation["orientation"];
}

/** RF-62: sintaxe `tag:praia ano:2024 nota:>=4 fav camera:canon album:viagem`. */
export function parseQuery(q: string): Parsed {
  const out: Parsed = { text: [], tags: [] };
  const tokens = q.match(/(\w+:"[^"]+"|\w+:\S+|"[^"]+"|\S+)/g) ?? [];
  for (const raw of tokens) {
    const m = raw.match(/^(\w+):"?(.+?)"?$/);
    const key = m ? norm(m[1]) : "";
    const value = m ? m[2] : "";
    if (key === "tag") out.tags.push(norm(value));
    else if (key === "ano" || key === "year") out.year = Number(value) || undefined;
    else if (key === "nota" || key === "rating") out.minRating = Number(value.replace(/[^\d]/g, "")) || undefined;
    else if (key === "camera") out.camera = norm(value);
    else if (key === "album") out.album = norm(value);
    else if (key === "orientacao") out.orientation = value.startsWith("v") || value.startsWith("r") ? "portrait" : value.startsWith("q") ? "square" : "landscape";
    else if (norm(raw) === "fav" || norm(raw) === "favoritas") out.favorite = true;
    else out.text.push(norm(raw.replace(/"/g, "")));
  }
  return out;
}

const hasSyntax = (p: Parsed) =>
  p.tags.length > 0 || p.year || p.minRating || p.favorite || p.camera || p.album || p.orientation;

/** Parece uma frase em linguagem natural (e não uma busca por palavra/filtro)? */
const isNatural = (p: Parsed) => !hasSyntax(p) && p.text.length >= 2;

export function orientationOf(p: Photo): "landscape" | "portrait" | "square" {
  const r = p.width / p.height;
  return r > 1.05 ? "landscape" : r < 0.95 ? "portrait" : "square";
}

interface Index {
  photos: Photo[];
  haystack: Map<number, { tags: string[]; description: string; name: string; camera: string; albums: string[] }>;
}

async function buildIndex(): Promise<Index> {
  const [photos, tags, photoTags, annotations, albums, albumPhotos] = await Promise.all([
    db.photos.filter((p) => !p.deletedAt).toArray(),
    db.tags.toArray(),
    db.photoTags.toArray(),
    db.aiAnnotations.toArray(),
    db.albums.toArray(),
    db.albumPhotos.toArray(),
  ]);
  const tagName = new Map(tags.map((t) => [t.id, norm(t.name)]));
  const albumName = new Map(albums.map((a) => [a.id, norm(a.name)]));
  const haystack: Index["haystack"] = new Map();
  for (const p of photos) {
    haystack.set(p.id, { tags: [], description: "", name: norm(p.fileName), camera: norm(`${p.cameraMake ?? ""} ${p.cameraModel ?? ""}`), albums: [] });
  }
  for (const r of photoTags) haystack.get(r.photoId)?.tags.push(tagName.get(r.tagId) ?? "");
  for (const a of annotations) {
    const h = haystack.get(a.photoId);
    if (h) h.description = norm(`${a.description} ${a.altText}`);
  }
  for (const r of albumPhotos) haystack.get(r.photoId)?.albums.push(albumName.get(r.albumId) ?? "");
  return { photos, haystack };
}

/** Pontua cada foto pelos termos encontrados, guardando o motivo (RF-61). */
function score(index: Index, terms: string[], structured: Parsed): SearchResult["reasons"] {
  const reasons = new Map<number, string[]>();
  const scores = new Map<number, number>();
  for (const p of index.photos) {
    const h = index.haystack.get(p.id)!;
    if (structured.year && new Date(p.takenAt).getFullYear() !== structured.year) continue;
    if (structured.minRating && p.rating < structured.minRating) continue;
    if (structured.favorite && !p.favorite) continue;
    if (structured.camera && !h.camera.includes(structured.camera)) continue;
    if (structured.album && !h.albums.some((a) => a.includes(structured.album!))) continue;
    if (structured.orientation && orientationOf(p) !== structured.orientation) continue;
    if (structured.tags.length && !structured.tags.every((t) => h.tags.includes(t))) continue;

    const why = new Set<string>();
    let s = 0;
    for (const term of terms) {
      if (h.tags.some((t) => t === term)) { s += 3; why.add(`tag "${term}"`); }
      else if (h.tags.some((t) => t.includes(term))) { s += 2; why.add(`tag ~ "${term}"`); }
      if (h.description.includes(term)) { s += 1.5; why.add("descrição da IA"); }
      if (h.name.includes(term)) { s += 1; why.add("nome do arquivo"); }
      if (h.camera.includes(term)) { s += 1; why.add("câmera"); }
      if (h.albums.some((a) => a.includes(term))) { s += 1; why.add("álbum"); }
    }
    if (!terms.length) { s = 1; why.add("filtros"); }
    if (s > 0) {
      scores.set(p.id, s);
      reasons.set(p.id, [...why]);
    }
  }
  // Ordena os motivos pela pontuação (Map mantém ordem de inserção).
  return new Map([...reasons].sort((a, b) => scores.get(b[0])! - scores.get(a[0])!));
}

/** RF-52/RF-63: executa a busca, usando a IA para frases em linguagem natural. */
export async function runSearch(query: string): Promise<void> {
  const q = query.trim();
  const { setSearch } = useApp.getState();
  if (!q) return setSearch(null);
  const parsed = parseQuery(q);
  const index = await buildIndex();
  let terms = parsed.text;
  let mode: SearchResult["mode"] = "local";
  let note: string | undefined;

  if (isNatural(parsed)) {
    if ((await aiEnabled()) && canUseAI() && navigator.onLine) {
      try {
        const ai = await interpretQuery(q);
        terms = [...new Set(ai.terms.map(norm).filter(Boolean))];
        Object.assign(parsed, {
          year: ai.year ?? undefined,
          minRating: ai.minRating ?? undefined,
          favorite: ai.favorite ?? undefined,
          orientation: ai.orientation ?? undefined,
        });
        mode = "ai";
      } catch {
        note = "Busca inteligente indisponível; mostrando busca textual.";
      }
    } else {
      note = !navigator.onLine
        ? "Você está offline: busca inteligente indisponível, mostrando busca textual."
        : "Dica: ative a IA e entre com o Google para buscar por frases.";
    }
  }

  // Na busca textual, palavras muito curtas atrapalham mais do que ajudam.
  const effective = mode === "local" ? terms.filter((t) => t.length > 2 || terms.length === 1) : terms;
  const reasons = score(index, effective, parsed);
  setSearch({ query: q, ids: new Set(reasons.keys()), reasons, mode, note });
}
