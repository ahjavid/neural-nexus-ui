/**
 * Tool Registry and Built-in Tools for Ollama Tool Calling
 * 
 * This module provides:
 * - Tool definitions with JSON schema
 * - Tool handler implementations
 * - Registry for managing available tools
 * - Neurosymbolic search integration (Phase 1-3)
 */

import type { ToolDefinition, ToolHandler, RegisteredTool, ToolCall } from '../types';
import { getApiUrl } from './helpers';
import { dbManager } from './storage';
import {
  extractEntities,
  createKnowledgeGraph,
  hybridSearch,
  enhancedHybridSearch,
  expandQuery,
  buildReasoningChain,
  formatReasoningChain,
  decomposeQuery,
  cosineSimilarity,
  rewriteQueryWithContext,
  queryNeedsContext,
  getHyDEEmbedding,
  type KnowledgeGraph,
  type HybridSearchResult,
  type EntityExtractionResult,
  type ContextMessage,
  type HyDEOptions
} from './neurosymbolic';

// ============================================
// Configuration Store (for API keys)
// ============================================

interface ToolConfig {
  tavilyApiKey?: string;
  ollamaEndpoint: string;
  embeddingModel: string;
  summaryModel?: string;  // Utility model for conversation summaries (smaller/faster)
}

// Conversation context for query rewriting (injected from App)
let conversationContextCache: ContextMessage[] = [];

/**
 * Set conversation context for query rewriting in RAG search
 * Called from App.tsx before tool execution
 */
export const setConversationContext = (messages: ContextMessage[]): void => {
  conversationContextCache = messages.slice(-6); // Keep last 6 messages
};

/**
 * Get stored conversation context
 */
export const getConversationContext = (): ContextMessage[] => {
  return conversationContextCache;
};

const getToolConfig = (): ToolConfig => {
  return {
    tavilyApiKey: localStorage.getItem('nexus_tavily_api_key') || undefined,
    ollamaEndpoint: localStorage.getItem('ollama_endpoint') || 'http://localhost:11434',
    embeddingModel: localStorage.getItem('nexus_embedding_model') || 'mxbai-embed-large:latest',
    summaryModel: localStorage.getItem('nexus_summary_model') || undefined
  };
};

export const setToolConfig = (key: keyof ToolConfig, value: string): void => {
  if (key === 'tavilyApiKey') {
    localStorage.setItem('nexus_tavily_api_key', value);
  } else if (key === 'embeddingModel') {
    localStorage.setItem('nexus_embedding_model', value);
  } else if (key === 'summaryModel') {
    localStorage.setItem('nexus_summary_model', value);
  }
};

export const getToolConfigValue = (key: keyof ToolConfig): string | undefined => {
  return getToolConfig()[key];
};

// ============================================
// Built-in Tool Handlers
// ============================================

/**
 * Get current date and time
 */
