/**
 * AI Router for Sahayak.
 * Routes AI task requests to the appropriate provider and model tier
 * based on caller surface, task complexity, and user quality preferences.
 */

import { GEMINI_DEFAULT_MODEL } from "./providers/gemini-text";
import type { AITaskType, RouteOptions, RouteResult } from "./types";

export const GEMINI_QUALITY_MODEL = "gemini-3.5-flash";

export class AIRouter {
  /**
   * Routes a task type to a provider and specific model ID.
   * Invoked from side panel (Gemini + future Groq fallback) or service worker.
   */
  public route(
    taskType: AITaskType,
    options: RouteOptions = { caller: "panel" }
  ): RouteResult {
    if (options.forceModel) {
      return {
        provider: "gemini",
        modelId: options.forceModel,
      };
    }

    // High complexity tasks or explicit user quality preference escalate to Flash
    const needsQuality =
      options.preferQuality ||
      taskType === "screenshot_qa" ||
      taskType === "agent_step";

    if (needsQuality) {
      return {
        provider: "gemini",
        modelId: GEMINI_QUALITY_MODEL,
      };
    }

    // Default everyday tasks run on Flash-Lite
    return {
      provider: "gemini",
      modelId: GEMINI_DEFAULT_MODEL,
    };
  }
}

export const aiRouter = new AIRouter();
export const route = (taskType: AITaskType, options?: RouteOptions) =>
  aiRouter.route(taskType, options);
