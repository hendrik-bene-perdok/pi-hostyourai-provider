# HostYourAI provider for Pi

An unofficial community extension that adds HostYourAI as a Pi model provider, including interactive API-key login and live discovery of supported chat models. It is not affiliated with or endorsed by HostYourAI; HostYourAI names and marks belong to their respective owner.

## Install, update, and remove

Choose **one** source for the installation. Keep using that source when updating or removing it.

### npm

```powershell
pi install npm:pi-hostyourai-provider
pi update npm:pi-hostyourai-provider
pi remove npm:pi-hostyourai-provider
```

To update all installed packages instead, use `pi update --extensions`.

### GitHub

```powershell
pi install git:github.com/hendrik-bene-perdok/pi-hostyourai-provider
pi update git:github.com/hendrik-bene-perdok/pi-hostyourai-provider
pi remove git:github.com/hendrik-bene-perdok/pi-hostyourai-provider
```

## Sign in and choose a model

Start Pi, then run:

```text
/login hostyourai
```

Enter your HostYourAI API key at the secret prompt. Pi stores it in `~/.pi/agent/auth.json`; alternatively, set `HOSTYOURAI_API_KEY` in the environment before starting Pi. Then run `/model` and select a HostYourAI model.

To remove the stored credential, run `/logout` and select HostYourAI. Removing the extension package does not itself delete the saved credential.

## Catalog and API behavior

The extension fetches the live catalog from `GET https://hostyourai.com/api/v1/models`. It lists models marked available, serveable, and tool-capable whose modality is text-to-text or text-and-image-to-text. Embedding, audio, and models that do not advertise tool support are excluded. Image input is enabled only when the catalog advertises `supports_images: true`.

Requests use Pi's built-in OpenAI Chat Completions adapter at `/chat/completions`. The model-list response is OpenAI-style; verify chat, tool-call, and image compatibility with your HostYourAI account and report problems.

The extension caps catalog size at 5 MiB / 2,000 models, applies a 15-second catalog-fetch timeout, and bounds reported context/output limits before adding models to Pi.

## Privacy and cost notes

Model requests send the conversation, tool definitions, and any included images to HostYourAI. Review HostYourAI's data-handling terms before using the extension with sensitive information.

HostYourAI prices are in EUR, while Pi displays model cost estimates with a dollar sign. The extension converts listed EUR prices using an approximate default of 1.10 USD per EUR. Set `HOSTYOURAI_EUR_TO_USD_RATE` to your preferred conversion rate (0.5–2) before starting Pi; restart Pi after changing it so the catalog is refreshed. This is only an estimate, not an invoice. Models without price data can appear as `$0` in Pi; that does **not** mean the model is free. HostYourAI's billing is authoritative.

## Local development

```powershell
cd D:\hostyourai-pi-provider
npm test
npm pack --dry-run
pi -e .
```

Then run `/login hostyourai` and `/model`. Running `npm test` requires Node.js 22.6 or newer and uses its built-in test runner.

## Package details

The npm package is `pi-hostyourai-provider` and is tagged with `pi-package`, making it eligible for the Pi package gallery. Gallery inclusion is not guaranteed. See the [GitHub repository](https://github.com/hendrik-bene-perdok/pi-hostyourai-provider) for source and release notes.
