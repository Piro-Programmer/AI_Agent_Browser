/**
 * Gemini Text Provider
 * Calls the Google Gemini REST generateContent endpoint directly from the browser extension.
 * Adheres to extension security boundaries (direct Side Panel -> Gemini API).
 */

import type { TextProvider, TextRequest, TextResponse } from "../types";

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
// Google-maintained alias; keeps working if the pinned default is retired.
export const GEMINI_FALLBACK_MODEL = "gemini-flash-lite-latest";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiTextProvider implements TextProvider {
  public readonly name = "Gemini";

  public async complete(params: TextRequest): Promise<TextResponse> {
    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      throw new Error(
        "No Gemini API key found. Please add your key in the Settings tab."
      );
    }

    const model = params.model || GEMINI_DEFAULT_MODEL;

    try {
      return await this.executeGenerateContent(model, apiKey, params);
    } catch (err) {
      // If 404 (model deprecated or unavailable in region), attempt fallback model
      if (
        err instanceof Error &&
        err.message.includes("404") &&
        model !== GEMINI_FALLBACK_MODEL
      ) {
        console.warn(
          `[Sahayak] Model ${model} returned 404, attempting fallback to ${GEMINI_FALLBACK_MODEL}`
        );
        return await this.executeGenerateContent(
          GEMINI_FALLBACK_MODEL,
          apiKey,
          params
        );
      }
      throw err;
    }
  }

  private async executeGenerateContent(
    model: string,
    apiKey: string,
    params: TextRequest
  ): Promise<TextResponse> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(
        "Network appears offline. Please check your internet connection."
      );
    }

    // Key goes in a header, not the URL, so it never lands in request logs or history.
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 20000);

    const bodyPayload: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.4,
        maxOutputTokens: params.maxOutputTokens ?? 2048,
      },
    };

    if (params.systemInstruction) {
      bodyPayload.system_instruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutTimer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          "Gemini request timed out after 20 seconds. Please try again."
        );
      }
      throw new Error(
        "Could not connect to Google Gemini API. Please verify network access or proxy settings."
      );
    } finally {
      clearTimeout(timeoutTimer);
    }

    if (!response.ok) {
      let errorMessage = `Gemini API returned HTTP ${response.status}`;
      try {
        const errorJson = (await response.json()) as {
          error?: { message?: string; status?: string };
        };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Fallback to HTTP status handling
      }

      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new Error(
          "Invalid or unauthorized Gemini API key. Please check your key in the Settings tab."
        );
      }
      if (response.status === 429) {
        throw new Error(
          "Gemini rate limit or quota exceeded (HTTP 429). Please wait a moment before trying again."
        );
      }
      if (response.status === 404) {
        throw new Error(`Model not found (HTTP 404): ${errorMessage}`);
      }
      if (response.status >= 500) {
        throw new Error(
          "Google Gemini servers are temporarily unavailable. Please retry in a few moments."
        );
      }

      throw new Error(errorMessage);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      promptFeedback?: {
        blockReason?: string;
      };
      modelVersion?: string;
    };

    if (data.promptFeedback?.blockReason) {
      throw new Error(
        `Prompt was blocked by Gemini safety filters: ${data.promptFeedback.blockReason}`
      );
    }

    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
      throw new Error("Received empty response from Gemini.");
    }

    const text = candidate.content.parts
      .map((part) => part.text || "")
      .join("")
      .trim();

    return {
      text,
      model: data.modelVersion || model,
      finishReason: candidate.finishReason,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount,
        completionTokens: data.usageMetadata?.candidatesTokenCount,
        totalTokens: data.usageMetadata?.totalTokenCount,
      },
    };
  }
}

export const geminiTextProvider = new GeminiTextProvider();
