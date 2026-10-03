import assert from "node:assert/strict";
import test from "node:test";
import { getEurToUsdRate, mapHostYourAIModels } from "../extensions/catalog.ts";

function model(overrides: Record<string, unknown> = {}) {
  return {
    id: "example/chat-model",
    display_name: "Example Chat Model",
    available: true,
    serveable: true,
    supports_tools: true,
    supports_images: false,
    modality: "text->text",
    context_length: 65_536,
    served_context_length: 32_768,
    max_output_tokens: 8_192,
    pricing: {
      input_per_million: 0.25,
      cached_input_per_million: 0.1,
      output_per_million: 0.4,
    },
    ...overrides,
  };
}

test("maps supported chat models and converts EUR prices to USD estimates", () => {
  const [mapped] = mapHostYourAIModels([model()], 1.2);

  assert.equal(mapped.id, "example/chat-model");
  assert.equal(mapped.name, "Example Chat Model");
  assert.equal(mapped.contextWindow, 32_768);
  assert.equal(mapped.maxTokens, 8_192);
  assert.deepEqual(mapped.input, ["text"]);
  assert.equal(mapped.cost.input, 0.3);
  assert.equal(mapped.cost.cacheRead, 0.12);
  assert.equal(mapped.cost.output, 0.48);
});

test("enables image input only for advertised text-and-image models", () => {
  const [mapped] = mapHostYourAIModels([
    model({ modality: "text+image->text", supports_images: true }),
  ]);
  assert.deepEqual(mapped.input, ["text", "image"]);
});

test("filters unavailable, unsupported, non-chat, malformed, and duplicate entries", () => {
  const result = mapHostYourAIModels([
    model(),
    model({ id: "example/chat-model" }),
    model({ id: "unavailable", available: false }),
    model({ id: "not-serveable", serveable: false }),
    model({ id: "no-tools", supports_tools: false }),
    model({ id: "embedding", modality: "text->embedding" }),
    model({ id: "audio", modality: "audio->text" }),
    null,
    { id: "bad-modality", modality: 42, available: true, serveable: true, supports_tools: true },
  ]);

  assert.deepEqual(result.map((entry) => entry.id), ["example/chat-model"]);
});

test("sanitizes remote labels and rejects control characters in model IDs", () => {
  const [mapped] = mapHostYourAIModels([
    model({ display_name: "Safe\u001b[31mName\u202e" }),
    model({ id: "unsafe\u001b[2J" }),
  ]);

  assert.equal(mapped.name, "Safe[31mName");
  assert.deepEqual(mapHostYourAIModels([model({ id: "unsafe\u001b[2J" })]), []);
});

test("bounds context/output limits and handles missing or invalid prices safely", () => {
  const [mapped] = mapHostYourAIModels([
    model({
      context_length: 1e100,
      served_context_length: null,
      max_output_tokens: 1e100,
      pricing: { input_per_million: -1, output_per_million: Infinity },
    }),
  ]);

  assert.equal(mapped.contextWindow, 2_000_000);
  assert.equal(mapped.maxTokens, 131_072);
  assert.equal(mapped.cost.input, 0);
  assert.equal(mapped.cost.output, 0);

  const [unknownPrice] = mapHostYourAIModels([model({ pricing: null })]);
  assert.equal(unknownPrice.cost.input, 0);
  assert.equal(unknownPrice.cost.output, 0);
});

test("uses safe defaults when positive limits floor to zero", () => {
  const [mapped] = mapHostYourAIModels([
    model({ context_length: 0.5, served_context_length: 0.5, max_output_tokens: 0.5 }),
  ]);

  assert.equal(mapped.contextWindow, 128_000);
  assert.equal(mapped.maxTokens, 8_192);
});

test("validates the configurable EUR-to-USD estimate rate", () => {
  assert.equal(getEurToUsdRate("1.25"), 1.25);
  assert.equal(getEurToUsdRate(""), 1.1);
  assert.throws(() => getEurToUsdRate("not-a-number"), /between 0.5 and 2/);
  assert.throws(() => mapHostYourAIModels([], 3), /between 0.5 and 2/);
});
