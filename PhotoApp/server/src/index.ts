import "dotenv/config";
import express from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { requireAuth, authConfig } from "./auth.js";
import { analyzePhoto, interpretSearch, AIError } from "./claude.js";

const app = express();
app.use(express.json({ limit: "6mb" }));

app.get("/api/config", (_req, res) => {
  res.json(authConfig());
});

// Proteção contra abuso da chave da API (não é cobrança: o app é gratuito).
const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  keyGenerator: (req) => (req as express.Request & { userId?: string }).userId ?? ipKeyGenerator(req.ip ?? ""),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde um minuto e tente novamente." },
});

app.post("/api/ai/analyze", requireAuth, aiLimiter, async (req, res) => {
  const { image, mediaType } = req.body ?? {};
  if (typeof image !== "string" || !image) {
    res.status(400).json({ error: "Campo 'image' (base64) é obrigatório." });
    return;
  }
  const type = mediaType === "image/png" || mediaType === "image/webp" ? mediaType : "image/jpeg";
  try {
    res.json(await analyzePhoto(image, type));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/ai/search", requireAuth, aiLimiter, async (req, res) => {
  const { query } = req.body ?? {};
  if (typeof query !== "string" || !query.trim()) {
    res.status(400).json({ error: "Campo 'query' é obrigatório." });
    return;
  }
  try {
    res.json(await interpretSearch(query.slice(0, 500)));
  } catch (err) {
    sendError(res, err);
  }
});

function sendError(res: express.Response, err: unknown) {
  if (err instanceof AIError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Erro inesperado no servidor de IA." });
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  const { authRequired } = authConfig();
  console.log(`Lumina server em http://localhost:${port}`);
  if (!authRequired) {
    console.warn("GOOGLE_CLIENT_ID não definido: modo de desenvolvimento, IA sem login.");
  }
});
