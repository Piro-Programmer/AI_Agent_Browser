/**
 * Sahayak Content Script
 * Runs in isolated world on web pages.
 * Handles DOM inspection and page context queries; never stores keys or calls LLM APIs directly.
 */

import type {
  ContentScriptPingData,
  ExtensionRequest,
  MessageResponse,
} from "../shared/messages";

console.info("[Sahayak] content script active on:", window.location.href);

// Listen for messages from Service Worker / Side Panel
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<ContentScriptPingData>) => void
  ) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const request = message as ExtensionRequest;

    if (request.type === "CS_PING") {
      try {
        const payload: MessageResponse<ContentScriptPingData> = {
          requestId: request.requestId,
          ok: true,
          data: {
            url: window.location.href,
            title: document.title || window.location.href,
            timestamp: Date.now(),
          },
        };
        sendResponse(payload);
      } catch (err) {
        sendResponse({
          requestId: request.requestId,
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to read page title or URL in content script.",
        });
      }
      return false; // synchronous response
    }

    return false;
  }
);
