import type { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";

const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
const oauth = new OAuth2Client(clientId || undefined);

export function authConfig() {
  return { googleClientId: clientId || null, authRequired: Boolean(clientId) };
}

/** Valida o ID token do "Entrar com Google" enviado em Authorization: Bearer. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!clientId) {
    next();
    return;
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Entre com sua conta Google para usar a IA." });
    return;
  }
  try {
    const ticket = await oauth.verifyIdToken({ idToken: token, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error("token sem sub");
    (req as Request & { userId?: string }).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Sessão expirada. Entre novamente com o Google." });
  }
}
