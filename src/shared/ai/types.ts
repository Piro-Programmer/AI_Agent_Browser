export interface TextRequest {
  prompt: string;
  systemInstruction?: string;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface TextUsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface TextResponse {
  text: string;
  model: string;
  usage?: TextUsageMetadata;
  finishReason?: string;
}

export interface TextProvider {
  name: string;
  complete(params: TextRequest): Promise<TextResponse>;
}

export type AITaskType =
  | "test_connection"
  | "explain_selection"
  | "summarize_article"
  | "summarize_youtube"
  | "chat_page"
  | "screenshot_qa"
  | "agent_step";

export interface RouteOptions {
  caller: "panel" | "worker";
  forceModel?: string;
  preferQuality?: boolean;
}

export interface RouteResult {
  provider: "gemini" | "groq";
  modelId: string;
}
