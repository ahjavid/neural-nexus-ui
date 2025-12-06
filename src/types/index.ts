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

export interface PersonaConfig {
  name: string;
  icon: React.ComponentType<Record<string, unknown>>;
  color: 'indigo' | 'emerald' | 'purple' | 'amber';
  systemPrompt: string;
  params: {
    temperature: number;
    top_p: number;
    top_k: number;
    repeat_penalty: number;
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
