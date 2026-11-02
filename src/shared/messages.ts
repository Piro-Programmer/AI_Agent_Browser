/**
 * Typed Inter-Process Communication (IPC) messages for Sahayak.
 * Connects Side Panel <-> Service Worker <-> Content Script.
 */

export type ExtensionMessageType =
  | "PING"
  | "GET_ACTIVE_TAB"
  | "CS_PING"
  | "FORWARD_TO_CS";

export interface BaseMessage {
  type: ExtensionMessageType | string;
  requestId: string;
}

export interface PingMessage extends BaseMessage {
  type: "PING";
}

export interface GetActiveTabMessage extends BaseMessage {
  type: "GET_ACTIVE_TAB";
}

export interface ContentScriptPingMessage extends BaseMessage {
  type: "CS_PING";
  tabId?: number;
}

export interface ForwardToCsMessage extends BaseMessage {
  type: "FORWARD_TO_CS";
  tabId: number;
  payload: BaseMessage;
}

export type ExtensionRequest =
  | PingMessage
  | GetActiveTabMessage
  | ContentScriptPingMessage
  | ForwardToCsMessage;

/**
 * Standard response envelope for all IPC messages.
 */
export interface MessageResponse<T = unknown> {
  requestId: string;
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PingResponseData {
  pong: true;
  timestamp: number;
}

export interface ActiveTabInfo {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  isRestricted: boolean;
  restrictionReason?: string;
}

export interface ContentScriptPingData {
  url: string;
  title: string;
  timestamp: number;
}

/**
 * Generates a collision-resistant request identifier.
 */
export function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Determines whether a URL is restricted by Chrome MV3 security policies.
 * Content scripts cannot be injected into chrome://, edge://, about:, Web Store, etc.
 */
export function isRestrictedUrl(url?: string): { restricted: boolean; reason?: string } {
  if (!url || url.trim().length === 0) {
    return {
      restricted: true,
      reason: "No URL available (page may still be initializing).",
    };
  }

  const lower = url.toLowerCase().trim();

  if (
    lower.startsWith("chrome://") ||
    lower.startsWith("edge://") ||
    lower.startsWith("brave://") ||
    lower.startsWith("opera://") ||
    lower.startsWith("about:") ||
    lower.startsWith("chrome-search://") ||
    lower.startsWith("chrome-untrusted://") ||
    lower.startsWith("devtools://") ||
    lower.startsWith("view-source:")
  ) {
    return {
      restricted: true,
      reason: "Browser system pages (such as chrome:// or about:blank) cannot be accessed by extensions.",
    };
  }

  if (
    lower.startsWith("chrome-extension://") ||
    lower.startsWith("moz-extension://")
  ) {
    return {
      restricted: true,
      reason: "Extension internal pages cannot be accessed by other extension scripts.",
    };
  }

  if (
    lower.includes("chromewebstore.google.com") ||
    lower.includes("chrome.google.com/webstore")
  ) {
    return {
      restricted: true,
      reason: "Chrome Web Store pages block extensions for security reasons.",
    };
  }

  return { restricted: false };
}

/**
 * Sends a typed message to the Chrome extension runtime with an explicit timeout
 * and validation of the requestId correlation.
 */
export function sendExtensionMessage<T = unknown>(
  message: ExtensionRequest,
  timeoutMs: number = 5000
): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          requestId: message.requestId,
          ok: false,
          error: `Request timed out after ${timeoutMs}ms. Service worker may be inactive.`,
        });
      }
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response: MessageResponse<T> | undefined) => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;

        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve({
            requestId: message.requestId,
            ok: false,
            error: lastError.message || "Runtime messaging error occurred.",
          });
          return;
        }

        if (!response) {
          resolve({
            requestId: message.requestId,
            ok: false,
            error: "No response received from background service worker.",
          });
          return;
        }

        // Validate requestId correlation
        if (response.requestId && response.requestId !== message.requestId) {
          resolve({
            requestId: message.requestId,
            ok: false,
            error: `Mismatched requestId: sent ${message.requestId}, received ${response.requestId}`,
          });
          return;
        }

        resolve(response);
      });
    } catch (err) {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      resolve({
        requestId: message.requestId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
