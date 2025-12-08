/**
 * Groq API Service
 * 
 * Provides OpenAI-compatible API integration with Groq's ultra-fast inference.
 * Groq offers blazing-fast inference speeds (100-500+ tokens/sec) for popular models.
 * 
 * Features:
 * - Streaming chat completions
 * - Tool/function calling support
 * - Model listing and capabilities
 * - OpenAI-compatible API format
 */

import type {
  ApiProvider,
  GroqModel,
  GroqModelList,
  GroqChatMessage,
  GroqChatCompletionRequest,
  GroqStreamChunk,
  ToolDefinition,
  ToolCall,
  UnifiedModel
} from '../types';

// ============================================
// Configuration
// ============================================

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

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
    contextWindow: 131072, maxCompletionTokens: 32768, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Most capable Llama 3.3 - great for complex tasks' 
  },
  
  // Llama 3.1 models
  'llama-3.1-8b-instant': { 
    contextWindow: 131072, maxCompletionTokens: 131072, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Fast and efficient for quick responses' 
  },
  
  // Llama 4 models (NEW!)
  'meta-llama/llama-4-scout-17b-16e-instruct': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Llama 4 Scout - latest generation' 
  },
  'meta-llama/llama-4-maverick-17b-128e-instruct': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Llama 4 Maverick - extended expertise' 
  },
  
  // OpenAI GPT-OSS models (NEW!)
  'openai/gpt-oss-20b': { 
    contextWindow: 131072, maxCompletionTokens: 65536, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'OpenAI GPT OSS 20B - open source' 
  },
  'openai/gpt-oss-120b': { 
    contextWindow: 131072, maxCompletionTokens: 65536, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'OpenAI GPT OSS 120B - largest open source' 
  },
  
  // Qwen models (NEW!)
  'qwen/qwen3-32b': { 
    contextWindow: 131072, maxCompletionTokens: 40960, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Alibaba Qwen 3 - excellent for coding' 
  },
  
  // Groq Compound AI (NEW!)
  'groq/compound': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Groq Compound AI - multi-tool agent' 
  },
  'groq/compound-mini': { 
    contextWindow: 131072, maxCompletionTokens: 8192, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Groq Compound Mini - lightweight agent' 
  },
  
  // Moonshot Kimi (NEW!)
  'moonshotai/kimi-k2-instruct': { 
    contextWindow: 131072, maxCompletionTokens: 16384, supportsTools: true, 
    supportsVision: false, modelType: 'chat', description: 'Moonshot Kimi K2 - strong reasoning' 
  },
  'moonshotai/kimi-k2-instruct-0905': { 
    contextWindow: 262144, maxCompletionTokens: 16384, supportsTools: true, 
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
// API Functions
// ============================================

/**
 * Test Groq API connection with the stored API key
 */
export const testGroqConnection = async (): Promise<{ success: boolean; error?: string; models?: GroqModel[] }> => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  try {
    const response = await fetch(`${GROQ_API_BASE}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}` 
      };
    }

    const data: GroqModelList = await response.json();
    return { success: true, models: data.data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
};

/**
 * List available Groq models (chat models only)
 * Filters out audio transcription, TTS, and moderation models
 */
export const listGroqModels = async (): Promise<UnifiedModel[]> => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(`${GROQ_API_BASE}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch Groq models:', response.statusText);
      return [];
    }

    const data: GroqModelList = await response.json();
    
    // Filter to active chat models only (exclude audio/moderation models)
    return data.data
      .filter(model => {
        // Must be active
        if (!model.active) return false;
        
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
        // Exclude models with very small context (likely audio)
        if (model.context_window < 1000) return false;
        
        return true;
      })
      .map(model => {
        const info = GROQ_MODEL_INFO[model.id];
        return {
          id: model.id,
          name: model.id,
          displayName: info?.description || model.id,
          provider: 'groq' as ApiProvider,
          contextWindow: info?.contextWindow || model.context_window,
          maxCompletionTokens: info?.maxCompletionTokens || model.max_completion_tokens,
          supportsTools: info?.supportsTools ?? true,
          supportsVision: info?.supportsVision ?? false
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Error fetching Groq models:', err);
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
 */
export const convertToGroqMessages = (
  messages: Array<{ role: string; content: string; images?: string[]; tool_calls?: ToolCall[]; tool_name?: string }>
): GroqChatMessage[] => {
  return messages.map(msg => {
    // Handle tool responses
    if (msg.role === 'tool') {
      return {
        role: 'tool' as const,
        content: msg.content,
        tool_call_id: msg.tool_name || 'unknown'
      };
    }
    
    // Handle assistant messages with tool calls
    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      return {
        role: 'assistant' as const,
        content: msg.content || null,
        tool_calls: msg.tool_calls.map((tc, idx) => ({
          id: `call_${idx}`,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === 'string' 
              ? tc.function.arguments 
              : JSON.stringify(tc.function.arguments)
          }
        }))
      };
    }
    
    // Regular messages
    return {
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    };
  });
};

/**
 * Convert tool definitions to Groq format (OpenAI compatible)
 */
export const convertToGroqTools = (tools: ToolDefinition[]): ToolDefinition[] => {
  // Groq uses OpenAI format, which is the same as our internal format
  return tools;
};

/**
 * Stream chat completion from Groq
 * 
 * NOTE: Groq supports a LIMITED subset of OpenAI parameters:
 * - temperature (0-2)
 * - top_p (0-1)
 * - max_tokens / max_completion_tokens
 * - stop (up to 4 sequences)
 * - seed (best effort determinism)
 * 
 * NOT SUPPORTED (silently ignored or may error):
 * - frequency_penalty, presence_penalty (documented but not implemented)
 * - top_k, repeat_penalty, mirostat (Ollama-specific)
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
    tools?: ToolDefinition[];
    signal?: AbortSignal;
  } = {}
): AsyncGenerator<{
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCalls?: ToolCall[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    yield { type: 'error', error: 'No Groq API key configured' };
    return;
  }

  // Build request with only Groq-supported parameters
  const requestBody: GroqChatCompletionRequest = {
    model,
    messages,
    stream: true,
    // Groq-supported sampling parameters
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.9,
    max_completion_tokens: options.maxTokens ?? 2048, // Use new parameter name
  };

  // Add optional parameters if provided
  if (options.stop) {
    requestBody.stop = options.stop;
  }
  if (options.seed !== undefined) {
    requestBody.seed = options.seed;
  }

  // Add tools if provided and model supports them
  const modelInfo = GROQ_MODEL_INFO[model];
  if (options.tools?.length && modelInfo?.supportsTools !== false) {
    requestBody.tools = convertToGroqTools(options.tools);
    requestBody.tool_choice = 'auto';
  }

  try {
    const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: options.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      yield { 
        type: 'error', 
        error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}` 
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Accumulate tool calls across chunks
    const toolCallsMap: Map<number, { id: string; name: string; arguments: string }> = new Map();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json: GroqStreamChunk = JSON.parse(trimmed.slice(6));
          const choice = json.choices[0];
          
          if (!choice) continue;

          // Handle content
          if (choice.delta?.content) {
            yield { type: 'content', content: choice.delta.content };
          }

          // Handle tool calls (accumulated across chunks)
          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const existing = toolCallsMap.get(tc.index);
              if (existing) {
                // Append to existing tool call
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments;
                }
              } else {
                // New tool call
                toolCallsMap.set(tc.index, {
                  id: tc.id || `call_${tc.index}`,
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || ''
                });
              }
            }
          }

          // Handle finish
          if (choice.finish_reason) {
            // Emit accumulated tool calls
            if (toolCallsMap.size > 0 && choice.finish_reason === 'tool_calls') {
              const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map(tc => ({
                type: 'function' as const,
                function: {
                  name: tc.name,
                  arguments: JSON.parse(tc.arguments || '{}')
                }
              }));
              yield { type: 'tool_call', toolCalls };
            }
            
            yield { type: 'done' };
          }
        } catch (e) {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      yield { type: 'done' };
    } else {
      yield { type: 'error', error: (err as Error).message };
    }
  }
}

/**
 * Non-streaming chat completion from Groq (for simpler use cases)
 */
export const chatGroq = async (
  messages: GroqChatMessage[],
  model: string,
  options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    tools?: ToolDefinition[];
  } = {}
): Promise<{
  content: string | null;
  toolCalls?: ToolCall[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('No Groq API key configured');
  }

  const requestBody: GroqChatCompletionRequest = {
    model,
    messages,
    stream: false,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.9,
    max_tokens: options.maxTokens ?? 2048
  };

  // Add tools if provided
  const modelInfo = GROQ_MODEL_INFO[model];
  if (options.tools?.length && modelInfo?.supportsTools !== false) {
    requestBody.tools = convertToGroqTools(options.tools);
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const choice = data.choices[0];

  return {
    content: choice.message.content,
    toolCalls: choice.message.tool_calls?.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}')
      }
    })),
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens
    }
  };
};

/**
 * Recommended Groq models for different use cases
 * Updated: December 2025
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
  
  // Agent/tool use - Groq's compound AI
  agent: 'groq/compound',
  
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
