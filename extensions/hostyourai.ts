import {
  envApiKeyAuth,
  openAICompletionsApi,
  type Model,
  type Provider,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "hostyourai";
const BASE_URL = "https://hostyourai.com/api/v1";
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;

type HostYourAIModel = {
  id: string;
  display_name?: string;
  available?: boolean;
  serveable?: boolean;
  supports_tools?: boolean;
  supports_images?: boolean;
  modality?: string | null;
  context_length?: number | null;
  served_context_length?: number | null;
  max_output_tokens?: number | null;
  pricing?: {
    input_per_million?: number | null;
    cached_input_per_million?: number | null;
    output_per_million?: number | null;
  } | null;
};

type ModelsResponse = { data?: HostYourAIModel[] };
type HostYourAIModelInfo = Model<"openai-completions">;

function positiveNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function isUsableChatModel(model: HostYourAIModel): boolean {
  if (
    !model ||
    typeof model.id !== "string" ||
    model.id.trim().length === 0 ||
    model.id.length > 256 ||
    /[\u0000-\u001f]/.test(model.id)
  ) {
    return false;
  }

  const modality = model.modality?.replace(/\s/g, "") ?? "";
  return (
    model.available === true &&
    model.serveable === true &&
    model.supports_tools === true &&
    modality.startsWith("text") &&
    modality.endsWith("->text")
  );
}

function toPiModel(model: HostYourAIModel): HostYourAIModelInfo {
  const pricing = model.pricing;
  const displayName = typeof model.display_name === "string" && model.display_name.trim()
    ? model.display_name.trim().slice(0, 120)
    : model.id;

  return {
    id: model.id,
    name: displayName,
    api: "openai-completions",
    provider: PROVIDER_ID,
    reasoning: false,
    input: model.supports_images ? ["text", "image"] : ["text"],
    contextWindow: positiveNumber(
      model.served_context_length ?? model.context_length,
      DEFAULT_CONTEXT_WINDOW,
    ),
    maxTokens: positiveNumber(model.max_output_tokens, DEFAULT_MAX_TOKENS),
    cost: {
      input: nonNegativeNumber(pricing?.input_per_million),
      output: nonNegativeNumber(pricing?.output_per_million),
      cacheRead: nonNegativeNumber(pricing?.cached_input_per_million),
      cacheWrite: 0,
    },
  };
}

function createHostYourAIProvider(): Provider<"openai-completions"> {
  let models: HostYourAIModelInfo[] = [];
  const api = openAICompletionsApi();

  return {
    id: PROVIDER_ID,
    name: "HostYourAI",
    baseUrl: BASE_URL,
    auth: {
      apiKey: envApiKeyAuth("HostYourAI API key", ["HOSTYOURAI_API_KEY"]),
    },

    getModels: () => models,

    refreshModels: async (context) => {
      // Restore the saved catalog first so offline startup can still list models.
      if (context.stored) {
        const restored = context.stored.models.filter(
          (model) => model.provider === PROVIDER_ID,
        ) as HostYourAIModelInfo[];
        const published = await context.publish({ update: () => { models = restored; } });
        if (!published) return;
      }

      if (!context.allowNetwork || context.signal.aborted) return;

      const apiKey = context.credential?.type === "api_key"
        ? context.credential.key ?? process.env.HOSTYOURAI_API_KEY
        : process.env.HOSTYOURAI_API_KEY;
      if (!apiKey) return;

      const response = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: context.signal,
      });
      if (!response.ok) {
        throw new Error(`HostYourAI model catalog request failed (HTTP ${response.status}).`);
      }

      const catalog = (await response.json()) as ModelsResponse;
      if (!Array.isArray(catalog.data)) {
        throw new Error("HostYourAI returned an unexpected model catalog format.");
      }

      const refreshed = catalog.data.filter(isUsableChatModel).map(toPiModel);
      await context.publish({
        persist: { models: refreshed, checkedAt: Date.now() },
        update: () => { models = refreshed; },
      });
    },

    stream: (model, context, options) => api.stream(model, context, options),
    streamSimple: (model, context, options) => api.streamSimple(model, context, options),
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(createHostYourAIProvider());
}
