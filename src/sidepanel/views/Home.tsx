import { useEffect, useState } from "react";
import { getEffectiveApiKey } from "../../shared/ai/key-manager";
import { geminiTextProvider } from "../../shared/ai/providers/gemini-text";
import { route } from "../../shared/ai/router";
import { BASE_SYSTEM_PROMPT } from "../../shared/prompts/system";
import type { TextResponse } from "../../shared/ai/types";
import { useTabContext } from "../hooks/useTabContext";

export function Home() {
  const {
    boundTab,
    activeTab,
    isContextStale,
    isBoundTabClosed,
    pingState,
    refreshContext,
    switchToActiveTab,
    dismissStaleBanner,
    testPing,
  } = useTabContext();

  const [copied, setCopied] = useState(false);

  // Gemini AI test state (Slice 1.3)
  const [testPrompt, setTestPrompt] = useState(
    "Introduce yourself in two short sentences and confirm you are ready to assist."
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<TextResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLatencyMs, setAiLatencyMs] = useState<number | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Check key availability on mount
  useEffect(() => {
    let cancelled = false;
    void getEffectiveApiKey().then((key) => {
      if (!cancelled) {
        setHasApiKey(Boolean(key));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const copyUrl = () => {
    if (boundTab?.url) {
      void navigator.clipboard.writeText(boundTab.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendAiPrompt = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiResponse(null);
    setAiLatencyMs(null);

    const startTime = performance.now();
    try {
      const apiKey = await getEffectiveApiKey();
      if (!apiKey) {
        setHasApiKey(false);
        throw new Error(
          "No Gemini API key found. Please add your key in the Settings tab."
        );
      }
      setHasApiKey(true);

      const routed = route("test_connection", { caller: "panel" });
      const result = await geminiTextProvider.complete({
        prompt: testPrompt,
        apiKey,
        model: routed.modelId,
        systemInstruction: BASE_SYSTEM_PROMPT,
        temperature: 0.3,
      });

      const elapsed = Math.round(performance.now() - startTime);
      setAiLatencyMs(elapsed);
      setAiResponse(result);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Unexpected error communicating with Gemini."
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="home-view">
      {/* Context Switch Alert Banner per architecture §4.2 & edge-case X-05 */}
      {isContextStale && activeTab ? (
        <aside className="context-switch-banner" role="alert" aria-live="polite">
          <div className="banner-icon-col">
            <svg
              className="banner-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </div>
          <div className="banner-content">
            <div className="banner-title">Active tab switched</div>
            <p className="banner-desc">
              Browser is focused on{" "}
              <strong className="truncate-text" title={activeTab.title}>
                {activeTab.title || "another tab"}
              </strong>
              . Refresh to bind Sahayak to this tab.
            </p>
            <div className="banner-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => void switchToActiveTab()}
              >
                Switch context
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={dismissStaleBanner}
              >
                Stay on bound tab
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {/* Tab Closed Alert Banner per edge-case X-02 */}
      {isBoundTabClosed ? (
        <aside className="context-switch-banner banner-warning" role="alert">
          <div className="banner-icon-col">
            <svg
              className="banner-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="banner-content">
            <div className="banner-title">Bound tab was closed</div>
            <p className="banner-desc">
              The tab previously bound to Sahayak has been closed. Reconnect to
              your current active tab.
            </p>
            <div className="banner-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => void refreshContext()}
              >
                Connect to current tab
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {/* Primary Tab Context Card (Slice 1.2) */}
      <section className="tab-context-card">
        <div className="card-header">
          <div className="card-header-left">
            <span className="card-badge">Tab Context</span>
            {boundTab ? (
              <span className="tab-id-pill" title={`Window ${boundTab.windowId}`}>
                Tab #{boundTab.tabId}
              </span>
            ) : null}
          </div>
          <div className="card-header-right">
            <button
              type="button"
              className="icon-button"
              onClick={() => void refreshContext()}
              title="Refresh tab context"
              aria-label="Refresh tab context"
              disabled={pingState.status === "checking"}
            >
              <svg
                className={
                  pingState.status === "checking"
                    ? "spin-icon action-icon"
                    : "action-icon"
                }
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          </div>
        </div>

        {boundTab ? (
          <div className="tab-info">
            <div className="tab-headline">
              {boundTab.favIconUrl && !boundTab.isRestricted ? (
                <img
                  src={boundTab.favIconUrl}
                  alt=""
                  className="tab-favicon"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="tab-favicon-placeholder" aria-hidden="true">
                  🌐
                </div>
              )}
              <div className="tab-titles">
                <h2 className="tab-page-title" title={boundTab.title}>
                  {boundTab.title || "Untitled Tab"}
                </h2>
                <div className="tab-url-row">
                  <span className="tab-url-text" title={boundTab.url}>
                    {boundTab.url || "about:blank"}
                  </span>
                  {boundTab.url ? (
                    <button
                      type="button"
                      className="url-copy-btn"
                      onClick={copyUrl}
                      title="Copy URL"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Connection Status Pill */}
            <div className="connection-status-row">
              {pingState.status === "connected" ? (
                <div className="status-pill status-pill--connected">
                  <span className="status-dot status-dot--pulse" />
                  <span className="status-label">Content Script Connected</span>
                  {pingState.latencyMs !== null ? (
                    <span className="status-latency">
                      {pingState.latencyMs}ms round-trip
                    </span>
                  ) : null}
                </div>
              ) : pingState.status === "checking" ? (
                <div className="status-pill status-pill--checking">
                  <span className="status-dot status-dot--spin" />
                  <span className="status-label">Testing round-trip…</span>
                </div>
              ) : pingState.status === "restricted" ? (
                <div className="status-pill status-pill--restricted">
                  <span className="status-dot status-dot--amber" />
                  <span className="status-label">Restricted Browser Page</span>
                </div>
              ) : (
                <div className="status-pill status-pill--error">
                  <span className="status-dot status-dot--red" />
                  <span className="status-label">Script Unreachable</span>
                </div>
              )}

              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => void testPing()}
                disabled={pingState.status === "checking" || boundTab.isRestricted}
                title="Test round-trip IPC message through service worker to content script"
              >
                Test ping
              </button>
            </div>

            {boundTab.isRestricted ? (
              <div className="callout callout-info">
                <strong>Protected page:</strong>{" "}
                {boundTab.restrictionReason ||
                  "Browser security rules prohibit content script injection on system pages."}
              </div>
            ) : null}

            {pingState.status === "error" && pingState.error ? (
              <div className="callout callout-error">
                <strong>IPC connection note:</strong> {pingState.error}
                <div style={{ marginTop: "6px" }}>
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    onClick={() => void testPing()}
                  >
                    Retry connection
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="tab-loading-state">
            <span className="spinner" />
            <span>Resolving active browser tab…</span>
          </div>
        )}
      </section>

      {/* Gemini Direct AI Call Card (Slice 1.3) */}
      <section className="gemini-card">
        <div className="card-header">
          <div className="card-header-left">
            <span className="card-badge card-badge--ai">Gemini Flash-Lite</span>
            <span className="tab-id-pill">Slice 1.3</span>
          </div>
          {hasApiKey === false ? (
            <span className="key-missing-tag">No key saved</span>
          ) : hasApiKey === true ? (
            <span className="key-ready-tag">Key active</span>
          ) : null}
        </div>

        <p className="card-description">
          Test the direct panel-to-Gemini connection with your API key.
        </p>

        <div className="gemini-input-group">
          <textarea
            className="field-textarea"
            rows={2}
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            placeholder="Type a test prompt for Gemini Flash-Lite…"
            disabled={aiLoading}
          />

          <div className="button-row" style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSendAiPrompt()}
              disabled={aiLoading || !testPrompt.trim()}
            >
              {aiLoading ? (
                <>
                  <span className="spinner" style={{ marginRight: "6px" }} />
                  Calling Gemini…
                </>
              ) : (
                "Try Gemini connection"
              )}
            </button>

            {hasApiKey === false ? (
              <span className="field-help" style={{ margin: "auto 0 auto 8px" }}>
                Add your key under <strong>Settings</strong>
              </span>
            ) : null}
          </div>
        </div>

        {/* AI Error Result */}
        {aiError ? (
          <div className="callout callout-error" style={{ marginTop: "12px" }}>
            <strong>Gemini call failed:</strong> {aiError}
          </div>
        ) : null}

        {/* AI Success Result */}
        {aiResponse ? (
          <div className="ai-response-box" style={{ marginTop: "12px" }}>
            <div className="ai-response-header">
              <span className="ai-model-tag">{aiResponse.model}</span>
              {aiLatencyMs !== null ? (
                <span className="status-latency">{aiLatencyMs}ms</span>
              ) : null}
              {aiResponse.usage?.totalTokens ? (
                <span className="ai-tokens-tag">
                  {aiResponse.usage.totalTokens} tokens
                </span>
              ) : null}
            </div>
            <div className="ai-response-body">{aiResponse.text}</div>
          </div>
        ) : null}
      </section>

      {/* IPC Diagnostics info */}
      <section className="ipc-summary-card">
        <h3 className="subheading">Pipeline Status</h3>
        <ul className="ipc-specs-list">
          <li className="ipc-spec-item">
            <span className="spec-bullet">✓</span>
            <span className="spec-title">IPC Skeleton (Slice 1.2)</span>
            <span className="spec-val">Panel ↔ SW ↔ Content Script</span>
          </li>
          <li className="ipc-spec-item">
            <span className="spec-bullet">✓</span>
            <span className="spec-title">Gemini Text Provider (Slice 1.3)</span>
            <span className="spec-val">Flash-Lite direct via REST</span>
          </li>
          <li className="ipc-spec-item">
            <span className="spec-bullet">✓</span>
            <span className="spec-title">Model Router (Slice 1.3)</span>
            <span className="spec-val">Flash-Lite default · Flash escalation</span>
          </li>
          <li className="ipc-spec-item">
            <span className="spec-bullet">✓</span>
            <span className="spec-title">System Role Persona (Slice 1.3)</span>
            <span className="spec-val">Grounded & plain language</span>
          </li>
        </ul>
      </section>

      {/* Upcoming features teaser */}
      <section className="upcoming-section">
        <h3 className="subheading">Next Up: Phase 1 Reading Slices</h3>
        <div className="feature-grid">
          <div className="feature-tile">
            <div className="feature-icon">🔍</div>
            <div className="feature-info">
              <div className="feature-name">Explain Selection</div>
              <div className="feature-slice">Slice 1.4 · Next slice</div>
            </div>
          </div>
          <div className="feature-tile">
            <div className="feature-icon">📄</div>
            <div className="feature-info">
              <div className="feature-name">Article Readability & Extraction</div>
              <div className="feature-slice">Slice 1.5</div>
            </div>
          </div>
          <div className="feature-tile">
            <div className="feature-icon">📑</div>
            <div className="feature-info">
              <div className="feature-name">Structured Article Summary</div>
              <div className="feature-slice">Slice 1.6</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
