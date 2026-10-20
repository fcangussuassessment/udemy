import { create } from "zustand";

/** RF-76/RF-77: login com Google (Google Identity Services). */

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

interface AuthState {
  ready: boolean;
  /** false quando o servidor roda sem GOOGLE_CLIENT_ID (modo de desenvolvimento). */
  required: boolean;
  clientId: string | null;
  token: string | null;
  expiresAt: number;
  user: GoogleUser | null;
  serverOnline: boolean;
}

const STORAGE_KEY = "lumina.idToken";

export const useAuth = create<AuthState>(() => ({
  ready: false,
  required: true,
  clientId: null,
  token: null,
  expiresAt: 0,
  user: null,
  serverOnline: false,
}));

interface GoogleId {
  initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
  prompt(): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

function decodeJwt(token: string): { name: string; email: string; picture?: string; exp: number } {
  const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    [...atob(part)].map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
  );
  return JSON.parse(json);
}

function acceptToken(token: string) {
  const payload = decodeJwt(token);
  const expiresAt = payload.exp * 1000;
  if (expiresAt < Date.now()) return false;
  useAuth.setState({ token, expiresAt, user: { name: payload.name, email: payload.email, picture: payload.picture } });
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* armazenamento indisponível */
  }
  return true;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Não foi possível carregar o login do Google."));
    document.head.appendChild(s);
  });
}

export async function initAuth() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error();
    const cfg = (await res.json()) as { googleClientId: string | null; authRequired: boolean };
    useAuth.setState({ required: cfg.authRequired, clientId: cfg.googleClientId, serverOnline: true });
    if (cfg.authRequired && cfg.googleClientId) {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) acceptToken(saved);
      } catch {
        /* ignore */
      }
      await loadScript();
      window.google!.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: ({ credential }) => acceptToken(credential),
        auto_select: true,
      });
    }
  } catch {
    useAuth.setState({ serverOnline: false });
  } finally {
    useAuth.setState({ ready: true });
  }
}

export function renderGoogleButton(el: HTMLElement) {
  window.google?.accounts.id.renderButton(el, { theme: "filled_black", size: "medium", text: "signin_with", locale: "pt-BR" });
}

export function signOut() {
  window.google?.accounts.id.disableAutoSelect();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  useAuth.setState({ token: null, user: null, expiresAt: 0 });
}

/** Pode chamar a IA agora? (logado com token válido, ou servidor em modo dev). */
export function canUseAI(): boolean {
  const s = useAuth.getState();
  if (!s.serverOnline) return false;
  if (!s.required) return true;
  return Boolean(s.token && s.expiresAt > Date.now() + 30_000);
}

export function authHeaders(): Record<string, string> {
  const { token, required } = useAuth.getState();
  return required && token ? { Authorization: `Bearer ${token}` } : {};
}

/** Chamado quando o servidor responde 401 (token expirou). */
export function handleUnauthorized() {
  signOut();
  window.google?.accounts.id.prompt();
}
