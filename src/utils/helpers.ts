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
// DYNAMIC REPETITION PENALTY
// ============================================================================

/**
 * Dynamic Repetition Penalty configuration
 */
export interface DynamicRepeatPenaltyConfig {
  baseRepeatPenalty: number;   // Starting repeat_penalty (e.g., 1.1)
  maxRepeatPenalty: number;    // Maximum repeat_penalty (e.g., 1.25)
  tokenThreshold: number;      // Tokens before penalty starts increasing (e.g., 500)
  maxTokens: number;           // Tokens at which max penalty is reached (e.g., 2000)
  conversationBoost: number;   // Extra penalty per 10 conversation turns (e.g., 0.02)
}

/**
 * Default configuration for dynamic repeat penalty
 */
export const DEFAULT_DYNAMIC_REPEAT_CONFIG: DynamicRepeatPenaltyConfig = {
  baseRepeatPenalty: 1.1,
  maxRepeatPenalty: 1.25,
  tokenThreshold: 500,
  maxTokens: 2000,
  conversationBoost: 0.02
};

/**
 * Calculate dynamic repetition penalty based on generation context.
 * 
 * Prevents the model from getting stuck in loops on long outputs by
 * gradually increasing repeat_penalty as output length increases.
 * 
 * Also considers conversation length - longer conversations tend to
 * have more repeated concepts, so a slight boost helps.
 * 
 * @param currentTokens - Estimated tokens generated so far in current response
 * @param conversationTurns - Number of message pairs in conversation
 * @param config - Dynamic penalty configuration
 * @returns Adjusted repeat_penalty value
 */
export const calculateDynamicRepeatPenalty = (
  currentTokens: number,
  conversationTurns: number = 0,
  config: Partial<DynamicRepeatPenaltyConfig> = {}
): number => {
  const {
    baseRepeatPenalty,
    maxRepeatPenalty,
    tokenThreshold,
    maxTokens,
    conversationBoost
  } = { ...DEFAULT_DYNAMIC_REPEAT_CONFIG, ...config };

  // Calculate token-based increase
  let tokenPenalty = baseRepeatPenalty;
  if (currentTokens > tokenThreshold) {
    const tokensOverThreshold = currentTokens - tokenThreshold;
    const tokenRange = maxTokens - tokenThreshold;
    const progress = Math.min(1, tokensOverThreshold / tokenRange);
    // Smooth curve using sqrt for gradual increase
    const tokenIncrease = Math.sqrt(progress) * (maxRepeatPenalty - baseRepeatPenalty);
    tokenPenalty = baseRepeatPenalty + tokenIncrease;
  }

  // Add conversation-based boost (caps at 0.1 extra)
  const conversationIncrease = Math.min(0.1, Math.floor(conversationTurns / 10) * conversationBoost);

  // Return capped value
  return Math.min(maxRepeatPenalty, tokenPenalty + conversationIncrease);
};

/**
 * Get repeat penalty config adjusted for persona.
 * Different personas may benefit from different penalty curves.
 */
export const getPersonaRepeatConfig = (
  personaType: string,
  baseRepeatPenalty: number
): DynamicRepeatPenaltyConfig => {
  switch (personaType) {
    case 'coder':
      // Coder: Lower penalty to allow code patterns, but increase for long outputs
      return {
        ...DEFAULT_DYNAMIC_REPEAT_CONFIG,
        baseRepeatPenalty: Math.max(1.0, baseRepeatPenalty - 0.05),
        maxRepeatPenalty: 1.2,
        tokenThreshold: 800  // Code often has repeated patterns
      };
    case 'writer':
      // Writer: Standard curve, slightly higher max to avoid repetitive prose
      return {
        ...DEFAULT_DYNAMIC_REPEAT_CONFIG,
        baseRepeatPenalty,
        maxRepeatPenalty: 1.3
      };
    case 'analyst':
      // Analyst: Higher threshold since data descriptions may repeat
      return {
        ...DEFAULT_DYNAMIC_REPEAT_CONFIG,
        baseRepeatPenalty,
        tokenThreshold: 600
      };
    default:
      return {
        ...DEFAULT_DYNAMIC_REPEAT_CONFIG,
        baseRepeatPenalty
      };
  }
};

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
    maxContextTokens = 8192,      // Total context window
    reserveForResponse = 2048,    // Leave room for model response
    keepFirstMessages = 2,
    keepLastMessages = 10
  } = config;

  const systemTokens = estimateTokens(systemPrompt);
  const totalMsgTokens = estimateMessagesTokens(messages);
  const totalTokens = systemTokens + totalMsgTokens;
  
  // Available tokens for messages (after system prompt and response reserve)
  const availableForMessages = maxContextTokens - systemTokens - reserveForResponse;
  
  // If no trimming needed, return as-is
  if (totalMsgTokens <= availableForMessages) {
    return {
      messages,
      totalTokens,
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
  const trimmedMsgTokens = estimateMessagesTokens(trimmedMessages);
  const trimmedCount = messages.length - trimmedMessages.length;
  
  // Only warn if STILL over limit after trimming
  let warning: string | undefined;
  if (trimmedMsgTokens > availableForMessages) {
    const totalAfterTrim = systemTokens + trimmedMsgTokens;
    warning = `Context still large (~${totalAfterTrim} tokens of ${maxContextTokens}). Consider starting a new chat.`;
  }

  return {
    messages: trimmedMessages,
    totalTokens: systemTokens + trimmedMsgTokens,
    trimmedCount,
    warning
  };
};

// ============================================================================
// CONVERSATION SUMMARY
// ============================================================================

/**
 * Configuration for conversation summary generation
 */
export interface SummaryConfig {
  endpoint: string;
  model: string;
  maxSummaryTokens?: number;
}

/**
 * Result of context management with optional summary
 */
export interface EnhancedContextResult extends ContextResult {
  trimmedMessages?: Array<{ role: string; content: string }>;
  summary?: string;
}

/**
 * JSON schema for structured summary output.
 * Ollama's structured output guarantees valid JSON matching this schema.
 */
const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'A 2-3 sentence summary of the conversation'
    },
    key_topics: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of main topics discussed'
    },
    action_items: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any pending requests or tasks mentioned'
    }
  },
  required: ['summary']
};

