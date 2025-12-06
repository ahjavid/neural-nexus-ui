/**
 * Tool Registry and Built-in Tools for Ollama Tool Calling
 * 
 * This module provides:
 * - Tool definitions with JSON schema
 * - Tool handler implementations
 * - Registry for managing available tools
 */

import type { ToolDefinition, ToolHandler, RegisteredTool, ToolCall } from '../types';

// ============================================
// Configuration Store (for API keys)
// ============================================

interface ToolConfig {
  tavilyApiKey?: string;
  ollamaEndpoint: string;
  embeddingModel: string;
}

const getToolConfig = (): ToolConfig => {
  return {
    tavilyApiKey: localStorage.getItem('nexus_tavily_api_key') || undefined,
    ollamaEndpoint: localStorage.getItem('ollama_endpoint') || 'http://localhost:11434',
    embeddingModel: localStorage.getItem('nexus_embedding_model') || 'mxbai-embed-large:latest'
  };
};

export const setToolConfig = (key: keyof ToolConfig, value: string): void => {
  if (key === 'tavilyApiKey') {
    localStorage.setItem('nexus_tavily_api_key', value);
  } else if (key === 'embeddingModel') {
    localStorage.setItem('nexus_embedding_model', value);
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
 * Web search using DuckDuckGo Instant Answer API
 * No CORS proxy needed - DuckDuckGo API has proper CORS headers
 */
const webSearch: ToolHandler = async (args) => {
  const query = args.query as string;
  
  if (!query) {
    return 'Error: No search query provided';
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
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

/**
 * Tavily web search - high quality AI-optimized search
 */
const tavilySearch: ToolHandler = async (args) => {
  const query = args.query as string;
  const searchDepth = (args.search_depth as string) || 'basic';
  const maxResults = (args.max_results as number) || 5;
  
  if (!query) {
    return 'Error: No search query provided';
  }
  
  const config = getToolConfig();
  if (!config.tavilyApiKey) {
    return 'Error: Tavily API key not configured. Please add your API key in Settings → Tools section. Get a free key at https://tavily.com';
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
      const errorData = await response.text();
      if (response.status === 401) {
        return 'Error: Invalid Tavily API key. Please check your key in Settings.';
      }
      return `Error: Tavily API returned HTTP ${response.status}: ${errorData}`;
    }
    
    const data = await response.json();
    const results: string[] = [];
    
    // Add AI-generated answer if available
    if (data.answer) {
      results.push(`**Answer:** ${data.answer}\n`);
    }
    
    // Add search results
    if (data.results && data.results.length > 0) {
      results.push('**Sources:**');
      for (const result of data.results) {
        results.push(`\n**${result.title}**`);
        results.push(`URL: ${result.url}`);
        if (result.content) {
          results.push(`${result.content.slice(0, 300)}${result.content.length > 300 ? '...' : ''}`);
        }
        if (result.score) {
          results.push(`Relevance: ${(result.score * 100).toFixed(0)}%`);
        }
      }
    }
    
    if (results.length === 0) {
      return `No results found for "${query}".`;
    }
    
    return `Tavily Search results for "${query}":\n\n${results.join('\n')}`;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return 'Error: Search timed out';
    }
    return `Error searching Tavily: ${(e as Error).message}`;
  }
};

// ============================================
// RAG (Retrieval-Augmented Generation) Search
// ============================================

interface EmbeddingCache {
  entries: Map<string, { id: string; content: string; embedding: number[] }>;
  model: string;
  lastUpdated: number;
}

let embeddingCache: EmbeddingCache | null = null;

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

/**
 * Get embedding from Ollama
 */
const getEmbedding = async (text: string, model: string, endpoint: string): Promise<number[]> => {
  const response = await fetch(`${endpoint}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: text
    })
  });
  
  if (!response.ok) {
    throw new Error(`Embedding API returned HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.embedding;
};

/**
 * Load and embed knowledge base entries
 */
const loadKnowledgeBaseEmbeddings = async (): Promise<EmbeddingCache | null> => {
  const config = getToolConfig();
  
  // Load knowledge base from localStorage (same key as App.tsx)
  const storedKb = localStorage.getItem('nexus_knowledge_base');
  if (!storedKb) {
    return null;
  }
  
  let entries: Array<{ id: string; name: string; content: string }>;
  try {
    entries = JSON.parse(storedKb);
  } catch {
    return null;
  }
  
  if (!entries || entries.length === 0) {
    return null;
  }
  
  // Check if cache is still valid
  if (
    embeddingCache &&
    embeddingCache.model === config.embeddingModel &&
    embeddingCache.entries.size === entries.length
  ) {
    // Check if all entry IDs match
    const cachedIds = new Set(embeddingCache.entries.keys());
    const currentIds = new Set(entries.map(e => e.id));
    if ([...cachedIds].every(id => currentIds.has(id))) {
      return embeddingCache;
    }
  }
  
  // Embed all entries
  const cache: EmbeddingCache = {
    entries: new Map(),
    model: config.embeddingModel,
    lastUpdated: Date.now()
  };
  
  for (const entry of entries) {
    try {
      // Create searchable text from name and content
      const searchText = `${entry.name}\n\n${entry.content}`;
      const embedding = await getEmbedding(searchText, config.embeddingModel, config.ollamaEndpoint);
      cache.entries.set(entry.id, {
        id: entry.id,
        content: `**${entry.name}**\n${entry.content}`,
        embedding
      });
    } catch (e) {
      console.error(`Failed to embed entry ${entry.name}:`, e);
    }
  }
  
  embeddingCache = cache;
  return cache;
};

/**
 * RAG search using embeddings
 */
const ragSearch: ToolHandler = async (args) => {
  const query = args.query as string;
  const topK = (args.top_k as number) || 3;
  const threshold = (args.threshold as number) || 0.5;
  
  if (!query) {
    return 'Error: No search query provided';
  }
  
  const config = getToolConfig();
  
  try {
    // Load and embed knowledge base
    const cache = await loadKnowledgeBaseEmbeddings();
    
    if (!cache || cache.entries.size === 0) {
      return 'No documents found in knowledge base. Please add documents in the Knowledge Base section.';
    }
    
    // Get query embedding
    const queryEmbedding = await getEmbedding(query, config.embeddingModel, config.ollamaEndpoint);
    
    // Calculate similarities
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
    
    // Sort by score descending
    similarities.sort((a, b) => b.score - a.score);
    
    // Take top K
    const topResults = similarities.slice(0, topK);
    
    if (topResults.length === 0) {
      return `No relevant documents found for "${query}" (threshold: ${threshold}). Try lowering the threshold or adding more relevant documents.`;
    }
    
    // Format results
    const results: string[] = [
      `Found ${topResults.length} relevant document(s) for "${query}":\n`
    ];
    
    for (let i = 0; i < topResults.length; i++) {
      const result = topResults[i];
      results.push(`---\n**Document ${i + 1}** (Relevance: ${(result.score * 100).toFixed(1)}%)\n`);
      results.push(result.content);
      results.push('');
    }
    
    return results.join('\n');
  } catch (e) {
    if ((e as Error).message?.includes('HTTP')) {
      return `Error: Could not generate embeddings. Make sure the embedding model "${config.embeddingModel}" is available in Ollama.`;
    }
    return `Error performing RAG search: ${(e as Error).message}`;
  }
};

/**
 * Clear embedding cache (call when knowledge base changes)
 */
export const clearEmbeddingCache = (): void => {
  embeddingCache = null;
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
      description: 'Search the web using DuckDuckGo. Use this to find current information, news, product details, or any topic the user asks about. Returns top search results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific and include relevant keywords for better results.'
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
  
  tavily_search: {
    type: 'function',
    function: {
      name: 'tavily_search',
      description: 'Search the web using Tavily AI-powered search. Provides high-quality, AI-optimized search results with direct answers. Best for research, current events, and detailed information. Requires API key.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific for better results.'
          },
          search_depth: {
            type: 'string',
            description: 'Search depth: "basic" (faster) or "advanced" (more comprehensive). Defaults to "basic".',
            enum: ['basic', 'advanced']
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (1-10). Defaults to 5.'
          }
        }
      }
    }
  },
  
  rag_search: {
    type: 'function',
    function: {
      name: 'rag_search',
      description: 'Search through the knowledge base using semantic similarity (RAG). Uses AI embeddings to find relevant documents even if they don\'t contain the exact search terms. Best for searching local documents and notes.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Describe what you\'re looking for.'
          },
          top_k: {
            type: 'number',
            description: 'Number of top results to return (1-10). Defaults to 3.'
          },
          threshold: {
            type: 'number',
            description: 'Minimum similarity threshold (0-1). Lower values return more results. Defaults to 0.5.'
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
  text_stats: textStats,
  tavily_search: tavilySearch,
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
