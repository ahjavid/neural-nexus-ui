// Message types
export interface Attachment {
  type: 'image' | 'file' | 'document';
  content: string;
  name: string;
  size: number;
  ext?: string;
  docType?: 'pdf' | 'word' | 'excel' | 'text' | 'url';
  docInfo?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string;
  images?: string[];
  attachments?: Attachment[];
  timing?: string;
  tokenSpeed?: string;
}

export interface Session {
  id: number;
  title: string;
  messages: Message[];
  model: string;
  date: number;
}

// Knowledge base types
export interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  // Enhanced metadata
  source?: 'manual' | 'file' | 'url';
  fileName?: string;
  fileType?: string;
  url?: string;
  chunks?: KnowledgeChunk[];
  createdAt?: number;
  charCount?: number;
  // Neurosymbolic enhancements
  entities?: ExtractedEntitySummary[];
  keywords?: string[];
  relationCount?: number;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  index: number;
}

// Neurosymbolic entity types (simplified for storage)
export interface ExtractedEntitySummary {
  type: string;
  value: string;
  count: number;
}

// Model types
export interface OllamaModel {
  name: string;
  size?: number;
  digest?: string;
  modified_at?: string;
}

// Alias for simpler usage
export type Model = OllamaModel;

// Persona types
export type PersonaType = 'default' | 'coder' | 'writer' | 'analyst';

export interface PersonaParams {
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  num_predict?: number;  // Optional response length limit
}

export interface PersonaConfig {
  name: string;
  icon: React.ComponentType<Record<string, unknown>>;
  color: 'indigo' | 'emerald' | 'purple' | 'amber';
  systemPrompt: string;
  params: PersonaParams;
  // Context-aware hints for dynamic prompt enhancement
  contextHints?: {
    withKnowledgeBase?: string;  // Extra instructions when KB is loaded
    withCodeAttachments?: string;  // Extra instructions for code files
    withDocAttachments?: string;  // Extra instructions for documents
    longConversation?: string;  // Instructions for long conversations (>10 messages)
  };
}

// Model parameters
export interface ModelParams {
  temperature: number;
  top_k: number;
  top_p: number;
  repeat_penalty: number;
  num_predict: number;
  num_ctx: number;
  seed: number;
  mirostat: number;
  mirostat_tau: number;
  mirostat_eta: number;
  num_gpu: number;
  num_thread: number;
}

// Storage info
export interface StorageInfo {
  used: number;
  quota: number;
  percent: string;
}

// File config
export interface FileConfig {
  maxImageSize: number;
  maxTextSize: number;
  maxDocSize: number;
  allowedTextExtensions: string[];
  allowedDocExtensions: string[];
  allowedImageTypes: string[];
}

// Connection status
export type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'error';

// Document processing result
export interface DocumentResult {
  text: string;
  type: 'pdf' | 'word' | 'excel' | 'text' | 'url';
  pageCount?: number;
  sheetCount?: number;
  sheetNames?: string[];
  messages?: unknown[];
  title?: string;
  url?: string;
}

// Tool calling types
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  items?: { type: string };  // For array types
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      required?: string[];
      properties: Record<string, ToolParameter>;
    };
  };
}

export interface ToolCall {
  type: 'function';
  function: {
    index?: number;
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolResult {
  role: 'tool';
  tool_name: string;
  content: string;
}

// Tool handler function type
export type ToolHandler = (args: Record<string, unknown>) => Promise<string> | string;

// Tool registry entry
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  enabled: boolean;
}

// Extended message type for tool calls
export interface ToolMessage extends Omit<Message, 'role'> {
  role: 'user' | 'assistant' | 'system' | 'tool';
  tool_calls?: ToolCall[];
  tool_name?: string;
}

// ============================================
// API Provider Types (Ollama, Groq, etc.)
// ============================================

export type ApiProvider = 'ollama' | 'groq';

export interface ProviderConfig {
  provider: ApiProvider;
  endpoint: string;
  apiKey?: string;
}

// Groq-specific types
export interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
  max_completion_tokens?: number;
}

export interface GroqModelList {
  object: string;
  data: GroqModel[];
}

// Groq Chat Completion types (OpenAI-compatible)
export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

export interface GroqToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface GroqChatCompletionRequest {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number; // Deprecated, use max_completion_tokens
  max_completion_tokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  stop?: string | string[];
  seed?: number; // For deterministic outputs (best effort)
  // NOTE: frequency_penalty and presence_penalty are documented but NOT YET SUPPORTED by Groq
}

export interface GroqChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: GroqChatMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GroqStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

// Unified model type for UI display
export interface UnifiedModel {
  id: string;
  name: string;
  displayName?: string;
  provider: ApiProvider;
  contextWindow?: number;
  maxCompletionTokens?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
}