/**
 * Structured summary response from Ollama.
 */
interface StructuredSummary {
  summary: string;
  key_topics?: string[];
  action_items?: string[];
}

/**
 * Generate a summary of conversation messages using the LLM.
 * Uses Ollama's structured output (JSON Schema) for guaranteed valid JSON.
 * Uses keep_alive: '0' to immediately unload utility model after use (saves VRAM).
 * 
 * @param messages - Messages to summarize
 * @param config - Summary configuration (endpoint, model)
 * @returns Promise<string> - The generated summary
 */
export const generateConversationSummary = async (
  messages: Array<{ role: string; content: string }>,
  config: SummaryConfig
): Promise<string> => {
  const { endpoint, model, maxSummaryTokens = 200 } = config;
  
  if (messages.length === 0) return '';
  
  // Format messages for summarization
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}${m.content.length > 500 ? '...' : ''}`)
    .join('\n\n');
  
  const summaryPrompt = `Analyze this conversation and provide a structured summary.

Conversation:
${conversationText}

Provide a JSON response with:
- summary: 2-3 concise sentences covering the main discussion
- key_topics: array of main topics (3-5 items max)
- action_items: any pending requests or tasks (can be empty array)`;

  try {
    const response = await fetch(getApiUrl(endpoint, '/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: summaryPrompt,
        stream: false,
        format: SUMMARY_SCHEMA,  // Structured output - guarantees valid JSON
        keep_alive: '0',         // Immediately unload utility model (saves VRAM)
        options: {
          temperature: 0.3,      // Low temp for factual summary
          num_predict: maxSummaryTokens,
          num_ctx: 2048          // Small context for fast summary
        }
      })
    });
    
    if (!response.ok) {
      console.warn('[Summary] Failed to generate summary:', response.status);
      return '';
    }
    
    const data = await response.json();
    
    // Parse structured JSON response
    try {
      const structured: StructuredSummary = JSON.parse(data.response || '{}');
      
      // Build rich summary with topics if available
      let summary = structured.summary || '';
      
      if (structured.key_topics?.length) {
        summary += `\n\n**Topics:** ${structured.key_topics.join(', ')}`;
      }
      
      if (structured.action_items?.length) {
        summary += `\n\n**Pending:** ${structured.action_items.join('; ')}`;
      }
      
      console.log('[Conversation Summary] Structured output:', {
        summary: summary.slice(0, 80) + '...',
        topics: structured.key_topics?.length || 0,
        actions: structured.action_items?.length || 0
      });
      
      return summary;
    } catch {
      // Fallback: use raw response if JSON parsing fails (shouldn't happen with structured output)
      console.warn('[Summary] JSON parse failed, using raw response');
      return data.response?.trim() || '';
    }
  } catch (error) {
    console.warn('[Summary] Error generating summary:', error);
    return '';
  }
};

/**
 * Enhanced context management that generates a summary of trimmed messages.
 * Call this instead of manageContext when you want summaries.
 * 
 * @param systemPrompt - The system prompt
 * @param messages - All conversation messages
 * @param config - Context configuration
 * @param summaryConfig - Optional config for summary generation (if provided, summaries are enabled)
 * @returns Promise<EnhancedContextResult>
 */
export const manageContextWithSummary = async (
  systemPrompt: string,
  messages: Array<{ role: string; content: string; images?: string[] }>,
  config: Partial<ContextConfig> = {},
  summaryConfig?: SummaryConfig
): Promise<EnhancedContextResult> => {
  // First, do basic context management
  const basicResult = manageContext(systemPrompt, messages, config);
  
  // If no trimming happened or no summary config, return basic result
  if (basicResult.trimmedCount === 0 || !summaryConfig) {
    return basicResult;
  }
  
  // Identify which messages were trimmed (the middle section)
  const {
    keepFirstMessages = 2,
    keepLastMessages = 10
  } = config;
  
  const firstCount = Math.min(keepFirstMessages, messages.length);
  const lastCount = Math.min(keepLastMessages, messages.length);
  const lastStartIdx = messages.length - lastCount;
  
  // Trimmed messages are those in the middle (after first N, before last M)
  const trimmedMessages: Array<{ role: string; content: string }> = [];
  for (let i = firstCount; i < lastStartIdx; i++) {
    trimmedMessages.push({
      role: messages[i].role,
      content: messages[i].content
    });
  }
  
  // Generate summary of trimmed messages
  let summary = '';
  if (trimmedMessages.length > 0) {
    summary = await generateConversationSummary(trimmedMessages, summaryConfig);
  }
  
  return {
    ...basicResult,
    trimmedMessages,
    summary
  };
};

/**
 * Format a conversation summary as a system message injection.
 * This can be prepended to the context to preserve important info.
 */
export const formatSummaryAsContext = (summary: string): string => {
  if (!summary) return '';
  return `\n\n**Earlier in this conversation (summary):**\n${summary}`;
};

/**
 * Format token count for display
 */
export const formatTokenCount = (tokens: number): string => {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
};

// ============================================================================
// DYNAMIC TEMPERATURE ADJUSTMENT
// ============================================================================

/**
 * Query type detection for temperature adjustment
 */
export type QueryType = 'factual' | 'creative' | 'code' | 'analytical' | 'general';

/**
 * Detect the type of query to adjust temperature accordingly.
 * @param query - The user's query text
 * @returns The detected query type
 */
export const detectQueryType = (query: string): QueryType => {
  const lowerQuery = query.toLowerCase();
  
  // Code-related queries (lowest temperature for precision)
  if (/\b(code|function|implement|debug|fix|error|bug|syntax|compile|refactor|optimize|algorithm|api|class|method|variable|import|export|async|await|promise|loop|array|object|string|number|boolean|type|interface)\b/i.test(lowerQuery) ||
      /```|\.(js|ts|py|java|cpp|go|rs|rb|php|swift|kt|cs)\b/.test(query)) {
    return 'code';
  }
  
  // Factual/precise queries (low temperature)
  if (/\b(how (many|much)|what is|who is|when (did|was|is)|where (is|are)|define|exact|precise|calculate|convert|specific|correct|accurate|true|false|fact|date|number|amount|price|cost|total|sum|average|percentage|ratio)\b/i.test(lowerQuery)) {
    return 'factual';
  }
  
  // Analytical queries (medium-low temperature)
  if (/\b(analyze|compare|contrast|evaluate|assess|review|examine|investigate|breakdown|pros and cons|advantages|disadvantages|differences?|similarities?|versus|vs\.?|better|worse|recommend|should i|which one)\b/i.test(lowerQuery)) {
    return 'analytical';
  }
  
  // Creative queries (high temperature)
  if (/\b(write|create|imagine|story|poem|creative|brainstorm|ideas?|suggest|invent|design|compose|draft|generate|fiction|narrative|character|plot|dialogue|describe|paint a picture|come up with)\b/i.test(lowerQuery)) {
    return 'creative';
  }
  
  return 'general';
};