const getCurrentTime: ToolHandler = (args) => {
  const timezone = (args.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const format = (args.format as string) || 'full';
  
  const now = new Date();
  
  try {
    if (format === 'iso') {
      return now.toISOString();
    } else if (format === 'date') {
      return now.toLocaleDateString('en-US', { timeZone: timezone });
    } else if (format === 'time') {
      return now.toLocaleTimeString('en-US', { timeZone: timezone });
    } else {
      return now.toLocaleString('en-US', { 
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  } catch {
    return now.toLocaleString();
  }
};

/**
 * Perform mathematical calculations
 */
const calculate: ToolHandler = (args) => {
  const expression = args.expression as string;
  
  if (!expression) {
    return 'Error: No expression provided';
  }
  
  // Sanitize: only allow numbers, operators, parentheses, decimal points, and spaces
  const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
  
  if (sanitized !== expression) {
    return 'Error: Invalid characters in expression. Only numbers and basic operators (+, -, *, /, %, ^, parentheses) are allowed.';
  }
  
  try {
    // Replace ^ with ** for exponentiation
    const jsExpression = sanitized.replace(/\^/g, '**');
    // Use Function constructor for safe evaluation (still sandboxed)
    const result = new Function(`return (${jsExpression})`)();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return 'Error: Invalid calculation result';
    }
    
    return `${expression} = ${result}`;
  } catch (e) {
    return `Error: Could not evaluate expression "${expression}"`;
  }
};

/**
 * Generate a random number
 */
const randomNumber: ToolHandler = (args) => {
  const min = (args.min as number) ?? 0;
  const max = (args.max as number) ?? 100;
  const integer = (args.integer as boolean) ?? true;
  
  if (min >= max) {
    return 'Error: min must be less than max';
  }
  
  const random = Math.random() * (max - min) + min;
  const result = integer ? Math.floor(random) : Number(random.toFixed(4));
  
  return `Random number between ${min} and ${max}: ${result}`;
};

/**
 * Get information about a URL (fetch and summarize)
 * Uses CORS proxy for cross-origin requests
 */
const fetchUrl: ToolHandler = async (args) => {
  const url = args.url as string;
  
  if (!url) {
    return 'Error: No URL provided';
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    return 'Error: Invalid URL format';
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    // Use CORS proxy to bypass browser restrictions
    // codetabs.com is a free CORS proxy
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return `Error: HTTP ${response.status} - ${response.statusText}`;
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const text = JSON.stringify(json, null, 2);
      // Limit response size
      return text.length > 4000 ? text.slice(0, 4000) + '\n... (truncated)' : text;
    }
    
    if (contentType.includes('text/')) {
      const text = await response.text();
      // Extract text content, strip excessive HTML if present
      const cleanText = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleanText.length > 4000 ? cleanText.slice(0, 4000) + '\n... (truncated)' : cleanText;
    }
    
    return `Fetched ${url} - Content-Type: ${contentType}, Size: ${response.headers.get('content-length') || 'unknown'} bytes`;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return 'Error: Request timed out after 10 seconds';
    }
    return `Error fetching URL: ${(e as Error).message}`;
  }
};

/**
 * Encode or decode text (base64, URL encoding)
 */
const encodeText: ToolHandler = (args) => {
  const text = args.text as string;
  const method = (args.method as string) || 'base64';
  const action = (args.action as string) || 'encode';
  
  if (!text) {
    return 'Error: No text provided';
  }
  
  try {
    if (method === 'base64') {
      if (action === 'encode') {
        return btoa(unescape(encodeURIComponent(text)));
      } else {
        return decodeURIComponent(escape(atob(text)));
      }
    } else if (method === 'url') {
      if (action === 'encode') {
        return encodeURIComponent(text);
      } else {
        return decodeURIComponent(text);
      }
    } else {
      return 'Error: Unknown encoding method. Use "base64" or "url"';
    }
  } catch (e) {
    return `Error: Failed to ${action} text - ${(e as Error).message}`;
  }
};

/**
 * Generate a UUID
 */
const generateUuid: ToolHandler = () => {
  return crypto.randomUUID();
};

/**
 * Web search - uses Tavily if API key is configured, otherwise DuckDuckGo
 */
const webSearch: ToolHandler = async (args) => {
  const query = args.query as string;
  const searchDepth = (args.search_depth as string) || 'basic';
  const maxResults = (args.max_results as number) || 5;
  
  if (!query) {
    return 'Error: No search query provided';
  }
  
  const config = getToolConfig();
  
  // Use Tavily if API key is configured (better results)
  if (config.tavilyApiKey) {
    console.log('[Web Search] Using Tavily API');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.tavilyApiKey,
          query: query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: true,
          include_raw_content: false
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          return 'Error: Invalid Tavily API key. Please check your key in Settings.';
        }
        // Fall back to DuckDuckGo on error
        console.log('[Web Search] Tavily failed, falling back to DuckDuckGo');
      } else {
        const data = await response.json();
        const results: string[] = [];
        
        if (data.answer) {
          results.push(`**Answer:** ${data.answer}\n`);
        }
        
        if (data.results && data.results.length > 0) {
          results.push('**Sources:**');
          for (const result of data.results) {
            results.push(`\n**${result.title}**`);
            results.push(`URL: ${result.url}`);
            if (result.content) {
              results.push(`${result.content.slice(0, 300)}${result.content.length > 300 ? '...' : ''}`);
            }
          }
        }
        
        if (results.length > 0) {
          return `Web search results for "${query}":\n\n${results.join('\n')}`;
        }
      }
    } catch (e) {
      console.log('[Web Search] Tavily error, falling back to DuckDuckGo:', (e as Error).message);
    }
  }
  
  // Fallback to DuckDuckGo Instant Answer API
  console.log('[Web Search] Using DuckDuckGo API');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    // Use DuckDuckGo Instant Answer API (no CORS issues)
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return `Error: Search failed with HTTP ${response.status}`;
    }
    
    const data = await response.json();
    
    // Build results from API response
    const results: string[] = [];
    
    // Add abstract (main answer) if available
    if (data.Abstract) {
      results.push(`**Summary:** ${data.Abstract}`);
      if (data.AbstractSource && data.AbstractURL) {
        results.push(`Source: ${data.AbstractSource} - ${data.AbstractURL}`);
      }
    }
    
    // Add definition if available
    if (data.Definition) {
      results.push(`**Definition:** ${data.Definition}`);
    }
    
    // Add answer if available (for calculations, conversions, etc.)
    if (data.Answer) {
      results.push(`**Answer:** ${data.Answer}`);
    }
    
    // Add related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      results.push('\n**Related Information:**');
      const topics = data.RelatedTopics.slice(0, 5);
      for (const topic of topics) {
        if (topic.Text) {
          results.push(`- ${topic.Text}`);
          if (topic.FirstURL) {
            results.push(`  URL: ${topic.FirstURL}`);
          }
        } else if (topic.Topics) {
          // Nested topics (categories)
          for (const subtopic of topic.Topics.slice(0, 2)) {
            if (subtopic.Text) {
              results.push(`- ${subtopic.Text}`);
            }
          }
        }
      }
    }
    
    // Add infobox data if available
    if (data.Infobox && data.Infobox.content) {
      results.push('\n**Details:**');
      for (const item of data.Infobox.content.slice(0, 5)) {
        if (item.label && item.value) {
          results.push(`- ${item.label}: ${item.value}`);
        }
      }
    }
    
    if (results.length === 0) {
      // Fallback message with helpful suggestions
      return `No instant answer found for "${query}". The DuckDuckGo Instant Answer API works best for:\n- Definitions (e.g., "define algorithm")\n- Facts about people, places, things\n- Calculations and conversions\n- Programming/tech questions\n\nTry rephrasing your query or being more specific.`;
    }
    
    return `Search results for "${query}":\n\n${results.join('\n')}`;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return 'Error: Search timed out';
    }
    return `Error searching: ${(e as Error).message}`;
  }
};

/**
 * Tavily Extract - Intelligent content extraction from URLs
 * Uses Tavily's AI-powered extraction for cleaner, more structured content than basic fetch
 */
