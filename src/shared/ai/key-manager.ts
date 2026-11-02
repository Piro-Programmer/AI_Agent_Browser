import { STORAGE_KEYS } from '../storage-keys';

/**
 * Resolves the active Gemini API key from chrome.storage.local,
 * falling back to local Vite environment variables (VITE_GEMINI_API_KEY) during development.
 */
export async function getEffectiveApiKey(): Promise<string | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const data = await chrome.storage.local.get(STORAGE_KEYS.geminiApiKey);
      const stored = data[STORAGE_KEYS.geminiApiKey];
      if (typeof stored === 'string' && stored.trim().length > 0) {
        return stored.trim();
      }
    }
  } catch (err) {
    console.warn(
      '[Sahayak] Failed to read key from chrome.storage.local:',
      err
    );
  }

  // Dev-only fallback from .env. `import.meta.env.DEV` is statically false in
  // production builds, so this branch (and the key string) is stripped from dist/.
  if (import.meta.env.DEV) {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (typeof envKey === 'string' && envKey.trim().length > 0) {
      return envKey.trim();
    }
  }

  return null;
}
