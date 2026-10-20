import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export interface PhotoAnalysis {
  tags: string[];
  description: string;
  altText: string;
  adjustments: {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    temperature: number;
    tint: number;
    vibrance: number;
    saturation: number;
  };
}

export interface SearchInterpretation {
  terms: string[];
  year: number | null;
  month: number | null;
  minRating: number | null;
  favorite: boolean | null;
  orientation: "landscape" | "portrait" | "square" | null;
}

const num = (description: string) => ({ type: "number", description });

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags", "description", "altText", "adjustments"],
  properties: {
    tags: { type: "array", items: { type: "string" } },
    description: { type: "string" },
    altText: { type: "string" },
    adjustments: {
      type: "object",
      additionalProperties: false,
      required: ["exposure", "contrast", "highlights", "shadows", "temperature", "tint", "vibrance", "saturation"],
      properties: {
        exposure: num("Ajuste de exposição em stops, de -2 a 2"),
        contrast: num("-100 a 100"),
        highlights: num("-100 a 100"),
        shadows: num("-100 a 100"),
        temperature: num("-100 (mais frio) a 100 (mais quente)"),
        tint: num("-100 (verde) a 100 (magenta)"),
        vibrance: num("-100 a 100"),
        saturation: num("-100 a 100"),
      },
    },
  },
};

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

const searchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["terms", "year", "month", "minRating", "favorite", "orientation"],
  properties: {
    terms: { type: "array", items: { type: "string" } },
    year: nullable({ type: "integer" }),
    month: nullable({ type: "integer" }),
    minRating: nullable({ type: "integer" }),
    favorite: nullable({ type: "boolean" }),
    orientation: nullable({ type: "string", enum: ["landscape", "portrait", "square"] }),
  },
};

const ANALYZE_PROMPT = `Você cataloga fotos para um organizador de fotos pessoal. Analise a imagem e responda em português do Brasil.

- tags: 5 a 15 tags curtas em minúsculas (substantivos ou expressões de 1 a 3 palavras) cobrindo objetos, pessoas (sem identificar quem são), animais, cenário, lugar genérico, atividade, clima, hora do dia e cores dominantes.
- description: 1 a 3 frases descrevendo a cena com os detalhes que alguém usaria para procurar esta foto depois.
- altText: texto alternativo objetivo para leitores de tela, com até 125 caracteres.
- adjustments: ajustes de edição sutis que melhorariam a foto. Use 0 para o que já está bom; não exagere.`;

const SEARCH_PROMPT = `Você converte pedidos de busca de fotos, em linguagem natural, em uma consulta estruturada para um índice local.
O índice contém tags e descrições em português do Brasil geradas automaticamente, então:
- terms: palavras-chave em português, em minúsculas, incluindo sinônimos e formas relacionadas (ex.: "cachorro", "cão", "cachorros"). Não inclua palavras genéricas como "foto" ou "imagem", nem datas.
- year, month (1-12), minRating (1-5), favorite, orientation: preencha apenas se o pedido mencionar explicitamente; caso contrário use null.`;

async function structuredCall<T>(
  content: Anthropic.Beta.Messages.BetaContentBlockParam[],
  schema: Record<string, unknown>,
): Promise<T> {
  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AIError("Chave da API do Claude inválida ou ausente no servidor.", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AIError("A IA está ocupada. Tente novamente em instantes.", 429);
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new AIError(`Requisição recusada pela API: ${err.message}`, 400);
    }
    if (err instanceof Anthropic.APIError) {
      throw new AIError(`Erro da API do Claude (${err.status}).`, 502);
    }
    // Falha antes de a requisição sair (ex.: credenciais ausentes) ou erro de rede.
    console.error(err instanceof Error ? err.message : err);
    throw new AIError("Não foi possível chamar o Claude. Verifique ANTHROPIC_API_KEY em server/.env.", 503);
  }

  if (response.stop_reason === "refusal") {
    throw new AIError("A IA não pôde processar esta foto.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AIError("Resposta da IA incompleta.", 502);
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new AIError("Resposta da IA vazia.", 502);
  try {
    return JSON.parse(text.text) as T;
  } catch {
    throw new AIError("Resposta da IA em formato inválido.", 502);
  }
}

export async function analyzePhoto(
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<PhotoAnalysis> {
  const result = await structuredCall<PhotoAnalysis>(
    [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text: ANALYZE_PROMPT },
    ],
    analysisSchema,
  );
  result.tags = [...new Set(result.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  return result;
}

export async function interpretSearch(query: string): Promise<SearchInterpretation> {
  return structuredCall<SearchInterpretation>(
    [{ type: "text", text: `${SEARCH_PROMPT}\n\nPedido: ${query}` }],
    searchSchema,
  );
}