const tavilyExtract: ToolHandler = async (args) => {
  const urls = args.urls as string | string[];
  const includeImages = (args.include_images as boolean) ?? false;
  const extractDepth = (args.extract_depth as string) || 'basic';
  const format = (args.format as string) || 'markdown';
  
  if (!urls || (Array.isArray(urls) && urls.length === 0)) {
    return 'Error: No URLs provided';
  }
  
  const config = getToolConfig();
  
  if (!config.tavilyApiKey) {
    return 'Error: Tavily API key is required for extract. Please configure it in Settings > API Keys.';
  }
  
  // Normalize urls to array
  const urlList = Array.isArray(urls) ? urls : [urls];
  
  // Validate URLs
  for (const url of urlList) {
    try {
      new URL(url);
    } catch {
      return `Error: Invalid URL format - ${url}`;
    }
  }
  
  // Limit to 20 URLs (API limit)
  if (urlList.length > 20) {
    return 'Error: Maximum 20 URLs allowed per request';
  }
  
  try {
    const controller = new AbortController();
    const timeoutMs = extractDepth === 'advanced' ? 60000 : 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    console.log(`[Tavily Extract] Extracting ${urlList.length} URL(s) with depth: ${extractDepth}`);
    
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.tavilyApiKey}`
      },
      body: JSON.stringify({
        urls: urlList,
        include_images: includeImages,
        extract_depth: extractDepth,
        format: format
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 401) {
        return 'Error: Invalid Tavily API key. Please check your key in Settings.';
      }
      if (response.status === 429) {
        return 'Error: Tavily API rate limit exceeded. Please try again later.';
      }
      return `Error: Tavily Extract failed with HTTP ${response.status} - ${response.statusText}`;
    }
    
    const data = await response.json();
    const results: string[] = [];
    
    // Process successful results
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        results.push(`\n## ${result.title || 'Extracted Content'}`);
        results.push(`**URL:** ${result.url}`);
        
        if (result.content || result.raw_content) {
          const content = result.content || result.raw_content;
          // Truncate very long content
          const truncated = content.length > 8000 
            ? content.slice(0, 8000) + '\n\n*... (content truncated)*'
            : content;
          results.push(`\n${truncated}`);
        }
        
        if (includeImages && result.images && result.images.length > 0) {
          results.push(`\n**Images (${result.images.length}):**`);
          for (const img of result.images.slice(0, 5)) {
            results.push(`- ${img}`);
          }
          if (result.images.length > 5) {
            results.push(`- ... and ${result.images.length - 5} more`);
          }
        }
      }
    }
    
    // Report any failures
    if (data.failed_results && data.failed_results.length > 0) {
      results.push('\n---\n**Failed to extract:**');
      for (const failed of data.failed_results) {
        results.push(`- ${failed.url}: ${failed.error || 'Unknown error'}`);
      }
    }
    
    if (results.length === 0) {
      return 'No content could be extracted from the provided URL(s).';
    }
    
    const responseTime = data.response_time ? ` (${data.response_time.toFixed(2)}s)` : '';
    return `# Tavily Extract Results${responseTime}\n${results.join('\n')}`;
    
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return `Error: Extraction timed out after ${extractDepth === 'advanced' ? 60 : 30} seconds`;
    }
    return `Error extracting content: ${(e as Error).message}`;
  }
};

/**
 * Get text statistics (word count, character count, etc.)
 */
const textStats: ToolHandler = (args) => {
  const text = args.text as string;
  
  if (!text) {
    return 'Error: No text provided';
  }
  
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const lines = text.split(/\r?\n/).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  
  return `Text Statistics:
- Characters: ${chars.toLocaleString()}
- Characters (no spaces): ${charsNoSpaces.toLocaleString()}
- Words: ${words.toLocaleString()}
- Lines: ${lines.toLocaleString()}
- Sentences: ${sentences.toLocaleString()}
- Paragraphs: ${paragraphs.toLocaleString()}
- Average word length: ${words > 0 ? (charsNoSpaces / words).toFixed(1) : 0} chars`;
};

// ============================================
// RAG (Retrieval-Augmented Generation) Search
// ============================================

// Extended cache to support neurosymbolic features
interface EmbeddingCache {
  entries: Map<string, { id: string; content: string; embedding: number[] }>;
  model: string;
  lastUpdated: number;
  knowledgeGraph?: KnowledgeGraph;
  nodeEmbeddings?: Map<string, number[]>;
}

let embeddingCache: EmbeddingCache | null = null;

// ============================================
// Embedding Cache Persistence (IndexedDB)
// ============================================

interface PersistedEmbeddingCache {
  key: string; // Required for IndexedDB keyPath
  entries: Array<{ id: string; content: string; embedding: number[] }>;
  nodeEmbeddings: Array<[string, number[]]>;
  model: string;
  kbHash: string;
  lastUpdated: number;
}

/**
 * Save embedding cache to IndexedDB for persistence across page reloads
 */
const saveEmbeddingCacheToDb = async (cache: EmbeddingCache & { kbHash?: string }): Promise<void> => {
  if (!cache.kbHash) return;
  
  try {
    const persistedCache: PersistedEmbeddingCache = {
      key: 'embedding_cache',
      entries: Array.from(cache.entries.values()),
      nodeEmbeddings: cache.nodeEmbeddings ? Array.from(cache.nodeEmbeddings.entries()) : [],
      model: cache.model,
      kbHash: cache.kbHash,
      lastUpdated: cache.lastUpdated
    };
    
    await dbManager.put('embeddings', persistedCache);
    console.log('[Embedding Cache] Saved to IndexedDB:', persistedCache.entries.length, 'embeddings');
  } catch (e) {
    console.error('[Embedding Cache] Failed to save to IndexedDB:', e);
  }
};

/**
 * Load embedding cache from IndexedDB
 */
const loadEmbeddingCacheFromDb = async (): Promise<(EmbeddingCache & { kbHash?: string }) | null> => {
  try {
    const persisted = await dbManager.get<PersistedEmbeddingCache>('embeddings', 'embedding_cache');
    
    if (!persisted) {
      console.log('[Embedding Cache] No cached embeddings in IndexedDB');
      return null;
    }
    
    // Reconstruct Maps from arrays
    const entries = new Map<string, { id: string; content: string; embedding: number[] }>();
    for (const entry of persisted.entries) {
      entries.set(entry.id, entry);
    }
    
    const nodeEmbeddings = new Map<string, number[]>(persisted.nodeEmbeddings);
    
    console.log('[Embedding Cache] Loaded from IndexedDB:', entries.size, 'embeddings');
    
    return {
      entries,
      nodeEmbeddings,
      model: persisted.model,
      kbHash: persisted.kbHash,
      lastUpdated: persisted.lastUpdated
    };
  } catch (e) {
    console.error('[Embedding Cache] Failed to load from IndexedDB:', e);
    return null;
  }
};

/**
 * Clear persisted embedding cache from IndexedDB
 */
const clearPersistedEmbeddingCache = async (): Promise<void> => {
  try {
    await dbManager.delete('embeddings', 'embedding_cache');
    console.log('[Embedding Cache] Cleared from IndexedDB');
  } catch (e) {
    console.error('[Embedding Cache] Failed to clear from IndexedDB:', e);
  }
};

// Store for extracted entities from recent searches (for explainability)
let lastSearchExplanation: {
  query: string;
  queryEntities: EntityExtractionResult;
  results: HybridSearchResult[];
  reasoningChain?: string;
} | null = null;

