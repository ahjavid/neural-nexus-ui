/**
 * Pyodide Integration for Python Code Execution & Validation
 * 
 * ENHANCED VERSION with:
 * - Web Worker support (non-blocking execution)
 * - Interrupt/timeout support (cancellable execution)
 * - Custom stdout/stderr capture
 * - micropip package installation
 * - Loading progress callbacks
 * - Auto-detect imports
 * 
 * Uses Pyodide (WebAssembly) to run Python directly in the browser.
 * @see https://pyodide.org/
 */

// Pyodide CDN version - update as needed
const PYODIDE_VERSION = '0.27.0';
const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// ============================================
// TYPES
// ============================================

export interface PythonValidationResult {
  isValid: boolean;
  syntaxError?: {
    line: number;
    column: number;
    message: string;
    fullError: string;
  };
  runtimeError?: {
    type: string;
    message: string;
    traceback: string;
  };
  stdout: string;
  stderr: string;
}

export interface PythonExecutionResult {
  success: boolean;
  result?: unknown;
  stdout: string;
  stderr: string;
  error?: string;
  executionTime: number;
  interrupted?: boolean;
}

export interface CodeValidationOptions {
  testCases?: Array<{
    input: string;
    expectedOutput: string;
  }>;
  functionName?: string;
  timeout?: number;
  autoInstallPackages?: boolean;
}

export interface CodeValidationReport {
  syntaxValid: boolean;
  syntaxError?: string;
  executionValid: boolean;
  executionError?: string;
  testResults?: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error?: string;
  }>;
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}

export interface PyodideLoadingProgress {
  stage: 'downloading' | 'initializing' | 'loading-packages' | 'ready' | 'error';
  message: string;
  progress?: number; // 0-100
}

export type ProgressCallback = (progress: PyodideLoadingProgress) => void;
export type OutputCallback = (type: 'stdout' | 'stderr', content: string) => void;

// ============================================
// PYODIDE INTERFACE (Extended)
// ============================================

interface PyodideInterface {
  runPython: (code: string, options?: { globals?: unknown }) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (packages: string | string[], options?: {
    messageCallback?: (msg: string) => void;
    errorCallback?: (msg: string) => void;
    checkIntegrity?: boolean;
  }) => Promise<void>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  pyimport: (name: string) => any;
  globals: { get: (name: string) => unknown };
  setInterruptBuffer: (buffer: Int32Array) => void;
  checkInterrupt: () => void;
  setStdout: (options: { batched: (msg: string) => void }) => void;
  setStderr: (options: { batched: (msg: string) => void }) => void;
  version: string;
}

// ============================================
// STATE MANAGEMENT
// ============================================

// Main thread Pyodide instance (fallback when Worker unavailable)
let pyodideInstance: PyodideInterface | null = null;
let pyodideLoading: Promise<PyodideInterface> | null = null;

// Web Worker instance
let pyodideWorker: Worker | null = null;
let workerReady = false;
let pendingRequests: Map<string, {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  onProgress?: ProgressCallback;
  onOutput?: OutputCallback;
}> = new Map();

// Interrupt buffer for cancellation
let interruptBuffer: Int32Array | null = null;

// Output capture
let capturedStdout: string[] = [];
let capturedStderr: string[] = [];

// Progress callback
let globalProgressCallback: ProgressCallback | null = null;
let globalOutputCallback: OutputCallback | null = null;

