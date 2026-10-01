# HostYourAI provider for Pi

An unofficial community extension; it is not affiliated with or endorsed by HostYourAI. HostYourAI names and marks belong to their respective owner.

A Pi extension that uses HostYourAI's OpenAI-compatible API and refreshes the model catalog from `GET /api/v1/models`.

## Requirements

- A HostYourAI API key
- A Pi version that supports provider extensions and dynamic `refreshModels`
- HostYourAI chat requests compatible with OpenAI Chat Completions at `/chat/completions` (the model-list response is OpenAI-style; verify chat compatibility before publishing)

## Try locally

Load the local extension:

```powershell
pi -e .
```

Then use `/login hostyourai` and enter your HostYourAI API key at the secret prompt. Pi stores it in `~/.pi/agent/auth.json`. Alternatively, set `HOSTYOURAI_API_KEY` in the environment before launching Pi. Then use `/model` to select a listed model. Never commit or share the key.

## Catalog behavior

The extension refreshes the live catalog and includes models that are available, serveable, tool-capable text-generation models. It excludes embedding/audio models and models that do not advertise tool support. Images are enabled for models whose catalog entry has `supports_images: true`.

The catalog sometimes omits context or output limits; the extension uses conservative fallback values of 128,000 context tokens and 8,192 output tokens in those cases.

HostYourAI reports prices in EUR per million tokens. Pi's model cost metadata has no currency field, so the values are copied as numerical estimates and cannot be labeled as EUR by Pi. HostYourAI's bill is authoritative.

## Publish

Before publishing to npm, verify the chat-completions endpoint and test with your own key. The repository can also be installed directly from GitHub:

```bash
pi install git:github.com/hendrik-bene-perdok/pi-hostyourai-provider
```

To publish an npm release as well:

```bash
npm pack --dry-run
npm login
npm publish --access public
```

Users can then install the npm release with:

```bash
pi install npm:pi-hostyourai-provider
```

The `pi-package` keyword makes the npm package eligible for Pi's package gallery. Publishing does not automatically guarantee gallery inclusion.
