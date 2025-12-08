/**
 * Groq API Service
 * 
 * Uses the official groq-sdk for TypeScript integration with Groq's ultra-fast inference.
 * Groq offers blazing-fast inference speeds (100-500+ tokens/sec) for popular models.
 * 
 * Features:
 * - Streaming chat completions via official SDK
 * - Built-in error handling (RateLimitError, APIConnectionError, etc.)
 * - Model listing and capabilities
 * - TypeScript type safety
 * 
 * NOTE: Tool/function calling is DISABLED due to model limitations.
 * The Groq API supports tools, but the models output malformed tool calls.
 * Use Ollama for tool calling functionality.
 */

import Groq from 'groq-sdk';
import type {
  ChatCompletionMessageParam
} from 'groq-sdk/resources/chat/completions';
import type {
  GroqModel,
  GroqChatMessage,
  UnifiedModel
} from '../types';

// ============================================
// Configuration
// ============================================

// Model type for categorization
type GroqModelType = 'chat' | 'audio-transcription' | 'audio-tts' | 'moderation' | 'embedding';

// Groq model information (context windows and capabilities)
// Updated: December 2025 - Based on actual API response
interface GroqModelMetadata {
  contextWindow: number;
  maxCompletionTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  modelType: GroqModelType;
  description: string;
}

const GROQ_MODEL_INFO: Record<string, GroqModelMetadata> = {
  // ========================
  // CHAT MODELS (Primary)
  // ========================
  
  // Llama 3.3 models
  'llama-3.3-70b-versatile': { 
    contextWindow: 131072, maxCompletionTokens: 32768, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Most capable Llama 3.3 - great for complex tasks' 
  },
  
  // Llama 3.1 models
  'llama-3.1-8b-instant': { 
    contextWindow: 131072, maxCompletionTokens: 131072, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Fast and efficient for quick responses' 
  },
  
  // Llama 4 models (NEW!)
  'meta-llama/llama-4-scout-17b-16e-instruct': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Llama 4 Scout - latest generation' 
  },
  'meta-llama/llama-4-maverick-17b-128e-instruct': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Llama 4 Maverick - extended expertise' 
  },
  
  // OpenAI GPT-OSS models (NEW!)
  'openai/gpt-oss-20b': { 
    contextWindow: 131072, maxCompletionTokens: 65536, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'OpenAI GPT OSS 20B - open source' 
  },
  'openai/gpt-oss-120b': { 
    contextWindow: 131072, maxCompletionTokens: 65536, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'OpenAI GPT OSS 120B - largest open source' 
  },
  
  // Qwen models (NEW!)
  'qwen/qwen3-32b': { 
    contextWindow: 131072, maxCompletionTokens: 40960, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Alibaba Qwen 3 - excellent for coding' 
  },
  
  // Groq Compound AI - uses BUILT-IN tools only, not external tool calling
  'groq/compound': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Groq Compound AI - built-in web search & code execution' 
  },
  'groq/compound-mini': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Groq Compound Mini - lightweight built-in tools' 
  },
  
  // Moonshot Kimi (NEW!)
  'moonshotai/kimi-k2-instruct': { 
    contextWindow: 131072, maxCompletionTokens: 16384, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Moonshot Kimi K2 - strong reasoning' 
  },
  'moonshotai/kimi-k2-instruct-0905': { 
    contextWindow: 262144, maxCompletionTokens: 16384, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'Moonshot Kimi K2 (0905) - 256K context' 
  },
  
  // Allam (Arabic-focused)
  'allam-2-7b': { 
    contextWindow: 4096, maxCompletionTokens: 4096, supportsTools: false, 
    supportsVision: false, modelType: 'chat', description: 'SDAIA Allam 2 - Arabic language model' 
  },
  
  // ========================
  // AUDIO MODELS (Transcription)
  // ========================
  'whisper-large-v3': { 
    contextWindow: 448, maxCompletionTokens: 448, supportsTools: false, 
    supportsVision: false, modelType: 'audio-transcription', description: 'Whisper Large V3 - audio transcription' 
  },
  'whisper-large-v3-turbo': { 
    contextWindow: 448, maxCompletionTokens: 448, supportsTools: false, 
    supportsVision: false, modelType: 'audio-transcription', description: 'Whisper Turbo - faster transcription' 
  },
  
  // ========================
  // TTS MODELS (Text-to-Speech)
  // ========================
  'playai-tts': { 
    contextWindow: 8192, maxCompletionTokens: 8192, supportsTools: false, 
    supportsVision: false, modelType: 'audio-tts', description: 'PlayAI TTS - text to speech' 
  },
  'playai-tts-arabic': { 
    contextWindow: 8192, maxCompletionTokens: 8192, supportsTools: false, 
    supportsVision: false, modelType: 'audio-tts', description: 'PlayAI TTS Arabic - Arabic speech' 
  },
  
  // ========================
  // MODERATION/SAFETY MODELS
  // ========================
  'meta-llama/llama-guard-4-12b': { 
    contextWindow: 131072, maxCompletionTokens: 1024, supportsTools: false, 
    supportsVision: false, modelType: 'moderation', description: 'Llama Guard 4 - content safety' 
  },
  'meta-llama/llama-prompt-guard-2-86m': { 
    contextWindow: 512, maxCompletionTokens: 512, supportsTools: false, 
    supportsVision: false, modelType: 'moderation', description: 'Prompt Guard - injection detection' 
  },
  'meta-llama/llama-prompt-guard-2-22m': { 
    contextWindow: 512, maxCompletionTokens: 512, supportsTools: false, 
    supportsVision: false, modelType: 'moderation', description: 'Prompt Guard Mini - fast injection detection' 
  },
  'openai/gpt-oss-safeguard-20b': { 
    contextWindow: 131072, maxCompletionTokens: 65536, supportsTools: false, 
    supportsVision: false, modelType: 'moderation', description: 'GPT OSS Safeguard - content moderation' 
  },
};