/**
 * Calculate adaptive temperature based on query type and base temperature.
 * Adjusts the temperature to be more appropriate for the type of task.
 * 
 * @param query - The user's query text
 * @param baseTemperature - The persona's base temperature setting
 * @param persona - Optional persona type for additional context
 * @returns Adjusted temperature value
 */
export const getAdaptiveTemperature = (
  query: string,
  baseTemperature: number,
  persona?: string
): { temperature: number; queryType: QueryType; adjusted: boolean } => {
  const queryType = detectQueryType(query);
  
  // Temperature ranges by query type
  const tempRanges: Record<QueryType, { min: number; max: number; target: number }> = {
    code: { min: 0.1, max: 0.3, target: 0.2 },
    factual: { min: 0.2, max: 0.4, target: 0.3 },
    analytical: { min: 0.3, max: 0.5, target: 0.4 },
    creative: { min: 0.7, max: 1.0, target: 0.85 },
    general: { min: 0.5, max: 0.8, target: 0.7 }
  };
  
  const range = tempRanges[queryType];
  let adjustedTemp = baseTemperature;
  let adjusted = false;
  
  // Only adjust if base temperature is outside the ideal range for query type
  if (queryType === 'code' || queryType === 'factual') {
    // For precise tasks, cap temperature at max
    if (baseTemperature > range.max) {
      adjustedTemp = range.target;
      adjusted = true;
    }
  } else if (queryType === 'creative') {
    // For creative tasks, ensure minimum temperature
    if (baseTemperature < range.min) {
      adjustedTemp = range.target;
      adjusted = true;
    }
  } else if (queryType === 'analytical') {
    // For analytical, prefer middle ground
    if (baseTemperature > range.max) {
      adjustedTemp = range.target;
      adjusted = true;
    }
  }
  
  // Persona overrides: coder should stay low even for "creative" code generation
  if (persona === 'coder' && adjustedTemp > 0.4) {
    adjustedTemp = Math.min(adjustedTemp, 0.3);
    adjusted = true;
  }
  
  return {
    temperature: adjustedTemp,
    queryType,
    adjusted
  };
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
