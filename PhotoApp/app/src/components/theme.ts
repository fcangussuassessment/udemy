export type Theme = "dark" | "light" | "system";

const KEY = "lumina.theme";

export function getTheme(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) || "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme = getTheme()) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getTheme() === "system") applyTheme("system");
});
