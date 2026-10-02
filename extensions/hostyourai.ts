import {
  envApiKeyAuth,
  openAICompletionsApi,
  type Model,
  type Provider,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getEurToUsdRate, mapHostYourAIModels } from "./catalog.ts";

const PROVIDER_ID = "hostyourai";
const BASE_URL = "https://hostyourai.com/api/v1";
const MAX_CATALOG_BYTES = 5 * 1024 * 1024;
const CATALOG_TIMEOUT_MS = 15_000;

type HostYourAIModelsResponse = { data: unknown[] };
type HostYourAIModelInfo = Model<"openai-completions">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBoundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CATALOG_BYTES) {
    throw new Error("HostYourAI model catalog exceeds the 5 MiB size limit.");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("HostYourAI returned an empty model catalog response.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error("HostYourAI model catalog request was aborted.");
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_CATALOG_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error("HostYourAI model catalog exceeds the 5 MiB size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
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

      const timeoutSignal = AbortSignal.timeout(CATALOG_TIMEOUT_MS);
      const requestSignal = AbortSignal.any([context.signal, timeoutSignal]);
      let response: Response;
      try {
        response = await fetch(`${BASE_URL}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: requestSignal,
          redirect: "error",
        });
      } catch (error) {
        if (context.signal.aborted) return;
        if (timeoutSignal.aborted) {
          throw new Error("HostYourAI model catalog request timed out after 15 seconds.");
        }
        throw error;
      }
      if (!response.ok) {
        throw new Error(`HostYourAI model catalog request failed (HTTP ${response.status}).`);
      }

      let payload: unknown;
      try {
        payload = await readBoundedJson(response, requestSignal);
      } catch (error) {
        if (context.signal.aborted) return;
        if (timeoutSignal.aborted) {
          throw new Error("HostYourAI model catalog response timed out after 15 seconds.");
        }
        throw error;
      }
      if (!isRecord(payload) || !Array.isArray(payload.data)) {
        throw new Error("HostYourAI returned an unexpected model catalog format.");
      }

      const refreshed = mapHostYourAIModels(payload.data, getEurToUsdRate());
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