// Models that are recommended for chat (excludes audio/moderation)
export const GROQ_CHAT_MODELS = Object.entries(GROQ_MODEL_INFO)
  .filter(([_, info]) => info.modelType === 'chat')
  .map(([id]) => id);

// ============================================
// Groq Parameter Compatibility
// ============================================
// NOTE: Groq does NOT support all Ollama parameters!
// Supported: temperature, top_p, max_tokens, stop, seed
// NOT SUPPORTED: frequency_penalty, presence_penalty (documented but not implemented)
// NOT SUPPORTED: top_k, repeat_penalty, mirostat, num_ctx (Ollama-specific)

// ============================================
// Storage Helpers
// ============================================

const GROQ_API_KEY_STORAGE = 'nexus_groq_api_key';
const GROQ_ENABLED_STORAGE = 'nexus_groq_enabled';

/**
 * Get stored Groq API key
 */
export const getGroqApiKey = (): string | null => {
  return localStorage.getItem(GROQ_API_KEY_STORAGE);
};

/**
 * Set Groq API key
 */
export const setGroqApiKey = (apiKey: string): void => {
  if (apiKey) {
    localStorage.setItem(GROQ_API_KEY_STORAGE, apiKey);
  } else {
    localStorage.removeItem(GROQ_API_KEY_STORAGE);
  }
};

/**
 * Check if Groq is enabled
 */
export const isGroqEnabled = (): boolean => {
  return localStorage.getItem(GROQ_ENABLED_STORAGE) === 'true';
};

/**
 * Set Groq enabled state
 */
export const setGroqEnabled = (enabled: boolean): void => {
  localStorage.setItem(GROQ_ENABLED_STORAGE, enabled.toString());
};

/**
 * Check if Groq API key is configured
 */
export const hasGroqApiKey = (): boolean => {
  const key = getGroqApiKey();
  return !!key && key.startsWith('gsk_');
};

// ============================================
// Groq SDK Client
// ============================================

// Cache the client instance
let groqClient: Groq | null = null;

/**
 * Get or create Groq SDK client
 * Returns null if no API key is configured
 */
const getGroqClient = (): Groq | null => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return null;
  }
  
  // Recreate client if API key changed
  if (!groqClient || (groqClient as unknown as { apiKey?: string }).apiKey !== apiKey) {
    groqClient = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true // Required for browser usage
    });
  }
  
  return groqClient;
};

/**
 * Reset the cached client (call when API key changes)
 */
export const resetGroqClient = (): void => {
  groqClient = null;
};

// ============================================
// API Functions
// ============================================

/**
 * Test Groq API connection with the stored API key
 * Uses the official Groq SDK
 */