// Track initialization state
let isInitialized = false;
let useWorker = true; // Try to use Web Worker by default

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(): string {
  return `pyodide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function supportsSharedArrayBuffer(): boolean {
  try {
    return typeof SharedArrayBuffer !== 'undefined';
  } catch {
    return false;
  }
}

function supportsWebWorker(): boolean {
  return typeof Worker !== 'undefined';
}

// ============================================
// WEB WORKER MANAGEMENT
// ============================================

/**
 * Initialize the Pyodide Web Worker
 */
async function initWorker(onProgress?: ProgressCallback): Promise<boolean> {
  if (!supportsWebWorker()) {
    console.log('[Pyodide] Web Workers not supported, using main thread');
    return false;
  }
  
  return new Promise((resolve) => {
    try {
      // Create worker from inline blob to avoid separate file issues with bundlers
      const workerCode = `
        // Pyodide Web Worker - Inline Version
        let pyodide = null;
        let interruptBuffer = null;
        let stdoutBuffer = [];
        let stderrBuffer = [];
        
        function respond(response) {
          self.postMessage(response);
        }
        
        async function initPyodide(indexURL) {
          try {
            respond({ id: 'init', type: 'progress', result: 'Loading Pyodide...' });
            
            const { loadPyodide } = await import(/* @vite-ignore */ indexURL + 'pyodide.mjs');
            
            respond({ id: 'init', type: 'progress', result: 'Initializing Python runtime...' });
            
            pyodide = await loadPyodide({
              indexURL,
              fullStdLib: false,
              stdout: (msg) => {
                stdoutBuffer.push(msg);
                respond({ id: 'output', type: 'output', stdout: msg });
              },
              stderr: (msg) => {
                stderrBuffer.push(msg);
                respond({ id: 'output', type: 'output', stderr: msg });
              }
            });
            
            // Setup interrupt buffer if SharedArrayBuffer available
            if (typeof SharedArrayBuffer !== 'undefined') {
              interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
              pyodide.setInterruptBuffer(interruptBuffer);
            }
            
            respond({ id: 'init', type: 'progress', result: 'Loading micropip...' });
            await pyodide.loadPackage('micropip');
            
            respond({ 
              id: 'init', 
              type: 'success', 
              result: { version: pyodide.version, ready: true, interruptBuffer: interruptBuffer?.buffer }
            });
            
            return true;
          } catch (error) {
            respond({ id: 'init', type: 'error', error: 'Failed to initialize: ' + error });
            return false;
          }
        }
        
        async function executePython(id, code, options = {}) {
          if (!pyodide) {
            respond({ id, type: 'error', error: 'Pyodide not initialized' });
            return;
          }
          
          stdoutBuffer = [];
          stderrBuffer = [];
          if (interruptBuffer) interruptBuffer[0] = 0;
          
          const startTime = performance.now();
          
          try {
            if (options.autoInstall) {
              respond({ id, type: 'progress', result: 'Detecting imports...' });
              await pyodide.loadPackagesFromImports(code);
            }
            
            let timeoutId = null;
            if (options.timeout && options.timeout > 0 && interruptBuffer) {
              timeoutId = setTimeout(() => {
                interruptBuffer[0] = 2;
              }, options.timeout);
            }
            
            const wrappedCode = \`
import sys
from io import StringIO

_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _captured_stdout = StringIO()
sys.stderr = _captured_stderr = StringIO()

_exec_result = None
_exec_error = None

try:
    exec(\${JSON.stringify(code)})
except KeyboardInterrupt:
    _exec_error = {"type": "KeyboardInterrupt", "message": "Execution interrupted", "traceback": ""}
except Exception as e:
    import traceback
    _exec_error = {
        "type": type(e).__name__,
        "message": str(e),
        "traceback": traceback.format_exc()
    }
finally:
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr

{
    "stdout": _captured_stdout.getvalue(),
    "stderr": _captured_stderr.getvalue(),
    "error": _exec_error
}
\`;
            
            const result = pyodide.runPython(wrappedCode);
            if (timeoutId) clearTimeout(timeoutId);
            
            const executionTime = performance.now() - startTime;
            
            respond({
              id,
              type: result.error ? 'error' : 'success',
              result: { executionTime, stdout: result.stdout, stderr: result.stderr },
              error: result.error ? result.error.type + ': ' + result.error.message : undefined,
              stdout: result.stdout,
              stderr: result.stderr
            });
          } catch (error) {
            const executionTime = performance.now() - startTime;
            respond({
              id,
              type: 'error',
              error: String(error),
              result: { executionTime, stdout: stdoutBuffer.join(''), stderr: stderrBuffer.join('') }
            });
          }
        }
        
        async function validateSyntax(id, code) {
          if (!pyodide) {
            respond({ id, type: 'error', error: 'Pyodide not initialized' });
            return;
          }
          
          try {
            // Use JSON to safely pass the code and return structured result
            const codeJson = JSON.stringify(code);
            const result = pyodide.runPython(\`
import ast
import json

_code = json.loads('\${codeJson.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'")}')
_result = {"valid": True, "error": None}
try:
    ast.parse(_code)
except SyntaxError as e:
    _result = {
        "valid": False,
        "error": {
            "line": e.lineno if e.lineno else 1,
            "column": e.offset if e.offset else 0,
            "message": e.msg if hasattr(e, 'msg') else str(e),
            "full_error": str(e)
        }
    }
json.dumps(_result)
\`);
            
            // Parse the JSON result string
            const parsed = JSON.parse(result);
            
            respond({
              id,
              type: 'success',
              result: {
                isValid: parsed.valid,
                syntaxError: parsed.error ? {
                  line: parsed.error.line,
                  column: parsed.error.column,
                  message: parsed.error.message,
                  fullError: parsed.error.full_error
                } : undefined
              }
            });
          } catch (error) {
            // Return syntax error as a result, not as a worker error
            respond({
              id,
              type: 'success',
              result: {
                isValid: false,
                syntaxError: {
                  line: 1,
                  column: 0,
                  message: 'Validation error: ' + String(error),
                  fullError: String(error)
                }
              }
            });
          }
        }
        
        async function installPackages(id, packages) {
          if (!pyodide) {
            respond({ id, type: 'error', error: 'Pyodide not initialized' });
            return;
          }
          
          try {
            const micropip = pyodide.pyimport('micropip');
            for (const pkg of packages) {
              respond({ id, type: 'progress', result: 'Installing ' + pkg + '...' });
              await micropip.install(pkg);
            }
            respond({ id, type: 'success', result: { installed: packages } });
          } catch (error) {
            respond({ id, type: 'error', error: 'Package installation failed: ' + error });
          }
        }
        
        function handleInterrupt(id) {
          if (interruptBuffer) {
            interruptBuffer[0] = 2;
            respond({ id, type: 'success', result: 'Interrupt signal sent' });
          } else {
            respond({ id, type: 'error', error: 'Interrupt buffer not available' });
          }
        }
        
        self.onmessage = async (event) => {
          const { id, type, payload } = event.data;
          
          switch (type) {
            case 'init':
              await initPyodide(payload.indexURL);
              break;
            case 'execute':
              await executePython(id, payload.code, payload.options);
              break;
            case 'validate':
              await validateSyntax(id, payload.code);
              break;
            case 'install':
              await installPackages(id, payload.packages);
              break;
            case 'interrupt':
              handleInterrupt(id);
              break;
            case 'status':
              respond({
                id,
                type: 'success',
                result: { initialized: pyodide !== null, version: pyodide?.version }
              });
              break;
            default:
              respond({ id, type: 'error', error: 'Unknown message type: ' + type });
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      pyodideWorker = new Worker(workerUrl, { type: 'module' });
      
      // Handle worker messages
      pyodideWorker.onmessage = (event) => {
        const { id, type, result, error, stdout, stderr } = event.data;
        
        // Handle output streaming
        if (type === 'output') {
          const request = pendingRequests.get(id);
          if (request?.onOutput) {
            if (stdout) request.onOutput('stdout', stdout);
            if (stderr) request.onOutput('stderr', stderr);
          }
          if (globalOutputCallback) {
            if (stdout) globalOutputCallback('stdout', stdout);
            if (stderr) globalOutputCallback('stderr', stderr);
          }
          return;
        }
        
        // Handle progress
        if (type === 'progress') {
          const request = pendingRequests.get(id);
          if (request?.onProgress) {
            request.onProgress({
              stage: 'initializing',
              message: result
            });
          }
          if (onProgress) {
            onProgress({
              stage: 'initializing',
              message: result
            });
          }
          return;
        }
        
        // Handle init completion
        if (id === 'init') {
          if (type === 'success') {
            workerReady = true;
            isInitialized = true;
            // Store interrupt buffer reference if available
            if (result.interruptBuffer) {
              interruptBuffer = new Int32Array(result.interruptBuffer);
            }
            console.log(`[Pyodide Worker] Ready, version ${result.version}`);
            resolve(true);
          } else if (type === 'error') {
            console.error('[Pyodide Worker] Init failed:', error);
            resolve(false);
          }
          return;
        }
        
        // Handle regular requests
        const request = pendingRequests.get(id);
        if (request) {
          pendingRequests.delete(id);
          if (type === 'success') {
            request.resolve({ ...result, stdout, stderr });
          } else {
            request.reject(new Error(error || 'Unknown error'));
          }
        }
      };
      
      pyodideWorker.onerror = (error) => {
        console.error('[Pyodide Worker] Error:', error);
        resolve(false);
      };
      
      // Send init message
      pyodideWorker.postMessage({
        id: 'init',
        type: 'init',
        payload: { indexURL: PYODIDE_CDN_URL }
      });
      
      // Timeout for init
      setTimeout(() => {
        if (!workerReady) {
          console.warn('[Pyodide Worker] Init timeout, falling back to main thread');
          resolve(false);
        }
      }, 30000);
      
    } catch (error) {
      console.error('[Pyodide Worker] Failed to create:', error);
      resolve(false);
    }
  });
}

/**
 * Send a message to the worker and wait for response
 */
function sendWorkerMessage<T>(
  type: string,
  payload: any,
  onProgress?: ProgressCallback,
  onOutput?: OutputCallback
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!pyodideWorker || !workerReady) {
      reject(new Error('Worker not ready'));
      return;
    }
    
    const id = generateId();
    pendingRequests.set(id, { resolve, reject, onProgress, onOutput });
    
    pyodideWorker.postMessage({ id, type, payload });
  });
}

// ============================================
// MAIN THREAD FALLBACK
// ============================================

/**
 * Load Pyodide on main thread (fallback when Worker unavailable)
 */
async function loadPyodideMainThread(onProgress?: ProgressCallback): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoading) return pyodideLoading;
  
  pyodideLoading = (async () => {
    try {
      onProgress?.({ stage: 'downloading', message: 'Loading Pyodide...' });
      
      const { loadPyodide } = await import(
        /* @vite-ignore */
        `${PYODIDE_CDN_URL}pyodide.mjs`
      );
      
      onProgress?.({ stage: 'initializing', message: 'Initializing Python runtime...' });
      
      // Setup output capture
      capturedStdout = [];
      capturedStderr = [];
      
      const pyodide = await loadPyodide({
        indexURL: PYODIDE_CDN_URL,
        fullStdLib: false,
        stdout: (msg: string) => {
          capturedStdout.push(msg);
          globalOutputCallback?.('stdout', msg);
        },
        stderr: (msg: string) => {
          capturedStderr.push(msg);
          globalOutputCallback?.('stderr', msg);
        }
      });
      
      // Setup interrupt buffer if SharedArrayBuffer available
      if (supportsSharedArrayBuffer()) {
        interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
        pyodide.setInterruptBuffer(interruptBuffer);
      }
      
      onProgress?.({ stage: 'loading-packages', message: 'Loading micropip...' });
      await pyodide.loadPackage('micropip');
      
      pyodideInstance = pyodide as PyodideInterface;
      isInitialized = true;
      
      onProgress?.({ stage: 'ready', message: `Pyodide ${pyodide.version} ready` });
      console.log(`[Pyodide Main] Loaded version ${pyodide.version}`);
      
      return pyodideInstance;
    } catch (error) {
      pyodideLoading = null;
      onProgress?.({ stage: 'error', message: `Failed: ${error}` });
      throw new Error(`Failed to load Pyodide: ${error}`);
    }
  })();
  
  return pyodideLoading;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Load Pyodide (tries Worker first, falls back to main thread)
 */
export async function loadPyodideInstance(
  onProgress?: ProgressCallback
): Promise<{ ready: boolean; useWorker: boolean; version?: string }> {
  globalProgressCallback = onProgress || null;
  
  // Try Web Worker first
  if (useWorker && supportsWebWorker()) {
    onProgress?.({ stage: 'downloading', message: 'Initializing Web Worker...' });
    const workerSuccess = await initWorker(onProgress);
    
    if (workerSuccess) {
      return { ready: true, useWorker: true };
    }
    
    // Worker failed, fall back to main thread
    useWorker = false;
  }
  
  // Fall back to main thread
  try {
    const pyodide = await loadPyodideMainThread(onProgress);
    return { ready: true, useWorker: false, version: pyodide.version };
  } catch (error) {
    return { ready: false, useWorker: false };
  }
}

/**
 * Check if Pyodide is loaded and ready
 */
export function isPyodideReady(): boolean {
  return isInitialized && (workerReady || pyodideInstance !== null);
}

/**
 * Set global output callback for real-time stdout/stderr
 */
export function setOutputCallback(callback: OutputCallback | null): void {
  globalOutputCallback = callback;
}

/**
 * Set global progress callback
 */
export function setProgressCallback(callback: ProgressCallback | null): void {
  globalProgressCallback = callback;
  // Also used internally for progress reporting
  void globalProgressCallback;
}

/**
 * Interrupt current Python execution
 */
export function interruptExecution(): boolean {
  if (workerReady && pyodideWorker) {
    sendWorkerMessage('interrupt', {}).catch(() => {});
    return true;
  }
  
  if (interruptBuffer) {
    interruptBuffer[0] = 2; // SIGINT
    return true;
  }
  
  return false;
}

/**
 * Validate Python code for syntax errors without executing
 */
export async function validatePythonSyntax(code: string): Promise<PythonValidationResult> {
  // Use worker if available
  if (workerReady && pyodideWorker) {
    try {
      const result = await sendWorkerMessage<{
        isValid: boolean;
        syntaxError?: {
          line: number;
          column: number;
          message: string;
          fullError: string;
        };
      }>('validate', { code });
      
      return {
        isValid: result.isValid,
        syntaxError: result.syntaxError,
        stdout: '',
        stderr: ''
      };
    } catch (error) {
      return {
        isValid: false,
        runtimeError: {
          type: 'WorkerError',
          message: String(error),
          traceback: ''
        },
        stdout: '',
        stderr: ''
      };
    }
  }
  
  // Fall back to main thread
  const pyodide = await loadPyodideMainThread();
  
  try {
    const codeJson = JSON.stringify(code);
    const validationCode = `
import ast
import json

_code = json.loads('${codeJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')
_result = {"valid": True, "error": None}
try:
    ast.parse(_code)
except SyntaxError as e:
    _result = {
        "valid": False,
        "error": {
            "line": e.lineno if e.lineno else 1,
            "column": e.offset if e.offset else 0,
            "message": e.msg if hasattr(e, 'msg') else str(e),
            "full_error": str(e)
        }
    }
json.dumps(_result)
`;
    
    const resultJson = pyodide.runPython(validationCode) as string;
    const result = JSON.parse(resultJson) as {
      valid: boolean;
      error?: {
        line: number;
        column: number;
        message: string;
        full_error: string;
      };
    };
    
    return {
      isValid: result.valid,
      syntaxError: result.error ? {
        line: result.error.line,
        column: result.error.column,
        message: result.error.message,
        fullError: result.error.full_error
      } : undefined,
      stdout: '',
      stderr: ''
    };
  } catch (error) {
    return {
      isValid: false,
      runtimeError: {
        type: 'ValidationError',
        message: String(error),
        traceback: ''
      },
      stdout: '',
      stderr: ''
    };
  }
}

/**
 * Execute Python code with timeout and output capture
 */
export async function executePythonCode(
  code: string,
  options: {
    timeout?: number;
    autoInstallPackages?: boolean;
    onProgress?: ProgressCallback;
    onOutput?: OutputCallback;
  } = {}
): Promise<PythonExecutionResult> {
  const startTime = performance.now();
  
  // Use worker if available
  if (workerReady && pyodideWorker) {
    try {
      const result = await sendWorkerMessage<{
        executionTime: number;
        stdout: string;
        stderr: string;
        value?: unknown;
      }>('execute', {
        code,
        options: {
          timeout: options.timeout,
          autoInstall: options.autoInstallPackages,
          captureOutput: true
        }
      }, options.onProgress, options.onOutput);
      
      return {
        success: true,
        result: result.value,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        executionTime: result.executionTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stdout: '',
        stderr: '',
        error: errorMessage,
        executionTime: performance.now() - startTime,
        interrupted: errorMessage.includes('interrupt') || errorMessage.includes('KeyboardInterrupt')
      };
    }
  }
  
  // Fall back to main thread
  const pyodide = await loadPyodideMainThread();
  capturedStdout = [];
  capturedStderr = [];
  
  // Clear interrupt buffer
  if (interruptBuffer) {
    interruptBuffer[0] = 0;
  }
  
  // Setup timeout
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (options.timeout && options.timeout > 0 && interruptBuffer) {
    timeoutId = setTimeout(() => {
      interruptBuffer![0] = 2;
    }, options.timeout);
  }
  
  try {
    // Auto-install packages if requested
    if (options.autoInstallPackages) {
      options.onProgress?.({ stage: 'loading-packages', message: 'Detecting imports...' });
      await pyodide.loadPackagesFromImports(code);
    }
    
    const executionCode = `
import sys
from io import StringIO

_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _captured_stdout = StringIO()
sys.stderr = _captured_stderr = StringIO()

_exec_result = None
_exec_error = None

try:
    exec(${JSON.stringify(code)})
except KeyboardInterrupt:
    _exec_error = {"type": "KeyboardInterrupt", "message": "Execution interrupted", "traceback": ""}
except Exception as e:
    import traceback
    _exec_error = {
        "type": type(e).__name__,
        "message": str(e),
        "traceback": traceback.format_exc()
    }
finally:
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr

{
    "stdout": _captured_stdout.getvalue(),
    "stderr": _captured_stderr.getvalue(),
    "error": _exec_error
}
`;
    
    const result = pyodide.runPython(executionCode) as {
      stdout: string;
      stderr: string;
      error?: { type: string; message: string; traceback: string };
    };
    
    if (timeoutId) clearTimeout(timeoutId);
    
    const executionTime = performance.now() - startTime;
    
    if (result.error) {
      return {
        success: false,
        stdout: result.stdout,
        stderr: result.stderr,
        error: `${result.error.type}: ${result.error.message}`,
        executionTime,
        interrupted: result.error.type === 'KeyboardInterrupt'
      };
    }
    
    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      executionTime
    };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    return {
      success: false,
      stdout: capturedStdout.join(''),
      stderr: capturedStderr.join(''),
      error: String(error),
      executionTime: performance.now() - startTime
    };
  }
}

/**
 * Execute Python code and get the return value of an expression
 */
export async function executePythonExpression(
  code: string,
  expression: string,
  _options: {
    timeout?: number;
    autoInstallPackages?: boolean;
  } = {}
): Promise<PythonExecutionResult> {
  const pyodide = await loadPyodideMainThread();
  
  const startTime = performance.now();
  
  try {
    // First execute the code to define functions/variables
    const setupCode = `
import sys
from io import StringIO

_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _captured_stdout = StringIO()
sys.stderr = _captured_stderr = StringIO()

_exec_error = None

try:
    exec(${JSON.stringify(code)})
except Exception as e:
    import traceback
    _exec_error = {
        "type": type(e).__name__,
        "message": str(e),
        "traceback": traceback.format_exc()
    }

{
    "stdout": _captured_stdout.getvalue(),
    "stderr": _captured_stderr.getvalue(),
    "error": _exec_error
}
`;
    
    const setupResult = pyodide.runPython(setupCode) as {
      stdout: string;
      stderr: string;
      error?: {
        type: string;
        message: string;
        traceback: string;
      };
    };
    
    if (setupResult.error) {
      const executionTime = performance.now() - startTime;
      return {
        success: false,
        stdout: setupResult.stdout,
        stderr: setupResult.stderr,
        error: `${setupResult.error.type}: ${setupResult.error.message}`,
        executionTime,
      };
    }
    
    // Now evaluate the expression
    const evalCode = `
_eval_result = None
_eval_error = None

try:
    _eval_result = eval(${JSON.stringify(expression)})
except Exception as e:
    import traceback
    _eval_error = {
        "type": type(e).__name__,
        "message": str(e),
        "traceback": traceback.format_exc()
    }

# Restore stdout/stderr
sys.stdout = _old_stdout
sys.stderr = _old_stderr

{
    "result": repr(_eval_result) if _eval_result is not None else None,
    "stdout": _captured_stdout.getvalue(),
    "stderr": _captured_stderr.getvalue(),
    "error": _eval_error
}
`;
    
    const evalResult = pyodide.runPython(evalCode) as {
      result: string | null;
      stdout: string;
      stderr: string;
      error?: {
        type: string;
        message: string;
        traceback: string;
      };
    };
    
    const executionTime = performance.now() - startTime;
    
    if (evalResult.error) {
      return {
        success: false,
        stdout: evalResult.stdout,
        stderr: evalResult.stderr,
        error: `${evalResult.error.type}: ${evalResult.error.message}`,
        executionTime,
      };
    }
    
    return {
      success: true,
      result: evalResult.result,
      stdout: evalResult.stdout,
      stderr: evalResult.stderr,
      executionTime,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: String(error),
      executionTime,
    };
  }
}

/**
 * Test a Python function with specific inputs
 */
export async function testPythonFunction(
  code: string,
  functionCall: string,
  options: { timeout?: number } = {}
): Promise<{
  success: boolean;
  actualOutput: string;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  const testCode = `${code}
__test_result__ = repr(${functionCall})
print(__test_result__)
`;
  
  const result = await executePythonCode(testCode, options);
  
  return {
    success: result.success,
    actualOutput: result.stdout.trim(),
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error
  };
}

/**
 * Install Python packages via micropip
 */
export async function installPackages(
  packages: string[],
  onProgress?: ProgressCallback
): Promise<{ success: boolean; installed: string[]; error?: string }> {
  // Use worker if available
  if (workerReady && pyodideWorker) {
    try {
      const result = await sendWorkerMessage<{ installed: string[] }>(
        'install',
        { packages },
        onProgress
      );
      return { success: true, installed: result.installed };
    } catch (error) {
      return { success: false, installed: [], error: String(error) };
    }
  }
  
  // Fall back to main thread
  const pyodide = await loadPyodideMainThread();
  
  try {
    const micropip = pyodide.pyimport('micropip');
    
    for (const pkg of packages) {
      onProgress?.({ stage: 'loading-packages', message: `Installing ${pkg}...` });
      await micropip.install(pkg);
    }
    
    return { success: true, installed: packages };
  } catch (error) {
    return { success: false, installed: [], error: String(error) };
  }
}

/**
 * Comprehensive code validation with test cases
 */
export interface CodeValidationOptions {
  testCases?: Array<{
    input: string;
    expectedOutput: string;
  }>;
  functionName?: string;
  timeout?: number;
  autoInstallPackages?: boolean;
}

export interface CodeValidationReport {
  syntaxValid: boolean;
  syntaxError?: string;
  executionValid: boolean;
  executionError?: string;
  testResults?: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error?: string;
  }>;
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}

/**
 * Validate Python code comprehensively
 */
export async function validatePythonCode(
  code: string,
  options: CodeValidationOptions = {}
): Promise<CodeValidationReport> {
  const report: CodeValidationReport = {
    syntaxValid: false,
    executionValid: false,
    summary: { passed: 0, failed: 0, total: 0 }
  };
  
  // Step 1: Syntax validation
  const syntaxResult = await validatePythonSyntax(code);
  report.syntaxValid = syntaxResult.isValid;
  
  if (!syntaxResult.isValid) {
    report.syntaxError = syntaxResult.syntaxError
      ? `Line ${syntaxResult.syntaxError.line}: ${syntaxResult.syntaxError.message}`
      : syntaxResult.runtimeError?.message || 'Unknown syntax error';
    return report;
  }
  
  // Step 2: Basic execution test
  const execResult = await executePythonCode(code, {
    timeout: options.timeout || 5000,
    autoInstallPackages: options.autoInstallPackages
  });
  report.executionValid = execResult.success;
  
  if (!execResult.success) {
    report.executionError = execResult.error;
    return report;
  }
  
  // Step 3: Test case execution
  if (options.testCases && options.testCases.length > 0) {
    report.testResults = [];
    
    for (const testCase of options.testCases) {
      const funcCall = options.functionName
        ? `${options.functionName}(${testCase.input})`
        : testCase.input;
      
      const testResult = await testPythonFunction(code, funcCall, {
        timeout: options.timeout || 5000
      });
      
      const actualNormalized = testResult.actualOutput.trim();
      const expectedNormalized = testCase.expectedOutput.trim();
      const passed = testResult.success && actualNormalized === expectedNormalized;
      
      report.testResults.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: testResult.actualOutput,
        passed,
        error: testResult.error
      });
      
      if (passed) {
        report.summary.passed++;
      } else {
        report.summary.failed++;
      }
      report.summary.total++;
    }
  }
  
  return report;
}

/**
 * Quick syntax check - just returns true/false
 */
export async function isPythonSyntaxValid(code: string): Promise<boolean> {
  const result = await validatePythonSyntax(code);
  return result.isValid;
}

/**
 * Detect language from code string
 */
export function detectCodeLanguage(code: string): 'python' | 'javascript' | 'typescript' | 'unknown' {
  // Python indicators
  const pythonIndicators = [
    /^def\s+\w+\s*\(/m,           // def function(
    /^class\s+\w+/m,              // class Name
    /^import\s+\w+/m,             // import module
    /^from\s+\w+\s+import/m,      // from module import
    /:\s*$/m,                     // lines ending with :
    /^\s*elif\s+/m,               // elif
    /print\s*\(/,                 // print(
    /__init__/,                   // __init__
    /self\./,                     // self.
    /^\s*#.*$/m,                  // # comments
  ];
  
  // JavaScript/TypeScript indicators
  const jsIndicators = [
    /^function\s+\w+\s*\(/m,      // function name(
    /^const\s+\w+\s*=/m,          // const x =
    /^let\s+\w+\s*=/m,            // let x =
    /^var\s+\w+\s*=/m,            // var x =
    /=>\s*{/,                     // arrow functions
    /console\.log\(/,             // console.log(
    /^\s*\/\//m,                  // // comments
    /^\s*\/\*/m,                  // /* comments
  ];
  
  // TypeScript-specific
  const tsIndicators = [
    /:\s*(string|number|boolean|any|void)/,  // type annotations
    /interface\s+\w+/,                        // interface
    /<\w+>/,                                  // generics
  ];
  
  const pythonScore = pythonIndicators.filter(r => r.test(code)).length;
  const jsScore = jsIndicators.filter(r => r.test(code)).length;
  const tsScore = tsIndicators.filter(r => r.test(code)).length;
  
  if (tsScore >= 2) return 'typescript';
  if (pythonScore > jsScore) return 'python';
  if (jsScore > 0) return 'javascript';
  
  return 'unknown';
}

/**
 * Get Pyodide status information
 */
export function getPyodideStatus(): {
  ready: boolean;
  useWorker: boolean;
  interruptSupported: boolean;
  version?: string;
} {
  return {
    ready: isInitialized,
    useWorker: workerReady,
    interruptSupported: interruptBuffer !== null,
    version: pyodideInstance?.version
  };
}
