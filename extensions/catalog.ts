import type { Model } from "@earendil-works/pi-ai";

const PROVIDER_ID = "hostyourai";
const DEFAULT_CONTEXT_WINDOW = 128_000;
const MAX_CONTEXT_WINDOW = 2_000_000;
const DEFAULT_MAX_TOKENS = 8_192;
const MAX_OUTPUT_TOKENS = 131_072;
const MAX_PRICE_PER_MILLION = 1_000_000;
const MAX_CATALOG_MODELS = 2_000;
const DEFAULT_EUR_TO_USD_RATE = 1.1;
const UNSAFE_LABEL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;
const HAS_UNSAFE_LABEL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

type HostYourAIModel = {
  id: string;
  display_name?: unknown;
  available: true;
  serveable: true;
  supports_tools: true;
  supports_images?: unknown;
  modality: string;
  context_length?: unknown;
  served_context_length?: unknown;
  max_output_tokens?: unknown;
  pricing?: unknown;
};

type HostYourAIModelInfo = Model<"openai-completions">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsableChatModel(value: unknown): value is HostYourAIModel {
  if (!isRecord(value)) return false;
  const { id, modality } = value;
  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    id !== id.trim() ||
    id.length > 256 ||
    HAS_UNSAFE_LABEL_CHARS.test(id) ||
    typeof modality !== "string" ||
    value.available !== true ||
    value.serveable !== true ||
    value.supports_tools !== true
  ) {
    return false;
  }

  const normalizedModality = modality.toLowerCase().replace(/\s/g, "");
  return normalizedModality === "text->text" || normalizedModality === "text+image->text";
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  const integer = Math.floor(value);
  return integer < 1 ? fallback : Math.min(integer, maximum);
}

function nonNegativePrice(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, MAX_PRICE_PER_MILLION);
}

function sanitizeLabel(value: unknown, fallback: string): string {
  const label = typeof value === "string" ? value : fallback;
  return label.replace(UNSAFE_LABEL_CHARS, "").trim().slice(0, 120) || fallback;
}

function getPrice(pricing: unknown, key: string, eurToUsdRate: number): number {
  if (!isRecord(pricing)) return 0;
  return nonNegativePrice(pricing[key]) * eurToUsdRate;
}

function toPiModel(model: HostYourAIModel, eurToUsdRate: number): HostYourAIModelInfo {
  const contextWindow = positiveInteger(
    model.served_context_length,
    positiveInteger(model.context_length, DEFAULT_CONTEXT_WINDOW, MAX_CONTEXT_WINDOW),
    MAX_CONTEXT_WINDOW,
  );
  const maxTokens = Math.min(
    positiveInteger(model.max_output_tokens, DEFAULT_MAX_TOKENS, MAX_OUTPUT_TOKENS),
    contextWindow,
  );
  const supportsImages =
    model.supports_images === true &&
    model.modality.toLowerCase().replace(/\s/g, "") === "text+image->text";

  return {
    id: model.id,
    name: sanitizeLabel(model.display_name, model.id),
    api: "openai-completions",
    provider: PROVIDER_ID,
    reasoning: false,
    input: supportsImages ? ["text", "image"] : ["text"],
    contextWindow,
    maxTokens,
    cost: {
      input: getPrice(model.pricing, "input_per_million", eurToUsdRate),
      output: getPrice(model.pricing, "output_per_million", eurToUsdRate),
      cacheRead: getPrice(model.pricing, "cached_input_per_million", eurToUsdRate),
      cacheWrite: 0,
    },
  };
}

export function getEurToUsdRate(configuredRate = process.env.HOSTYOURAI_EUR_TO_USD_RATE): number {
  if (configuredRate === undefined || configuredRate.trim() === "") {
    return DEFAULT_EUR_TO_USD_RATE;
  }
  const rate = Number(configuredRate);
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) {
    throw new Error("HOSTYOURAI_EUR_TO_USD_RATE must be a number between 0.5 and 2.");
  }
  return rate;
}

export function mapHostYourAIModels(
  data: unknown[],
  eurToUsdRate = getEurToUsdRate(),
): HostYourAIModelInfo[] {
  if (!Number.isFinite(eurToUsdRate) || eurToUsdRate < 0.5 || eurToUsdRate > 2) {
    throw new Error("EUR-to-USD rate must be a number between 0.5 and 2.");
  }
  if (data.length > MAX_CATALOG_MODELS) {
    throw new Error(`HostYourAI model catalog exceeds the ${MAX_CATALOG_MODELS}-model limit.`);
  }

  const mapped: HostYourAIModelInfo[] = [];
  const seenIds = new Set<string>();
  for (const candidate of data) {
    if (!isUsableChatModel(candidate) || seenIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);
    mapped.push(toPiModel(candidate, eurToUsdRate));
  }
  return mapped;
}
