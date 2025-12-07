// Format bytes to human readable string
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

// Format date to relative time (Today, Yesterday, X days ago, or date)
export const formatRelativeDate = (timestamp: number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  
  // Reset to start of day for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = today.getTime() - targetDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  
  // For older dates, show the actual date
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Format file size (alias for consistency)
export const formatFileSize = formatBytes;

// Get file extension from filename
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename; // Files like Dockerfile, Makefile
  return filename.slice(lastDot).toLowerCase();
};

// File upload configuration
export const FILE_CONFIG = {
  maxImageSize: 50 * 1024 * 1024,   // 50MB for images
  maxTextSize: 25 * 1024 * 1024,    // 25MB for text files
  maxDocSize: 100 * 1024 * 1024,    // 100MB for documents (PDF, Word, Excel)
  allowedTextExtensions: [
    '.txt', '.md', '.markdown', '.rmd', '.json', '.xml', '.csv', '.tsv',
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
    '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
    '.html', '.css', '.scss', '.sass', '.less',
    '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat',
    '.yaml', '.yml', '.toml', '.ini', '.env', '.conf', '.config',
    '.log', '.gitignore', '.dockerignore', 'Dockerfile', 'Makefile',
    '.r', '.R', '.jl', '.lua', '.pl', '.pm', '.ipynb', '.tex', '.bib',
    '.rst', '.asciidoc', '.org', '.nix', '.zig', '.v', '.ex', '.exs', '.erl', '.hrl',
    '.hs', '.ml', '.mli', '.clj', '.cljs', '.lisp', '.el', '.vim', '.fish'
  ],
  allowedDocExtensions: ['.pdf', '.docx', '.doc', '.xlsx', '.xls'],
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
} as const;

// Default model parameters
export const DEFAULT_PARAMS = {
  temperature: 0.7,
  top_k: 40,
  top_p: 0.9,
  repeat_penalty: 1.1,
  num_predict: 2048,
  num_ctx: 8192,  // Increased from 4096 for better context handling
  seed: -1,
  mirostat: 0,
  mirostat_tau: 5.0,
  mirostat_eta: 0.1,
  num_gpu: -1,
  num_thread: 0
} as const;

// ============================================================================
// CONTEXT MANAGEMENT UTILITIES
// ============================================================================

/**
 * Estimate token count for a string.
 * Uses a simple heuristic: ~4 characters per token for English text.
 * This is an approximation - actual tokenization varies by model.
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  // Rough heuristic: 1 token ≈ 4 characters for English
  // Adjust for code (more tokens) and whitespace (fewer tokens)
  const baseEstimate = Math.ceil(text.length / 4);
  // Add extra for code blocks (more granular tokenization)
  const codeBlockCount = (text.match(/```/g) || []).length / 2;
  return Math.ceil(baseEstimate + codeBlockCount * 10);
};

/**
 * Estimate total tokens for a message array.
 */
export const estimateMessagesTokens = (messages: Array<{ role: string; content: string }>): number => {
  return messages.reduce((total, msg) => {
    // Each message has overhead (~4 tokens for role, formatting)
    return total + estimateTokens(msg.content) + 4;
  }, 0);
};

/**
 * Context management configuration
 */
export interface ContextConfig {
  maxContextTokens: number;      // Max tokens for context (num_ctx - reserved for response)
  reserveForResponse: number;    // Tokens to reserve for model response
  keepFirstMessages: number;     // Number of initial messages to always keep
  keepLastMessages: number;      // Number of recent messages to always keep
  systemPromptTokens?: number;   // Pre-calculated system prompt tokens
}

/**
 * Result of context management
 */
export interface ContextResult {
  messages: Array<{ role: string; content: string; images?: string[] }>;
  totalTokens: number;
  trimmedCount: number;
  warning?: string;
}

/**
 * Smart context management using hybrid strategy:
 * 1. Always keep system prompt
 * 2. Always keep first N messages (establishes context)
 * 3. Always keep last M messages (recent conversation)
 * 4. Trim middle messages if needed
 * 5. Warn if still over limit
 */
export const manageContext = (
  systemPrompt: string,
  messages: Array<{ role: string; content: string; images?: string[] }>,
  config: Partial<ContextConfig> = {}
): ContextResult => {
  const {
    maxContextTokens = 6144,      // Default: leave room for 2k response in 8k context
    reserveForResponse = 2048,
    keepFirstMessages = 2,
    keepLastMessages = 10
  } = config;

  const systemTokens = estimateTokens(systemPrompt);
  const availableTokens = maxContextTokens - systemTokens - reserveForResponse;
  
  // If no trimming needed, return as-is
  const totalMsgTokens = estimateMessagesTokens(messages);
  if (totalMsgTokens <= availableTokens) {
    return {
      messages,
      totalTokens: systemTokens + totalMsgTokens,
      trimmedCount: 0
    };
  }

  // Need to trim - use hybrid strategy
  const firstMsgs = messages.slice(0, Math.min(keepFirstMessages, messages.length));
  const lastMsgs = messages.slice(-Math.min(keepLastMessages, messages.length));
  
  // Avoid duplicates if conversation is short
  const firstIds = new Set(firstMsgs.map((_, i) => i));
  const lastStartIdx = messages.length - lastMsgs.length;
  const uniqueLastMsgs = lastMsgs.filter((_, i) => !firstIds.has(lastStartIdx + i));
  
  const trimmedMessages = [...firstMsgs, ...uniqueLastMsgs];
  const trimmedTokens = estimateMessagesTokens(trimmedMessages);
  const trimmedCount = messages.length - trimmedMessages.length;
  
  // Check if still over limit
  let warning: string | undefined;
  if (trimmedTokens > availableTokens) {
    warning = `Context still large (~${trimmedTokens} tokens). Consider starting a new chat.`;
  }

  return {
    messages: trimmedMessages,
    totalTokens: systemTokens + trimmedTokens,
    trimmedCount,
    warning
  };
};

/**
 * Format token count for display
 */
export const formatTokenCount = (tokens: number): string => {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
};

/**
 * Get context usage percentage and status
 */
export const getContextUsage = (
  usedTokens: number,
  maxTokens: number
): { percent: number; status: 'ok' | 'warning' | 'critical'; label: string } => {
  const percent = Math.round((usedTokens / maxTokens) * 100);
  
  if (percent < 60) {
    return { percent, status: 'ok', label: `${percent}%` };
  } else if (percent < 85) {
    return { percent, status: 'warning', label: `${percent}% - Getting long` };
  } else {
    return { percent, status: 'critical', label: `${percent}% - Near limit` };
  }
};

// ============================================================================

/**
 * Get the API URL for Ollama requests.
 * In development mode with localhost endpoint, uses Vite proxy to avoid CORS issues.
 * In production or with remote endpoints, uses the full URL directly.
 */
export const getApiUrl = (endpoint: string, path: string): string => {
  const isDev = import.meta.env.DEV;
  const isLocalhost = endpoint === 'http://localhost:11434' || 
                      endpoint === 'http://127.0.0.1:11434' ||
                      endpoint === 'localhost:11434' ||
                      endpoint === '127.0.0.1:11434';
  
  // In dev mode with localhost, use Vite proxy
  if (isDev && isLocalhost) {
    return path.startsWith('/') ? path : `/${path}`;
  }
  
  // Otherwise use full URL
  const baseUrl = endpoint.startsWith('http') ? endpoint : `http://${endpoint}`;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};