export const testGroqConnection = async (): Promise<{ success: boolean; error?: string; models?: GroqModel[] }> => {
  const client = getGroqClient();
  if (!client) {
    return { success: false, error: 'No API key configured' };
  }

  try {
    const response = await client.models.list();
    const models = response.data.map(m => ({
      id: m.id,
      object: m.object,
      created: m.created,
      owned_by: m.owned_by,
      active: true,
      context_window: (m as unknown as { context_window?: number }).context_window || 0,
      max_completion_tokens: 0
    }));
    return { success: true, models };
  } catch (err) {
    if (err instanceof Groq.APIError) {
      return { success: false, error: `API Error (${err.status}): ${err.message}` };
    }
    return { success: false, error: (err as Error).message };
  }
};

/**
 * List available Groq models (chat models only)
 * Filters out audio transcription, TTS, and moderation models
 * Uses the official Groq SDK
 */
export const listGroqModels = async (): Promise<UnifiedModel[]> => {
  const client = getGroqClient();
  if (!client) {
    return [];
  }

  try {
    const response = await client.models.list();
    
    // Filter to active chat models only (exclude audio/moderation models)
    return response.data
      .filter(model => {
        // Check if we have metadata for this model
        const info = GROQ_MODEL_INFO[model.id];
        
        // If we have metadata, only include chat models
        if (info) {
          return info.modelType === 'chat';
        }
        
        // For unknown models, use heuristics to filter
        // Exclude whisper (audio transcription)
        if (model.id.toLowerCase().includes('whisper')) return false;
        // Exclude TTS models
        if (model.id.toLowerCase().includes('tts')) return false;
        // Exclude guard/safety models
        if (model.id.toLowerCase().includes('guard') || model.id.toLowerCase().includes('safeguard')) return false;
        
        return true;
      })
      .map(model => {
        const info = GROQ_MODEL_INFO[model.id];
        const modelData = model as unknown as { context_window?: number; max_completion_tokens?: number };
        return {
          id: model.id,
          name: model.id,
          displayName: info?.description || model.id,
          provider: 'groq' as const,
          contextWindow: info?.contextWindow || modelData.context_window || 0,
          maxCompletionTokens: info?.maxCompletionTokens || modelData.max_completion_tokens || 0,
          supportsTools: false, // Tool calling disabled for Groq
          supportsVision: info?.supportsVision ?? false
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    if (err instanceof Groq.APIError) {
      console.error('Groq API Error:', err.status, err.message);
    } else {
      console.error('Error fetching Groq models:', err);
    }
    return [];
  }
};

/**
 * Get model info for a specific Groq model
 */
export const getGroqModelInfo = (modelId: string): GroqModelMetadata | null => {
  return GROQ_MODEL_INFO[modelId] || null;
};

/**
 * Check if a model is a chat model (vs audio/moderation)
 */
export const isGroqChatModel = (modelId: string): boolean => {
  const info = GROQ_MODEL_INFO[modelId];
  if (info) {
    return info.modelType === 'chat';
  }
  // Heuristics for unknown models
  const lower = modelId.toLowerCase();
  if (lower.includes('whisper') || lower.includes('tts') || lower.includes('guard')) {
    return false;
  }
  return true;
};

/**
 * Convert Ollama-style messages to Groq format
 * 
 * NOTE: Tool calling is disabled for Groq, so we only handle regular messages.
 */
export const convertToGroqMessages = (
  messages: Array<{ role: string; content: string; images?: string[] }>
): GroqChatMessage[] => {
  // Filter out any tool-related messages since Groq tool calling is disabled
  return messages
    .filter(msg => msg.role !== 'tool')
    .map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    }));
};

// NOTE: Tool calling is disabled for Groq models.
// The Groq API supports tool calling, but the models (Llama 3.3, etc.) generate
// malformed tool calls in the format <function=name(args)> instead of proper JSON.
// Use Ollama for tool calling functionality.

/**
 * Stream chat completion from Groq using the official SDK
 * 
 * NOTE: Tool calling is DISABLED for Groq models due to model limitations.
 * The Groq API supports tools, but the models output malformed tool calls.
 * Use Ollama for tool calling functionality.
 * 
 * Supported parameters:
 * - temperature (0-2)
 * - top_p (0-1)
 * - max_tokens / max_completion_tokens
 * - stop (up to 4 sequences)
 * - seed (best effort determinism)
 */
