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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NeuralNexusUI/1.0 (Tool Call)',
      }
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
  text_stats: textStats
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
