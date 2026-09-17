# AI providers and model selection

AcadIQ can use several server-configured providers for text and JSON AI requests. Add providers in the order you want them used for fallback. Users can see the configured models and choose a model; API keys stay on the backend.

## Keep the current provider

Existing `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, and `DUAL_EVAL_SECONDARY_MODEL` settings continue to work. This provider has the public ID `default`, remains first in the provider order, and exposes the primary and nonempty secondary model in the model picker. Existing Groq key precedence is preserved when both legacy keys are supplied.

Setting two legacy keys alone does not configure two providers. Add an explicit entry below for each additional provider or credential.

## Add providers

For local development, put credentials and `AI_PROVIDERS_JSON` in the backend's environment. For Docker Compose, use the root environment file. Never put credentials in frontend `VITE_*` variables, JSON model definitions, or committed files.

`AI_PROVIDERS_JSON` is a JSON array. Every entry contains:

| Field | Meaning |
| --- | --- |
| `id` | Unique lowercase provider ID, starting with a letter; remaining characters may be letters, digits, `_`, or `-`. Maximum 48 characters. `default` is reserved. |
| `label` | Provider name shown to users. |
| `baseUrl` | Full OpenAI-compatible Chat Completions endpoint, including `/chat/completions`. HTTP is supported for local services. Do not embed credentials, query parameters, or fragments. |
| `apiKeyEnv` | Name of the server environment variable containing this provider's key. The key itself does not go in JSON. |
| `models` | Allowlist of chat model IDs users may choose. They must reliably follow the application's JSON instructions for structured tasks. |
| `defaultModel` | Optional default model for this provider; must appear in `models`. Defaults to the first model. |
| `jsonMode` | Optional boolean, defaults to `true`. Set to `false` when the provider does not support `response_format`; JSON instructions and local response validation still apply. |

Example with OpenRouter and Nara Router:

```dotenv
# Replace model placeholders with currently available model IDs from your accounts.
OPENROUTER_API_KEY=replace_with_your_key
NARA_ROUTER_API_KEY=replace_with_your_key
AI_PROVIDERS_JSON='[{"id":"openrouter","label":"OpenRouter","baseUrl":"https://openrouter.ai/api/v1/chat/completions","apiKeyEnv":"OPENROUTER_API_KEY","models":["YOUR_OPENROUTER_MODEL_ID"]},{"id":"nara","label":"Nara Router","baseUrl":"https://router.bynara.id/v1/chat/completions","apiKeyEnv":"NARA_ROUTER_API_KEY","models":["YOUR_NARA_MODEL_ID"],"jsonMode":false}]'
```

The endpoint formats are documented in the [OpenRouter Chat Completions reference](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion) and [Nara Router API documentation](https://router.bynara.id/docs). OpenRouter documents JSON object output. Nara's documentation confirms chat compatibility, but does not explicitly document `response_format`; the example therefore sets `jsonMode:false` for Nara and relies on prompt instructions and local validation. Nara's authenticated `/v1/models` endpoint lists the aliases available to your account. This configuration does not automatically query provider model lists.

The configuration accepts up to 10 additional providers and 64 models per provider. It rejects duplicate provider IDs, unknown fields, invalid endpoints, and a default model outside the allowlist. A provider with a missing or blank key is skipped and does not appear in the picker. Restart the backend after updating deployment environment settings.

If no legacy key is configured, the first additional provider with a key becomes the default. If no provider has a key, the model catalogue is empty and AI requests report that no provider is configured.

## Multiple keys and Docker

Use a separate provider entry and unique `id` for each credential, even when entries share the same service and models. The order of entries controls provider priority. Distinct keys can share a provider's account or project quota; switching keys does not guarantee fresh quota or credit.

Docker Compose needs to forward `AI_PROVIDERS_JSON` and every variable named by `apiKeyEnv` to the backend. The integration patch adds `OPENROUTER_API_KEY` and `NARA_ROUTER_API_KEY` alongside the legacy keys. These names are only credential slots: the additional providers still need JSON entries. If you choose another `apiKeyEnv` name, add that variable to the backend service's `environment` section too. A root `.env` variable is not automatically injected into the container.

## Model IDs and compatibility

Public model IDs are `provider-id:model-id`, for example `openrouter:YOUR_OPENROUTER_MODEL_ID`. The catalogue contains only these IDs, model names, and provider labels; it never contains keys or endpoints. Backend calls using a raw model name are still supported when that name is in the allowlist, with the first matching provider taking precedence. Browser clients should send the qualified ID so duplicate model names remain unambiguous.

The authenticated `GET /api/ai/models` endpoint returns the catalogue under `data`, containing `defaultModelId` and `models`. A model entry contains `id`, `provider`, `providerLabel`, `model`, and `label`.

For requests that use AI, send `X-AI-Model: auto` to use automatic routing, or `X-AI-Model: provider-id:model-id` to select a model. An explicit choice stays on that model unless `X-AI-Fallback: true` is also sent. Automatic routing enables fallback by default. The `X-AI-Fallback` header accepts `true` or `false`.

Responses that use AI include top-level `ai` metadata with `requestedModel`, `fallbackUsed`, and `usedModels`. The frontend uses this information to show the provider/model that answered. A gateway may itself route to an underlying model; the displayed information depends on the model identity returned by that gateway.

Only OpenAI-compatible Chat Completions providers belong in this registry. Providers exposing a different API need an adapter before they can be added. Every listed model must accept the application's messages and sampling parameters. With `jsonMode:true`, structured tasks also send `response_format: {"type":"json_object"}`. With `jsonMode:false`, that parameter is omitted and prompt instructions request JSON; local parsing and schema validation still reject invalid results. Model availability, prices, context limits, and JSON support depend on the provider.

The registry and model selection apply to text and structured JSON. Image import and voice transcription retain their existing `VISION_MODEL`, `SPEECH_MODEL`, provider key, and endpoint configuration; they do not switch to a text-only fallback. Local embedding configuration is also independent.

When fallback is enabled, request content can be sent to the configured fallback services. Configure only providers appropriate for the data handled by your deployment. Credits are billed by whichever provider handles a request.
