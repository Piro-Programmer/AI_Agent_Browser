/**
 * Sahayak Service Worker (Background)
 * Manages side panel behavior, tab context tracking, and message routing.
 */

import {
  isRestrictedUrl,
  type ActiveTabInfo,
  type ContentScriptPingData,
  type ExtensionRequest,
  type MessageResponse,
} from "../shared/messages";

// Configure side panel to open on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("[Sahayak] setPanelBehavior failed:", err));

chrome.runtime.onInstalled.addListener((details) => {
  console.info("[Sahayak] extension installed/updated:", details.reason);
});

/**
 * Main IPC message router for requests coming from side panel or other surfaces.
 */
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<unknown>) => void
  ) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const request = message as ExtensionRequest;

    switch (request.type) {
      case "PING": {
        sendResponse({
          requestId: request.requestId,
          ok: true,
          data: { pong: true, timestamp: Date.now() },
        });
        return false; // synchronous reply
      }

      case "GET_ACTIVE_TAB": {
        void resolveActiveTabInfo(request.requestId).then((res) => {
          sendResponse(res);
        });
        return true; // asynchronous reply
      }

      case "CS_PING": {
        void handleContentScriptPing(request).then((res) => {
          sendResponse(res);
        });
        return true; // asynchronous reply
      }

      case "FORWARD_TO_CS": {
        void forwardToTabContentScript(
          request.tabId,
          request.payload,
          request.requestId
        ).then((res) => {
          sendResponse(res);
        });
        return true; // asynchronous reply
      }

      default:
        return false;
    }
  }
);

/**
 * Resolves active tab details, including restriction checks.
 */
async function resolveActiveTabInfo(
  requestId: string
): Promise<MessageResponse<ActiveTabInfo>> {
  try {
    let [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tab) {
      const allActive = await chrome.tabs.query({ active: true });
      tab = allActive[0];
    }

    if (!tab || tab.id === undefined) {
      return {
        requestId,
        ok: false,
        error: "No active browser tab found.",
      };
    }

    const url = tab.url || "";
    const restriction = isRestrictedUrl(url);

    return {
      requestId,
      ok: true,
      data: {
        tabId: tab.id,
        windowId: tab.windowId ?? -1,
        url,
        title: tab.title || url || "Untitled Tab",
        favIconUrl: tab.favIconUrl,
        isRestricted: restriction.restricted,
        restrictionReason: restriction.reason,
      },
    };
  } catch (err) {
    return {
      requestId,
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to query active tab.",
    };
  }
}

/**
 * Handles CS_PING by resolving the target tab and routing the ping to its content script.
 */
async function handleContentScriptPing(
  request: ExtensionRequest & { type: "CS_PING" }
): Promise<MessageResponse<ContentScriptPingData>> {
  let targetTabId = request.tabId;

  if (targetTabId === undefined) {
    const activeTabRes = await resolveActiveTabInfo(request.requestId);
    if (!activeTabRes.ok || !activeTabRes.data) {
      return {
        requestId: request.requestId,
        ok: false,
        error: activeTabRes.error || "Could not resolve active tab for ping.",
      };
    }
    targetTabId = activeTabRes.data.tabId;
  }

  return forwardToTabContentScript<ContentScriptPingData>(
    targetTabId,
    request,
    request.requestId
  );
}

/**
 * Sends a message to a tab's content script, with fallback dynamic injection
 * if the content script was not already present.
 */
async function forwardToTabContentScript<T>(
  tabId: number,
  message: unknown,
  requestId: string
): Promise<MessageResponse<T>> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return {
      requestId,
      ok: false,
      error: "Tab was closed or does not exist.",
    };
  }

  const url = tab.url || "";
  const restriction = isRestrictedUrl(url);
  if (restriction.restricted) {
    return {
      requestId,
      ok: false,
      error:
        restriction.reason ||
        "Target page is restricted by browser security policies.",
    };
  }

  // Attempt initial message to content script
  const initialAttempt = await sendTabMessage<T>(tabId, message);
  if (initialAttempt.ok) {
    return initialAttempt;
  }

  // If connection failed, the content script might not be injected yet
  const needsInjection =
    initialAttempt.error &&
    (initialAttempt.error.includes("Receiving end does not exist") ||
      initialAttempt.error.includes("Could not establish connection"));

  if (needsInjection) {
    const injected = await injectFallbackContentScript(tabId);
    if (injected) {
      // Brief pause for script evaluation
      await new Promise((resolve) => setTimeout(resolve, 80));
      return await sendTabMessage<T>(tabId, message);
    }
  }

  return initialAttempt;
}

/**
 * Injects content script dynamically using chrome.scripting as fallback.
 */
async function injectFallbackContentScript(tabId: number): Promise<boolean> {
  try {
    const manifest = chrome.runtime.getManifest();
    const scripts = manifest.content_scripts?.[0]?.js;
    if (scripts && scripts.length > 0) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: scripts,
      });
      return true;
    }
  } catch (err) {
    console.warn(`[Sahayak] Fallback script injection failed for tab ${tabId}:`, err);
  }
  return false;
}

/**
 * Helper to dispatch chrome.tabs.sendMessage with timeout.
 */
function sendTabMessage<T>(
  tabId: number,
  msg: unknown,
  timeoutMs = 3000
): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          requestId: (msg as { requestId?: string })?.requestId || "",
          ok: false,
          error: `Content script timed out after ${timeoutMs}ms.`,
        });
      }
    }, timeoutMs);

    try {
      chrome.tabs.sendMessage(
        tabId,
        msg,
        (response: MessageResponse<T> | undefined) => {
          if (resolved) return;
          clearTimeout(timer);
          resolved = true;

          if (chrome.runtime.lastError) {
            resolve({
              requestId: (msg as { requestId?: string })?.requestId || "",
              ok: false,
              error:
                chrome.runtime.lastError.message ||
                "Failed to communicate with tab content script.",
            });
            return;
          }

          if (!response) {
            resolve({
              requestId: (msg as { requestId?: string })?.requestId || "",
              ok: false,
              error: "Empty response from content script.",
            });
            return;
          }

          resolve(response);
        }
      );
    } catch (err) {
      if (resolved) return;
      clearTimeout(timer);
      resolved = true;
      resolve({
        requestId: (msg as { requestId?: string })?.requestId || "",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
