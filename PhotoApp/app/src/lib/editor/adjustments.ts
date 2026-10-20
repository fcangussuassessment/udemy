export interface CropRect {
  /** Coordenadas normalizadas (0–1) na imagem já girada/endireitada. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Adjustments {
  exposure: number; // stops, -2..2
  contrast: number; // -100..100
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  rotate: 0 | 1 | 2 | 3; // giros de 90° no sentido horário
  flipH: boolean;
  straighten: number; // graus, -45..45
  crop: CropRect;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  rotate: 0,
  flipH: false,
  straighten: 0,
  crop: { x: 0, y: 0, w: 1, h: 1 },
};

export type SliderKey = Exclude<keyof Adjustments, "rotate" | "flipH" | "crop" | "straighten">;

export const SLIDERS: { section: string; items: { key: SliderKey; label: string; min: number; max: number; step: number }[] }[] = [
  {
    section: "Luz",
    items: [
      { key: "exposure", label: "Exposição", min: -2, max: 2, step: 0.01 },
      { key: "contrast", label: "Contraste", min: -100, max: 100, step: 1 },
      { key: "highlights", label: "Realces", min: -100, max: 100, step: 1 },
      { key: "shadows", label: "Sombras", min: -100, max: 100, step: 1 },
      { key: "whites", label: "Brancos", min: -100, max: 100, step: 1 },
      { key: "blacks", label: "Pretos", min: -100, max: 100, step: 1 },
    ],
  },
  {
    section: "Cor",
    items: [
      { key: "temperature", label: "Temperatura", min: -100, max: 100, step: 1 },
      { key: "tint", label: "Matiz", min: -100, max: 100, step: 1 },
      { key: "vibrance", label: "Vibração", min: -100, max: 100, step: 1 },
      { key: "saturation", label: "Saturação", min: -100, max: 100, step: 1 },
    ],
  },
];

export const BUILTIN_PRESETS: { name: string; adjustments: Partial<Adjustments> }[] = [
  { name: "Vívido", adjustments: { contrast: 20, vibrance: 35, saturation: 10 } },
  { name: "Quente", adjustments: { temperature: 35, vibrance: 10 } },
  { name: "Frio", adjustments: { temperature: -30, tint: -5 } },
  { name: "Preto e branco", adjustments: { saturation: -100, contrast: 25 } },
  { name: "Desbotado", adjustments: { contrast: -30, blacks: 35, saturation: -20 } },
  { name: "Dramático", adjustments: { contrast: 45, highlights: -40, shadows: -20, vibrance: 15 } },
];

export function isDefault(a: Adjustments): boolean {
  return JSON.stringify(a) === JSON.stringify(DEFAULT_ADJUSTMENTS);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Mescla ajustes parciais (presets ou sugestões da IA) respeitando os limites. */
export function mergeAdjustments(base: Adjustments, patch: Partial<Adjustments>): Adjustments {
  const next = { ...base, ...patch };
  for (const group of SLIDERS) {
    for (const s of group.items) next[s.key] = clamp(Number(next[s.key]) || 0, s.min, s.max);
  }
  return next;
}
