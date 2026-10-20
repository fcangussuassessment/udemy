import type { ColorLabel } from "../db/db";

export const COLOR_HEX: Record<ColorLabel, string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
};

export const COLOR_NAME: Record<ColorLabel, string> = {
  red: "Vermelho",
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
  purple: "Roxo",
};

/** Atalhos de rótulo de cor, no padrão do Lightroom (6 vermelho … 9 azul). */
export const COLOR_KEYS: Record<string, ColorLabel> = { "6": "red", "7": "yellow", "8": "green", "9": "blue" };