/**
 * Get the last search explanation for UI display
 */
export const getLastSearchExplanation = () => lastSearchExplanation;

/**
 * Get embedding from Ollama (single text)
 */
const getEmbedding = async (text: string, model: string, endpoint: string): Promise<number[]> => {
  const response = await fetch(getApiUrl(endpoint, '/api/embed'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      input: text
    })
  });
  
  if (!response.ok) {
    throw new Error(`Embedding API returned HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.embeddings[0];
};

/**
 * Get embeddings from Ollama in batch (multiple texts in one API call)
 * This is much more efficient than calling getEmbedding() multiple times
 * 
 * @param texts - Array of texts to embed
 * @param model - Embedding model name
 * @param endpoint - Ollama endpoint URL
 * @param batchSize - Max texts per API call (default 50, adjust based on memory)
 * @returns Array of embeddings in same order as input texts
 */
const getBatchEmbeddings = async (
  texts: string[],
  model: string,
  endpoint: string,
  batchSize: number = 50
): Promise<number[][]> => {
  if (texts.length === 0) return [];
  
  const allEmbeddings: number[][] = [];
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    console.log(`[Batch Embedding] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`);
    
    const response = await fetch(getApiUrl(endpoint, '/api/embed'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        input: batch
      })
    });
    
    if (!response.ok) {
      throw new Error(`Batch Embedding API returned HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.embeddings || data.embeddings.length !== batch.length) {
      throw new Error(`Expected ${batch.length} embeddings, got ${data.embeddings?.length || 0}`);
    }
    
    allEmbeddings.push(...data.embeddings);
  }
  
  return allEmbeddings;
};

/**
 * Load and embed knowledge base entries with neurosymbolic enhancements
 * Builds both embeddings and knowledge graph
 * Now with IndexedDB persistence for instant reload!
 */
