// These do not change between environments, so they are constants and not env variables.
// The only secret is GEMINI_API_KEY.
// gemini-3.8-flash (recommended by Google) answered 503 "high demand" and gemini-3.5-flash needed
// a minute for one PDF when this was tested, flash-lite answers in about 2 seconds and reads the drinks right
export const AI_MODEL = 'gemini-3.1-flash-lite';
export const AI_MAX_CONCURRENT_REQUESTS = 2;
export const AI_MAX_RETRIES = 3;
export const AI_RETRY_BASE_DELAY_MS = 1000;
