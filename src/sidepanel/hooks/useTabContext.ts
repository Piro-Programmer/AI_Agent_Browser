import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRequestId,
  isRestrictedUrl,
  sendExtensionMessage,
  type ActiveTabInfo,
  type ContentScriptPingData,
} from "../../shared/messages";

export interface PingState {
  status: "idle" | "checking" | "connected" | "restricted" | "error";
  latencyMs: number | null;
  error: string | null;
  lastChecked: number | null;
}

export interface UseTabContextResult {
  boundTab: ActiveTabInfo | null;
  activeTab: ActiveTabInfo | null;
  isContextStale: boolean;
  isBoundTabClosed: boolean;
  pingState: PingState;
  refreshContext: () => Promise<void>;
  switchToActiveTab: () => Promise<void>;
  dismissStaleBanner: () => void;
  testPing: () => Promise<void>;
}

export function useTabContext(): UseTabContextResult {
  const [boundTab, setBoundTab] = useState<ActiveTabInfo | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabInfo | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isBoundTabClosed, setIsBoundTabClosed] = useState(false);

  const [pingState, setPingState] = useState<PingState>({
    status: "idle",
    latencyMs: null,
    error: null,
    lastChecked: null,
  });

  const boundTabRef = useRef<ActiveTabInfo | null>(null);
  boundTabRef.current = boundTab;

  const pingTab = useCallback(async (targetTab: ActiveTabInfo) => {
    if (targetTab.isRestricted) {
      setPingState({
        status: "restricted",
        latencyMs: null,
        error: targetTab.restrictionReason || "Page is restricted by browser policy.",
        lastChecked: Date.now(),
      });
      return;
    }

    setPingState((prev) => ({
      ...prev,
      status: "checking",
      error: null,
    }));

    const startTime = performance.now();
    const requestId = createRequestId();

    const response = await sendExtensionMessage<ContentScriptPingData>(
      {
        type: "CS_PING",
        requestId,
        tabId: targetTab.tabId,
      },
      4000
    );

    const latency = Math.round(performance.now() - startTime);

    if (response.ok && response.data) {
      setPingState({
        status: "connected",
        latencyMs: latency,
        error: null,
        lastChecked: Date.now(),
      });

      // Update bound tab title/url if content script returned newer values (SPA navigation)
      setBoundTab((prev) => {
        if (!prev || prev.tabId !== targetTab.tabId) return prev;
        return {
          ...prev,
          url: response.data!.url || prev.url,
          title: response.data!.title || prev.title,
        };
      });
    } else {
      setPingState({
        status: "error",
        latencyMs: null,
        error: response.error || "Content script did not respond.",
        lastChecked: Date.now(),
      });
    }
  }, []);

  const refreshContext = useCallback(async () => {
    setPingState((prev) => ({
      ...prev,
      status: "checking",
      error: null,
    }));
    setIsBannerDismissed(false);
    setIsBoundTabClosed(false);

    const requestId = createRequestId();
    const response = await sendExtensionMessage<ActiveTabInfo>({
      type: "GET_ACTIVE_TAB",
      requestId,
    });

    if (response.ok && response.data) {
      const tabData = response.data;
      setBoundTab(tabData);
      setActiveTab(tabData);
      void pingTab(tabData);
    } else {
      setPingState({
        status: "error",
        latencyMs: null,
        error: response.error || "Could not query active tab.",
        lastChecked: Date.now(),
      });
    }
  }, [pingTab]);

  const switchToActiveTab = useCallback(async () => {
    if (!activeTab) {
      await refreshContext();
      return;
    }
    setBoundTab(activeTab);
    setIsBannerDismissed(false);
    setIsBoundTabClosed(false);
    void pingTab(activeTab);
  }, [activeTab, pingTab, refreshContext]);

  const dismissStaleBanner = useCallback(() => {
    setIsBannerDismissed(true);
  }, []);

  const testPing = useCallback(async () => {
    if (boundTab) {
      await pingTab(boundTab);
    } else {
      await refreshContext();
    }
  }, [boundTab, pingTab, refreshContext]);

  // Initial load
  useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  // Listen to tab events for real-time tab tracking and context switch detection
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.tabs) {
      return;
    }

    const handleTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        const restriction = isRestrictedUrl(tab.url);
        const tabInfo: ActiveTabInfo = {
          tabId: tab.id ?? activeInfo.tabId,
          windowId: tab.windowId,
          url: tab.url || "",
          title: tab.title || tab.url || "Untitled Tab",
          favIconUrl: tab.favIconUrl,
          isRestricted: restriction.restricted,
          restrictionReason: restriction.reason,
        };

        setActiveTab(tabInfo);
        setIsBannerDismissed(false);
      } catch (err) {
        console.warn("[Sahayak] Tab activated lookup error:", err);
      }
    };

    const handleTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
        const restriction = isRestrictedUrl(tab.url);
        const updatedInfo: ActiveTabInfo = {
          tabId,
          windowId: tab.windowId,
          url: tab.url || "",
          title: tab.title || tab.url || "Untitled Tab",
          favIconUrl: tab.favIconUrl,
          isRestricted: restriction.restricted,
          restrictionReason: restriction.reason,
        };

        // If updated tab is currently the active tab in browser
        setActiveTab((prev) => (prev?.tabId === tabId ? updatedInfo : prev));

        // If updated tab is our bound tab
        if (boundTabRef.current?.tabId === tabId) {
          setBoundTab(updatedInfo);
          // Re-ping to ensure content script is still healthy after page reload
          void pingTab(updatedInfo);
        }
      }
    };

    const handleTabRemoved = (tabId: number) => {
      if (boundTabRef.current?.tabId === tabId) {
        setIsBoundTabClosed(true);
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, [pingTab]);

  const isContextStale = Boolean(
    !isBannerDismissed &&
      boundTab &&
      activeTab &&
      boundTab.tabId !== activeTab.tabId
  );

  return {
    boundTab,
    activeTab,
    isContextStale,
    isBoundTabClosed,
    pingState,
    refreshContext,
    switchToActiveTab,
    dismissStaleBanner,
    testPing,
  };
}