const loadKnowledgeBaseEmbeddings = async (): Promise<EmbeddingCache | null> => {
  const config = getToolConfig();
  
  // Load knowledge base from localStorage (same key as App.tsx)
  const storedKb = localStorage.getItem('nexus_knowledge_base');
  if (!storedKb) {
    return null;
  }
  
  let entries: Array<{ 
    id: number; 
    title: string; 
    content: string;
    chunks?: Array<{ id: string; content: string; index: number }>;
    source?: string;
    createdAt?: number;
  }>;
  try {
    entries = JSON.parse(storedKb);
  } catch {
    return null;
  }
  
  if (!entries || entries.length === 0) {
    return null;
  }
  
  // Generate a hash of the knowledge base for cache invalidation
  const kbHash = entries.map(e => `${e.id}:${e.content.length}`).join('|');
  
  // Check if in-memory cache is still valid
  if (
    embeddingCache &&
    embeddingCache.model === config.embeddingModel &&
    (embeddingCache as EmbeddingCache & { kbHash?: string }).kbHash === kbHash
  ) {
    return embeddingCache;
  }
  
  // Try to load from IndexedDB (persisted cache)
  const persistedCache = await loadEmbeddingCacheFromDb();
  if (
    persistedCache &&
    persistedCache.model === config.embeddingModel &&
    persistedCache.kbHash === kbHash
  ) {
    console.log('[Neurosymbolic RAG] ✓ Using persisted embeddings from IndexedDB (instant!)');
    
    // Build knowledge graph (fast, no API calls)
    const knowledgeGraph = createKnowledgeGraph(entries);
    
    // Restore full cache with knowledge graph
    embeddingCache = {
      ...persistedCache,
      knowledgeGraph
    };
    
    return embeddingCache;
  }
  
  console.log('[Neurosymbolic RAG] Building embedding cache and knowledge graph for', entries.length, 'documents');
  
  // Build knowledge graph (symbolic component)
  const knowledgeGraph = createKnowledgeGraph(entries);
  console.log('[Neurosymbolic RAG] Built knowledge graph with', knowledgeGraph.nodes.size, 'nodes and', knowledgeGraph.relations.length, 'relations');
  
  // Embed all entries (use chunks if available, otherwise whole document)
  const cache: EmbeddingCache & { kbHash?: string } = {
    entries: new Map(),
    model: config.embeddingModel,
    lastUpdated: Date.now(),
    kbHash,
    knowledgeGraph,
    nodeEmbeddings: new Map()
  };
  
  // Collect all texts to embed with their metadata
  const textsToEmbed: Array<{
    id: string;
    text: string;
    displayContent: string;
  }> = [];
  
  for (const entry of entries) {
    if (entry.chunks && entry.chunks.length > 0) {
      // Add each chunk
      for (const chunk of entry.chunks) {
        const chunkId = `${entry.id}-${chunk.id}`;
        textsToEmbed.push({
          id: chunkId,
          text: chunk.content,
          displayContent: `**${entry.title}** (chunk ${chunk.index + 1}/${entry.chunks.length})\n${chunk.content}`
        });
      }
    } else {
      // Add whole document
      textsToEmbed.push({
        id: String(entry.id),
        text: `${entry.title}\n\n${entry.content}`,
        displayContent: `**${entry.title}**\n${entry.content}`
      });
    }
  }
  
  console.log(`[Neurosymbolic RAG] Embedding ${textsToEmbed.length} texts using batch API...`);
  const startTime = Date.now();
  
  try {
    // Use batch embedding for efficiency (single API call per batch instead of N calls)
    const embeddings = await getBatchEmbeddings(
      textsToEmbed.map(t => t.text),
      config.embeddingModel,
      config.ollamaEndpoint,
      50 // batch size
    );
    
    // Map embeddings back to cache entries
    for (let i = 0; i < textsToEmbed.length; i++) {
      const item = textsToEmbed[i];
      const embedding = embeddings[i];
      
      cache.entries.set(item.id, {
        id: item.id,
        content: item.displayContent,
        embedding
      });
      cache.nodeEmbeddings!.set(item.id, embedding);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Neurosymbolic RAG] ✓ Batch embedded ${textsToEmbed.length} texts in ${duration}s`);
  } catch (e) {
    console.error('[Neurosymbolic RAG] Batch embedding failed, falling back to sequential:', e);
    
    // Fallback to sequential embedding if batch fails
    for (const item of textsToEmbed) {
      try {
        const embedding = await getEmbedding(item.text, config.embeddingModel, config.ollamaEndpoint);
        cache.entries.set(item.id, {
          id: item.id,
          content: item.displayContent,
          embedding
        });
        cache.nodeEmbeddings!.set(item.id, embedding);
      } catch (err) {
        console.error(`[Neurosymbolic RAG] Failed to embed ${item.id}:`, err);
      }
    }
  }
  
  console.log('[Neurosymbolic RAG] Embedded', cache.entries.size, 'chunks/documents');
  
  // Save to IndexedDB for persistence across page reloads
  await saveEmbeddingCacheToDb(cache);
  
  embeddingCache = cache;
  return cache;
};

/**
 * Neurosymbolic RAG search using enhanced hybrid approach:
 * - Neural: embedding similarity
 * - Symbolic: entity matching, keyword overlap, knowledge graph relations
 * - BM25: sparse keyword retrieval
 * - RRF: reciprocal rank fusion for combining signals
 * - MMR: maximal marginal relevance for diversity
 * - Query Expansion: synonyms and acronyms
 * - Query Rewriting: context-aware pronoun and reference resolution
 * - HyDE: hypothetical document embedding for better semantic matching
 * - Parent Document Retrieval: return larger context chunks
 */
const ragSearch: ToolHandler = async (args) => {
  let query = args.query as string;
  const topK = (args.top_k as number) || 5;
  const threshold = (args.threshold as number) || 0.1;
  const useHybrid = (args.hybrid as boolean) !== false; // Default to hybrid
  const showReasoning = (args.show_reasoning as boolean) || false;
  const useEnhanced = (args.enhanced as boolean) !== false; // Default to enhanced
  const useHyDE = (args.use_hyde as boolean) || false; // HyDE is opt-in (uses extra LLM call)
  // Use provided context or fall back to cached context from App
  const conversationContext = (args.conversation_context as ContextMessage[] | undefined) || getConversationContext();
  
  if (!query) {
    return 'Error: No search query provided';
  }
  
  const config = getToolConfig();
  
  // Apply query rewriting if conversation context is available and query needs it
  let queryRewriteInfo = '';
  if (conversationContext.length > 0 && queryNeedsContext(query)) {
    const rewriteResult = rewriteQueryWithContext(query, conversationContext);
    if (rewriteResult.rewritten !== rewriteResult.original) {
      queryRewriteInfo = `\n📝 Query rewritten: "${query}" → "${rewriteResult.rewritten}" (${rewriteResult.changes.join(', ')})`;
      query = rewriteResult.rewritten;
    }
  }
  
  // HyDE: Generate hypothetical document embedding if enabled
  let hydeInfo = '';
  let hydeEmbeddingResult: { embedding: number[]; hypotheticalDoc: string; usedHyDE: boolean } | null = null;
  
  if (useHyDE && config.summaryModel) {
    const hydeOptions: HyDEOptions = {
      model: config.summaryModel,
      endpoint: config.ollamaEndpoint,
      maxTokens: 150,
      temperature: 0.3
    };
    
    const getEmbeddingFn = async (text: string) => 
      getEmbedding(text, config.embeddingModel, config.ollamaEndpoint);
    
    hydeEmbeddingResult = await getHyDEEmbedding(query, getEmbeddingFn, hydeOptions);
    
    if (hydeEmbeddingResult.usedHyDE) {
      hydeInfo = `\n🔮 HyDE: Generated hypothetical document for better matching`;
      console.log('[RAG] HyDE hypothetical doc:', hydeEmbeddingResult.hypotheticalDoc.slice(0, 100) + '...');
    }
  }
  
  try {
    // Load and embed knowledge base (with knowledge graph)
    const cache = await loadKnowledgeBaseEmbeddings();
    
    if (!cache || cache.entries.size === 0) {
      return 'No documents found in knowledge base. Please add documents in the Knowledge Base section.';
    }
    
    // Extract entities from query for explanation
    const queryEntities = extractEntities(query);
    
    // Expand query with synonyms and acronyms for better recall
    const expandedQueries = expandQuery(query, {
      maxExpansions: 3,
      includeSynonyms: true,
      includeAcronyms: true,
      includePartial: false
    });
    
    console.log('[Neurosymbolic RAG] Query analysis:', {
      entities: queryEntities.entities.length,
      keywords: queryEntities.keywords.length,
      entityTypes: queryEntities.entities.map(e => `${e.type}:${e.value}`),
      topKeywords: queryEntities.keywords.slice(0, 5),
      expandedQueries: expandedQueries.length > 1 ? expandedQueries.map(e => e.query) : 'none'
    });
    
    // Check for query decomposition (comparison queries, etc.)
    const subQueries = decomposeQuery(query);
    const isComplexQuery = subQueries.length > 1;
    
    let results: HybridSearchResult[] = [];
    
    if (useHybrid && cache.knowledgeGraph && cache.nodeEmbeddings) {
      // Get query embedding function - use HyDE embedding if available
      const getQueryEmbedding = async (text: string) => {
        // If HyDE was used and this is the main query, return the pre-computed HyDE embedding
        if (hydeEmbeddingResult?.usedHyDE && text === query) {
          console.log('[RAG] Using HyDE embedding instead of query embedding');
          return hydeEmbeddingResult.embedding;
        }
        // Otherwise compute embedding normally
        return getEmbedding(text, config.embeddingModel, config.ollamaEndpoint);
      };
      
      if (useEnhanced) {
        // Use ENHANCED neurosymbolic search with BM25 + RRF + MMR
        console.log('[Neurosymbolic RAG] Using ENHANCED hybrid search (BM25 + RRF + MMR)');
        
        // For complex queries, search each sub-query with enhanced search
        if (isComplexQuery) {
          console.log('[Neurosymbolic RAG] Complex query detected, decomposing into:', subQueries);
          
          const allResults: HybridSearchResult[] = [];
          for (const subQuery of subQueries) {
            const subResults = await enhancedHybridSearch(
              subQuery,
              cache.knowledgeGraph,
              getQueryEmbedding,
              cache.nodeEmbeddings,
              { 
                topK: Math.ceil(topK / subQueries.length) + 2,
                minScore: threshold,
                useBM25: true,
                useRRF: true,
                useMMR: true,
                mmrLambda: 0.7,
                diversityThreshold: 0.85
              }
            );
            allResults.push(...subResults);
          }
          
          // Deduplicate and re-rank
          const seenIds = new Set<string>();
          results = allResults.filter(r => {
            if (seenIds.has(r.nodeId)) return false;
            seenIds.add(r.nodeId);
            return true;
          }).sort((a, b) => b.score - a.score).slice(0, topK);
        } else {
          // Simple query - use enhanced search with query expansion
          // Search with original + expanded queries and merge results
          const allResults: HybridSearchResult[] = [];
          
          for (const expansion of expandedQueries) {
            const expansionResults = await enhancedHybridSearch(
              expansion.query,
              cache.knowledgeGraph,
              getQueryEmbedding,
              cache.nodeEmbeddings,
              { 
                topK: topK + 2, // Get extra for merging
                minScore: threshold,
                useBM25: true,
                useRRF: true,
                useMMR: false // Will apply MMR after merging
              }
            );
            
            // Weight results by expansion weight
            for (const r of expansionResults) {
              r.score *= expansion.weight;
            }
            allResults.push(...expansionResults);
          }
          
          // Deduplicate, keeping highest score
          const resultMap = new Map<string, HybridSearchResult>();
          for (const r of allResults) {
            const existing = resultMap.get(r.nodeId);
            if (!existing || r.score > existing.score) {
              resultMap.set(r.nodeId, r);
            }
          }
          
          results = [...resultMap.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
        }
      } else {
        // Use basic neurosymbolic hybrid search
        console.log('[Neurosymbolic RAG] Using basic hybrid search');
        
        if (isComplexQuery) {
          console.log('[Neurosymbolic RAG] Complex query detected, decomposing into:', subQueries);
          
          const allResults: HybridSearchResult[] = [];
          for (const subQuery of subQueries) {
            const subResults = await hybridSearch(
              subQuery,
              cache.knowledgeGraph,
              getQueryEmbedding,
              cache.nodeEmbeddings,
              { 
                topK: Math.ceil(topK / subQueries.length) + 2,
                minScore: threshold,
                semanticWeight: 0.45,
                entityWeight: 0.30,
                keywordWeight: 0.15,
                graphWeight: 0.10
              }
            );
            allResults.push(...subResults);
          }
          
          const seenIds = new Set<string>();
          results = allResults.filter(r => {
            if (seenIds.has(r.nodeId)) return false;
            seenIds.add(r.nodeId);
            return true;
          }).sort((a, b) => b.score - a.score).slice(0, topK);
        } else {
          results = await hybridSearch(
            query,
            cache.knowledgeGraph,
            getQueryEmbedding,
            cache.nodeEmbeddings,
            { 
              topK: topK,
              minScore: threshold,
              semanticWeight: 0.45,
              entityWeight: 0.30,
              keywordWeight: 0.15,
              graphWeight: 0.10
            }
          );
        }
      }
    } else {
      // Fallback to pure semantic search
      console.log('[Neurosymbolic RAG] Using pure semantic search (fallback)');
      
      const queryEmbedding = await getEmbedding(query, config.embeddingModel, config.ollamaEndpoint);
      
      const similarities: Array<{ id: string; content: string; score: number }> = [];
      
      for (const [, entry] of cache.entries) {
        const score = cosineSimilarity(queryEmbedding, entry.embedding);
        if (score >= threshold) {
          similarities.push({
            id: entry.id,
            content: entry.content,
            score
          });
        }
      }
      
      similarities.sort((a, b) => b.score - a.score);
      
      results = similarities.slice(0, topK).map(s => ({
        nodeId: s.id,
        content: s.content,
        title: '',
        score: s.score,
        explanation: {
          semanticScore: s.score,
          entityMatches: [],
          keywordMatches: [],
          graphConnections: []
        }
      }));
    }
    
    // Store explanation for UI display
    lastSearchExplanation = {
      query,
      queryEntities,
      results
    };
    
    console.log('[Neurosymbolic RAG] Search completed:', results.length, 'results found');
    
    if (results.length === 0) {
      return `No relevant documents found for "${query}" (threshold: ${threshold}). Try:\n- Lowering the threshold\n- Using different keywords\n- Adding more relevant documents`;
    }
    
    // Build reasoning chain if requested
    let reasoningOutput = '';
    if (showReasoning && cache.knowledgeGraph) {
      const chain = await buildReasoningChain(query, cache.knowledgeGraph, results);
      reasoningOutput = '\n\n' + formatReasoningChain(chain);
      lastSearchExplanation.reasoningChain = reasoningOutput;
    }
    
    // Format results with explanations
    const output: string[] = [
      `🔍 **Neurosymbolic Search Results** for "${query}"`,
      `Found ${results.length} relevant document(s)`,
      ''
    ];
    
    // Show query rewrite info if applied
    if (queryRewriteInfo) {
      output.push(queryRewriteInfo);
    }
    
    // Show HyDE info if applied
    if (hydeInfo) {
      output.push(hydeInfo);
    }
    
    if (queryRewriteInfo || hydeInfo) {
      output.push('');
    }
    
    // Show query analysis
    if (queryEntities.entities.length > 0 || queryEntities.keywords.length > 0) {
      output.push('**Query Analysis:**');
      if (queryEntities.entities.length > 0) {
        const entitySummary = queryEntities.entities
          .slice(0, 5)
          .map(e => `${e.type}: "${e.value}"`)
          .join(', ');
        output.push(`- Entities detected: ${entitySummary}`);
      }
      if (queryEntities.keywords.length > 0) {
        output.push(`- Keywords: ${queryEntities.keywords.slice(0, 8).join(', ')}`);
      }
      output.push('');
    }
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const exp = result.explanation;
      
      output.push(`---`);
      output.push(`**Document ${i + 1}** | Score: ${(result.score * 100).toFixed(1)}%`);
      
      // Show score breakdown
      const breakdown: string[] = [];
      if (exp.semanticScore > 0) {
        breakdown.push(`Semantic: ${(exp.semanticScore * 100).toFixed(0)}%`);
      }
      if (exp.entityMatches.length > 0) {
        breakdown.push(`Entities: ${exp.entityMatches.length} match${exp.entityMatches.length > 1 ? 'es' : ''}`);
      }
      if (exp.keywordMatches.length > 0) {
        breakdown.push(`Keywords: ${exp.keywordMatches.length}`);
      }
      if (exp.graphConnections.length > 0) {
        breakdown.push(`Graph links: ${exp.graphConnections.length}`);
      }
      if (breakdown.length > 0) {
        output.push(`*[${breakdown.join(' | ')}]*`);
      }
      
      output.push('');
      output.push(result.content);
      output.push('');
    }
    
    // Add reasoning chain if available
    if (reasoningOutput) {
      output.push(reasoningOutput);
    }
    
    return output.join('\n');
  } catch (e) {
    if ((e as Error).message?.includes('HTTP')) {
      return `Error: Could not generate embeddings. Make sure the embedding model "${config.embeddingModel}" is available in Ollama.`;
    }
    return `Error performing neurosymbolic search: ${(e as Error).message}`;
  }
};

/**
 * Clear embedding cache (call when knowledge base changes)
 * Clears both in-memory and IndexedDB persisted cache
 */
export const clearEmbeddingCache = (): void => {
  embeddingCache = null;
  // Also clear persisted cache
  clearPersistedEmbeddingCache().catch(e => console.error('Failed to clear persisted cache:', e));
};

// ============================================
// Tool Definitions (JSON Schema)
// ============================================

const toolDefinitions: Record<string, ToolDefinition> = {
  get_current_time: {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date and time. Useful for time-sensitive questions or when the user asks about the current time.',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'IANA timezone name (e.g., "America/New_York", "Europe/London"). Defaults to user\'s local timezone.'
          },
          format: {
            type: 'string',
            description: 'Output format: "full" (default), "date", "time", or "iso"',
            enum: ['full', 'date', 'time', 'iso']
          }
        }
      }
    }
  },
  
  calculate: {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations. Supports basic arithmetic (+, -, *, /), percentages (%), exponentiation (^), and parentheses.',
      parameters: {
        type: 'object',
        required: ['expression'],
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate (e.g., "2 + 2", "15% of 200", "(3 + 4) * 5", "2^10")'
          }
        }
      }
    }
  },
  
  random_number: {
    type: 'function',
    function: {
      name: 'random_number',
      description: 'Generate a random number within a specified range.',
      parameters: {
        type: 'object',
        properties: {
          min: {
            type: 'number',
            description: 'Minimum value (inclusive). Defaults to 0.'
          },
          max: {
            type: 'number',
            description: 'Maximum value (exclusive for integers, inclusive for floats). Defaults to 100.'
          },
          integer: {
            type: 'boolean',
            description: 'Whether to return an integer. Defaults to true.'
          }
        }
      }
    }
  },
  
  fetch_url: {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch content from a URL. Returns text content (HTML stripped to plain text) or JSON. Useful for getting current information from web pages or APIs.',
      parameters: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch (must start with http:// or https://)'
          }
        }
      }
    }
  },
  
  encode_text: {
    type: 'function',
    function: {
      name: 'encode_text',
      description: 'Encode or decode text using Base64 or URL encoding.',
      parameters: {
        type: 'object',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            description: 'The text to encode or decode'
          },
          method: {
            type: 'string',
            description: 'Encoding method: "base64" (default) or "url"',
            enum: ['base64', 'url']
          },
          action: {
            type: 'string',
            description: 'Action to perform: "encode" (default) or "decode"',
            enum: ['encode', 'decode']
          }
        }
      }
    }
  },
  
  generate_uuid: {
    type: 'function',
    function: {
      name: 'generate_uuid',
      description: 'Generate a random UUID (Universally Unique Identifier) v4.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  
  web_search: {
    type: 'function',
    function: {
      name: 'web_search',
      description: `Search the PUBLIC WEB for current information using Tavily AI or DuckDuckGo.

**WHEN TO USE:**
- Current events, news, recent developments
- Product information, prices, specifications
- Facts that may have changed recently
- Information you're uncertain about
- Questions starting with "What is the latest...", "Current...", "Recent..."

**WHEN NOT TO USE:**
- User's personal documents (use rag_search instead)
- Basic knowledge you're confident about
- Coding syntax or language features (answer directly)
- Creative writing tasks

**TIP:** Be specific in queries. Include product names, dates, or key terms.`,
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific and include relevant keywords for better results.'
          },
          search_depth: {
            type: 'string',
            description: 'Search depth (Tavily only): "basic" (faster) or "advanced" (more comprehensive). Defaults to "basic".',
            enum: ['basic', 'advanced']
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results (Tavily only, 1-10). Defaults to 5.'
          }
        }
      }
    }
  },
  
  tavily_extract: {
    type: 'function',
    function: {
      name: 'tavily_extract',
      description: `Extract clean, structured content from web pages using Tavily AI-powered extraction.

**WHEN TO USE:**
- User provides a URL and asks to read/summarize it
- Need to analyze content from a specific webpage
- Reading documentation, articles, or blog posts from URLs
- User says "read this", "summarize this page", "what does this article say"

**WHEN NOT TO USE:**
- Searching for information (use web_search first to find URLs)
- User's uploaded documents (use rag_search)
- No Tavily API key configured (will fail)

**OUTPUT:** Clean markdown with ads/navigation removed. Better than fetch_url for articles.`,
      parameters: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URL or list of URLs to extract content from (max 20). Can also be a single URL string.'
          },
          include_images: {
            type: 'boolean',
            description: 'Include extracted image URLs in the response. Defaults to false.'
          },
          extract_depth: {
            type: 'string',
            description: 'Extraction depth: "basic" (faster, default) or "advanced" (higher success rate, more content, but slower and uses more credits).',
            enum: ['basic', 'advanced']
          },
          format: {
            type: 'string',
            description: 'Output format for extracted content: "markdown" (default) or "text" (plain text).',
            enum: ['markdown', 'text']
          }
        }
      }
    }
  },
  
  text_stats: {
    type: 'function',
    function: {
      name: 'text_stats',
      description: 'Analyze text and return statistics including character count, word count, line count, sentence count, and paragraph count.',
      parameters: {
        type: 'object',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            description: 'The text to analyze'
          }
        }
      }
    }
  },
  
  rag_search: {
    type: 'function',
    function: {
      name: 'rag_search',
      description: `Search through the USER'S PERSONAL knowledge base using Enhanced Neurosymbolic AI.

**WHEN TO USE (ALWAYS use this FIRST for these):**
- User asks about "my documents", "my files", "my notes"
- Questions about uploaded content: bank statements, receipts, invoices, reports
- References to "the document", "the file I uploaded", "my data"
- Any question about personal/private information the user has added
- User says "search my...", "find in my...", "look up in my..."

**WHEN NOT TO USE:**
- General knowledge questions (use your knowledge or web_search)
- Current events or news (use web_search)
- Coding help or explanations (answer directly)
- Questions that don't reference user's personal data

**CAPABILITIES:** Neural embeddings + symbolic reasoning, entity matching, BM25, query expansion, context-aware rewriting.`,
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Describe what you\'re looking for. Complex queries like "compare X to Y" or "find expenses in January" are supported. Pronouns like "it", "the document" will be resolved from conversation context.'
          },
          top_k: {
            type: 'number',
            description: 'Number of top results to return (1-10). Defaults to 5.'
          },
          threshold: {
            type: 'number',
            description: 'Minimum score threshold (0-1). Lower = more results. Defaults to 0.1.'
          },
          hybrid: {
            type: 'boolean',
            description: 'Use hybrid neurosymbolic search (true) or pure semantic search (false). Defaults to true.'
          },
          enhanced: {
            type: 'boolean',
            description: 'Use enhanced search with BM25, RRF fusion, MMR diversity, and query expansion (true) or basic hybrid search (false). Defaults to true.'
          },
          show_reasoning: {
            type: 'boolean',
            description: 'Show the reasoning chain explaining how results were found. Defaults to false.'
          },
          use_hyde: {
            type: 'boolean',
            description: 'Use HyDE (Hypothetical Document Embedding) - generates an ideal answer and embeds that instead of the query. Better for vague queries. Requires utility model. Defaults to false.'
          },
          conversation_context: {
            type: 'array',
            description: 'Recent conversation messages for context-aware query rewriting. Pass the last 4-6 messages to resolve pronouns like "it", "the document", etc.'
          }
        }
      }
    }
  }
};

// ============================================
// Tool Registry
// ============================================

const toolHandlers: Record<string, ToolHandler> = {
  get_current_time: getCurrentTime,
  calculate: calculate,
  random_number: randomNumber,
  fetch_url: fetchUrl,
  encode_text: encodeText,
  generate_uuid: generateUuid,
  web_search: webSearch,
  tavily_extract: tavilyExtract,
  text_stats: textStats,
  rag_search: ragSearch
};

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  
  constructor() {
    // Register all built-in tools
    for (const [name, definition] of Object.entries(toolDefinitions)) {
      const handler = toolHandlers[name] as ToolHandler | undefined;
      if (handler) {
        this.tools.set(name, {
          definition,
          handler,
          enabled: true // All tools enabled by default
        });
      }
    }
  }
  
  /**
   * Get all registered tools
   */
  getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get only enabled tools
   */
  getEnabledTools(): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(t => t.enabled);
  }
  
  /**
   * Get tool definitions for enabled tools (to send to Ollama)
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.getEnabledTools().map(t => t.definition);
  }
  
  /**
   * Enable or disable a tool
   */
  setToolEnabled(name: string, enabled: boolean): boolean {
    const tool = this.tools.get(name);
    if (tool) {
      tool.enabled = enabled;
      return true;
    }
    return false;
  }
  
  /**
   * Check if a tool is enabled
   */
  isToolEnabled(name: string): boolean {
    return this.tools.get(name)?.enabled ?? false;
  }
  
  /**
   * Execute a tool call
   */
  async executeTool(call: ToolCall): Promise<string> {
    const toolName = call.function.name;
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      return `Error: Unknown tool "${toolName}"`;
    }
    
    if (!tool.enabled) {
      return `Error: Tool "${toolName}" is disabled`;
    }
    
    try {
      const result = await tool.handler(call.function.arguments);
      return result;
    } catch (e) {
      return `Error executing tool "${toolName}": ${(e as Error).message}`;
    }
  }
  
  /**
   * Execute multiple tool calls (for parallel execution)
   */
  async executeToolCalls(calls: ToolCall[]): Promise<Array<{ name: string; result: string }>> {
    const results = await Promise.all(
      calls.map(async (call) => ({
        name: call.function.name,
        result: await this.executeTool(call)
      }))
    );
    return results;
  }
  
  /**
   * Register a custom tool
   */
  registerTool(definition: ToolDefinition, handler: ToolHandler, enabled = true): void {
    this.tools.set(definition.function.name, {
      definition,
      handler,
      enabled
    });
  }
  
  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
  
  /**
   * Get a specific tool by name
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Save enabled state to localStorage
   */
  saveState(): void {
    const state: Record<string, boolean> = {};
    for (const [name, tool] of this.tools) {
      state[name] = tool.enabled;
    }
    localStorage.setItem('nexus_tools_enabled', JSON.stringify(state));
  }
  
  /**
   * Load enabled state from localStorage
   */
  loadState(): void {
    try {
      const saved = localStorage.getItem('nexus_tools_enabled');
      if (saved) {
        const state = JSON.parse(saved) as Record<string, boolean>;
        for (const [name, enabled] of Object.entries(state)) {
          this.setToolEnabled(name, enabled);
        }
      }
    } catch {
      // Ignore errors, use defaults
    }
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();

// Initialize state from localStorage
toolRegistry.loadState();

// Export types and utilities
export { ToolRegistry };
export type { RegisteredTool };
