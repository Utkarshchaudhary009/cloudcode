# Providers and Models Retrieval Mechanism

This document explains how the application retrieves the list of available AI providers and their models.

## Overview

The application utilizes a **hybrid approach** to determine the available providers and models. It prioritizes dynamic retrieval via the `@opencode-ai/sdk` but falls back to a hardcoded static list if the SDK cannot be initialized or if the retrieval fails.

## Logic Flow

The core logic resides in `lib/opencode/catalog.server.ts` within the `getOpencodeProviderCatalog` function.

1.  **Check for OpenCode Client:**
    - The system attempts to initialize the OpenCode client using `getOpencodeClient()` in `lib/opencode/client.server.ts`.
    - The client is initialized **only if** the `OPENCODE_SERVER_URL` environment variable is set.

2.  **Dynamic Retrieval (SDK):**
    - If the client is successfully initialized, the application calls `client.provider.list()` to fetch the latest list of providers and models from the configured OpenCode server.
    - The response is then mapped to the application's catalog format using `mapProviderListToCatalog`.

3.  **Hardcoded Fallback (Static):**
    - If `OPENCODE_SERVER_URL` is not set, or if the SDK call fails (throws an error or returns no data), the application falls back to `buildStaticCatalog()`.
    - This function uses hardcoded constants defined in `lib/opencode/providers.ts`:
        - `OPENCODE_PROVIDERS`: A list of supported providers (e.g., OpenAI, Anthropic, Gemini).
        - `OPENCODE_PROVIDER_MODELS`: A mapping of provider IDs to their supported models.
        - `DEFAULT_OPENCODE_MODEL`: The default model for each provider.

## Key Files

*   `lib/opencode/catalog.server.ts`: Contains the main logic (`getOpencodeProviderCatalog`) for choosing between SDK and static data.
*   `lib/opencode/client.server.ts`: Handles the initialization of the OpenCode client based on environment variables.
*   `lib/opencode/providers.ts`: Defines the static (hardcoded) lists of providers and models used as a fallback.
*   `app/api/opencode/providers/route.ts`: The API endpoint that exposes this logic to the frontend.
