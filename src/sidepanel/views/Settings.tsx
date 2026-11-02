import { useCallback, useEffect, useState } from "react";
import { getEffectiveApiKey } from "../../shared/ai/key-manager";
import { geminiTextProvider } from "../../shared/ai/providers/gemini-text";
import { route } from "../../shared/ai/router";
import { BASE_SYSTEM_PROMPT } from "../../shared/prompts/system";
import { STORAGE_KEYS } from "../../shared/storage-keys";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface TestConnectionResult {
  ok: boolean;
  message: string;
  model?: string;
  latencyMs?: number;
}

export function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [maskedHint, setMaskedHint] = useState<string | null>(null);
  const [envKeyDetected, setEnvKeyDetected] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Connection testing state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // 1. Check chrome.storage.local
      let storedKey: string | null = null;
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const data = await chrome.storage.local.get(STORAGE_KEYS.geminiApiKey);
        const stored = data[STORAGE_KEYS.geminiApiKey];
        if (typeof stored === "string" && stored.trim().length > 0) {
          storedKey = stored.trim();
        }
      }

      if (cancelled) return;

      if (storedKey) {
        setMaskedHint(maskKey(storedKey));
      } else {
        // 2. Check fallback from local .env
        const effective = await getEffectiveApiKey();
        if (effective) {
          setEnvKeyDetected(maskKey(effective));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveKey = useCallback(async (customKey?: string) => {
    const targetKey = (customKey !== undefined ? customKey : apiKey).trim();
    if (!targetKey) {
      setErrorMessage("Enter a non-empty Gemini API key before saving.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage(null);
    setTestResult(null);

    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEYS.geminiApiKey]: targetKey });
      }
      setMaskedHint(maskKey(targetKey));
      setEnvKeyDetected(null);
      setApiKey("");
      setStatus("saved");
    } catch (err) {
      console.error("[Sahayak] failed to save API key:", err);
      setErrorMessage("Could not save to chrome.storage.local.");
      setStatus("error");
    }
  }, [apiKey]);

  const clearKey = useCallback(async () => {
    setStatus("saving");
    setErrorMessage(null);
    setTestResult(null);

    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.remove(STORAGE_KEYS.geminiApiKey);
      }
      setMaskedHint(null);
      setApiKey("");
      setStatus("saved");
    } catch (err) {
      console.error("[Sahayak] failed to clear API key:", err);
      setErrorMessage("Could not remove stored key.");
      setStatus("error");
    }
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTestingConnection(true);
    setTestResult(null);

    const startTime = performance.now();
    try {
      // Determine which key to test: input value takes priority, then stored or env key
      const keyToTest = apiKey.trim() || (await getEffectiveApiKey());

      if (!keyToTest) {
        setTestResult({
          ok: false,
          message:
            "No API key provided. Please paste your Gemini API key above or save it first.",
        });
        setTestingConnection(false);
        return;
      }

      const routed = route("test_connection", { caller: "panel" });
      const response = await geminiTextProvider.complete({
        prompt:
          "Respond with exactly one sentence confirming you are Sahayak and ready to assist.",
        apiKey: keyToTest,
        model: routed.modelId,
        systemInstruction: BASE_SYSTEM_PROMPT,
        temperature: 0.2,
      });

      const latencyMs = Math.round(performance.now() - startTime);

      setTestResult({
        ok: true,
        message: response.text,
        model: response.model,
        latencyMs,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while communicating with Gemini.",
      });
    } finally {
      setTestingConnection(false);
    }
  }, [apiKey]);

  return (
    <section className="panel-section">
      <h2 className="section-title">Settings</h2>

      <div className="settings-block">
        <label className="field-label" htmlFor="gemini-api-key">
          Gemini API key
        </label>
        <p className="field-help">
          Get a free API key from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google AI Studio
          </a>
          . Keys are saved locally on this machine in{" "}
          <code>chrome.storage.local</code> — never uploaded to git.
        </p>

        {maskedHint ? (
          <p className="key-saved-hint" role="status">
            ✓ Active key saved in storage ({maskedHint}). Enter a new value below to replace it.
          </p>
        ) : envKeyDetected ? (
          <div className="callout callout-info" style={{ marginBottom: "12px" }}>
            <strong>Local key detected:</strong> Found a configured key from{" "}
            <code>.env</code> ({envKeyDetected}). You can test it directly or save it to Chrome storage below.
          </div>
        ) : null}

        <input
          id="gemini-api-key"
          className="field-input"
          type="password"
          autoComplete="off"
          placeholder={
            maskedHint
              ? "Paste new key to replace"
              : envKeyDetected
              ? "Using .env key — or paste new key"
              : "Paste Gemini API key"
          }
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            if (status === "error") setStatus("idle");
          }}
        />

        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {status === "saved" ? (
          <p className="form-success" role="status">
            Saved successfully.
          </p>
        ) : null}

        <div className="button-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void saveKey()}
            disabled={status === "saving" || (!apiKey.trim() && !envKeyDetected)}
          >
            {status === "saving" ? "Saving…" : "Save key"}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleTestConnection()}
            disabled={testingConnection || (!apiKey.trim() && !maskedHint && !envKeyDetected)}
          >
            {testingConnection ? "Testing connection…" : "Try connection"}
          </button>

          {maskedHint ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void clearKey()}
              disabled={status === "saving"}
            >
              Remove key
            </button>
          ) : null}
        </div>

        {/* Live Test Connection Result */}
        {testResult ? (
          <div
            className={`callout ${
              testResult.ok ? "callout-success" : "callout-error"
            }`}
            style={{ marginTop: "14px" }}
            role="status"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{testResult.ok ? "Connection Successful" : "Connection Error"}</strong>
              {testResult.latencyMs !== undefined ? (
                <span className="status-latency">{testResult.latencyMs}ms</span>
              ) : null}
            </div>
            <p style={{ margin: "6px 0 0" }}>{testResult.message}</p>
            {testResult.model ? (
              <div style={{ marginTop: "4px", fontSize: "0.75rem", opacity: 0.8 }}>
                Model: <code>{testResult.model}</code>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="settings-block" style={{ marginTop: "16px" }}>
        <h3 className="subheading">Model Routing Policy (Architecture §5.2)</h3>
        <p className="field-help" style={{ margin: "4px 0 8px" }}>
          Sahayak uses <strong>Gemini Flash-Lite</strong> for fast, cost-effective everyday reading, and routes harder agent or vision tasks to <strong>Gemini Flash</strong>.
        </p>
        <ul className="ipc-specs-list">
          <li className="ipc-spec-item">
            <span className="spec-bullet">•</span>
            <span className="spec-title">Everyday reading & summaries</span>
            <span className="spec-val">Gemini Flash-Lite</span>
          </li>
          <li className="ipc-spec-item">
            <span className="spec-bullet">•</span>
            <span className="spec-title">Screenshot Q&A & Vision</span>
            <span className="spec-val">Gemini Flash</span>
          </li>
          <li className="ipc-spec-item">
            <span className="spec-bullet">•</span>
            <span className="spec-title">Connection test</span>
            <span className="spec-val">Flash-Lite direct</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