export async function* streamGroqChat(
  messages: GroqChatMessage[],
  model: string,
  options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    stop?: string | string[];
    seed?: number;
    signal?: AbortSignal;
  } = {}
): AsyncGenerator<{
  type: 'content' | 'done' | 'error';
  content?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}> {
  const client = getGroqClient();
  if (!client) {
    yield { type: 'error', error: 'No Groq API key configured' };
    return;
  }

  // Convert to SDK message format - filter out tool messages since tools are disabled
  const sdkMessages: ChatCompletionMessageParam[] = messages
    .filter(msg => msg.role !== 'tool')
    .map(msg => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content || '' };
      } else if (msg.role === 'user') {
        return { role: 'user' as const, content: msg.content || '' };
      } else {
        return { role: 'assistant' as const, content: msg.content || '' };
      }
    });

  console.log('[Groq SDK] Streaming chat request:', { model, messageCount: messages.length });

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: sdkMessages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      max_completion_tokens: options.maxTokens ?? 2048,
      stop: options.stop,
      seed: options.seed
    }, {
      signal: options.signal
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      
      if (choice?.delta?.content) {
        yield { type: 'content', content: choice.delta.content };
      }
      
      if (choice?.finish_reason) {
        yield { type: 'done' };
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      yield { type: 'done' };
    } else if (err instanceof Groq.APIError) {
      console.error('[Groq SDK Error]', err.status, err.message);
      
      // Handle specific error types
      if (err instanceof Groq.RateLimitError) {
        yield { type: 'error', error: 'Rate limit exceeded. Please try again later.' };
      } else if (err instanceof Groq.AuthenticationError) {
        yield { type: 'error', error: 'Authentication failed. Please check your API key.' };
      } else if (err instanceof Groq.APIConnectionError) {
        yield { type: 'error', error: 'Connection failed. Please check your network.' };
      } else {
        yield { type: 'error', error: `API Error (${err.status}): ${err.message}` };
      }
    } else {
      yield { type: 'error', error: (err as Error).message };
    }
  }
}

/**
 * Non-streaming chat completion from Groq using the official SDK
 * 
 * NOTE: Tool calling is disabled. Use Ollama for tool support.
 */
export const chatGroq = async (
  messages: GroqChatMessage[],
  model: string,
  options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  } = {}
): Promise<{
  content: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> => {
  const client = getGroqClient();
  if (!client) {
    throw new Error('No Groq API key configured');
  }

  // Convert to SDK message format - filter out tool messages since tools are disabled
  const sdkMessages: ChatCompletionMessageParam[] = messages
    .filter(msg => msg.role !== 'tool')
    .map(msg => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content || '' };
      } else if (msg.role === 'user') {
        return { role: 'user' as const, content: msg.content || '' };
      } else {
        return { role: 'assistant' as const, content: msg.content || '' };
      }
    });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: sdkMessages,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      max_completion_tokens: options.maxTokens ?? 2048
    });

    const choice = completion.choices[0];
    
    return {
      content: choice.message.content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      }
    };
  } catch (err) {
    if (err instanceof Groq.APIError) {
      throw new Error(`Groq API Error (${err.status}): ${err.message}`);
    }
    throw err;
  }
};

/**
 * Recommended Groq models for different use cases
 * Updated: December 2025
 * 
 * NOTE: Tool calling is disabled for all Groq models.
 * Use Ollama for tool/function calling functionality.
 */
export const GROQ_RECOMMENDED_MODELS = {
  // General purpose - best quality
  general: 'llama-3.3-70b-versatile',
  
  // Fast responses - good for interactive use
  fast: 'llama-3.1-8b-instant',
  
  // Code generation - Qwen excels at code
  code: 'qwen/qwen3-32b',
  
  // Long context (256K!)
  longContext: 'moonshotai/kimi-k2-instruct-0905',
  
  // Complex reasoning
  reasoning: 'openai/gpt-oss-120b',
  
  // Efficient/lightweight
  efficient: 'llama-3.1-8b-instant',
  
  // Llama 4 (latest generation)
  llama4: 'meta-llama/llama-4-scout-17b-16e-instruct'
} as const;

/**
 * Get all known chat model IDs (without API call)
 */
export const getKnownGroqModels = (): string[] => {
  return Object.keys(GROQ_MODEL_INFO).filter(id => {
    const info = GROQ_MODEL_INFO[id];
    return info.modelType === 'chat';
  });
};
