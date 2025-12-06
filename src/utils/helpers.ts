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
  num_ctx: 4096,
  seed: -1,
  mirostat: 0,
  mirostat_tau: 5.0,
  mirostat_eta: 0.1,
  num_gpu: -1,
  num_thread: 0
} as const;

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
