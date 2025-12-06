import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Settings, Cpu, Terminal, MessageSquare, Trash2, ChevronRight, 
  RefreshCw, Zap, Box, Copy, Check, AlertTriangle, Plus, Image as ImageIcon, 
  X, Square, Sliders, Mic, MicOff, Volume2, VolumeX, Download, Clock, 
  Keyboard, HelpCircle, FileText, DownloadCloud, Search, Hash, Command,
  Book, Edit2, Play, Eye, EyeOff, Brain, Phone, PhoneOff, Database,
  Layout, User, FileCode, PenTool, BarChart
} from 'lucide-react';

// --- Utility Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon, title }) => {
  const baseStyle = "flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:translate-y-0.5",
    secondary: "bg-[#27272a] hover:bg-[#3f3f46] text-gray-200 border border-gray-700",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5",
    icon: "p-2 bg-transparent hover:bg-white/10 text-gray-400 hover:text-white rounded-md",
    accent: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 hover:scale-105"
  };

  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={18} className={children ? "mr-2" : ""} />}
      {children}
    </button>
  );
};

// --- Code Block Component (extracted to avoid hook violations) ---
const CodeBlock = ({ code, language }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPreviewable = ['html', 'svg', 'xml'].includes(language);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-4 border border-gray-700 bg-[#0d1117] shadow-lg w-full">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700 text-xs text-gray-400 select-none">
        <div className="flex gap-2 items-center">
          <span className="uppercase font-mono font-bold text-indigo-400">{language || 'text'}</span>
          {isPreviewable && (
            <button onClick={() => setShowPreview(!showPreview)} className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${showPreview ? 'bg-indigo-500/20 text-indigo-300' : 'hover:text-white hover:bg-white/10'}`}>
              {showPreview ? <EyeOff size={12}/> : <Eye size={12}/>} {showPreview ? 'Code' : 'Preview'}
            </button>
          )}
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10">
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          <span className="text-[10px] uppercase tracking-wider">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      {showPreview ? (
        <div className="bg-white p-4 overflow-auto min-h-[100px] max-h-[400px]">
          <div dangerouslySetInnerHTML={{ __html: code }} />
        </div>
      ) : (
        <pre className="p-4 overflow-x-auto font-mono text-sm text-gray-300 custom-scrollbar max-h-[500px]">
          <code className="block">{code}</code>
        </pre>
      )}
    </div>
  );
};

// --- Inline text formatting ---
const formatInlineText = (text) => {
  if (!text) return null;
  
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g);
  
  return parts.map((part, idx) => {
    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="bg-gray-800 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-700/50">
          {part.slice(1, -1)}
        </code>
      );
    }
    
    // Process bold text
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return <strong key={`${idx}-${bIdx}`} className="text-white font-semibold">{bPart.slice(2, -2)}</strong>;
      }
      // Process italic
      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, iIdx) => {
        if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
          return <em key={`${idx}-${bIdx}-${iIdx}`} className="italic text-gray-300">{iPart.slice(1, -1)}</em>;
        }
        return iPart;
      });
    });
  });
};

// --- Custom Renderer with Artifacts & Reasoning ---
const MessageContent = ({ content }) => {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  
  if (!content) return null;

  // Extract thinking/reasoning blocks
  const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  const reasoning = thinkMatch ? thinkMatch[1].trim() : null;
  const cleanContent = content.replace(/<think>[\s\S]*?(<\/think>|$)/, '').trim();
  
  // Split content by code blocks
  const parts = cleanContent.split(/(```[\s\S]*?```)/g).filter(p => p);

  return (
    <div className="space-y-2 leading-relaxed break-words w-full text-[15px]">
      {/* Reasoning Block */}
      {reasoning && (
        <div className="mb-4 border border-purple-500/30 rounded-lg overflow-hidden bg-purple-950/20">
          <button 
            onClick={() => setReasoningOpen(!reasoningOpen)} 
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-900/20 hover:bg-purple-900/30 text-xs font-bold text-purple-300 uppercase tracking-wider transition-colors"
          >
            <Brain size={14} className="text-purple-400" /> 
            Thinking Process 
            <span className="ml-auto text-[10px] opacity-70 font-normal normal-case">
              {reasoningOpen ? '▼ Hide' : '▶ Show'}
            </span>
          </button>
          {reasoningOpen && (
            <div className="p-4 text-sm text-gray-400 font-mono bg-black/20 border-t border-purple-500/20 whitespace-pre-wrap leading-relaxed">
              {reasoning}
            </div>
          )}
        </div>
      )}
      
      {/* Main Content */}
      {parts.map((part, idx) => {
        // Code blocks
        if (part.startsWith('```')) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          const language = match ? match[1].toLowerCase() : '';
          const code = match ? match[2].trim() : part.slice(3, -3).trim();
          return <CodeBlock key={idx} code={code} language={language} />;
        }
        
        // Regular text - split by lines and render
        const lines = part.split('\n');
        return (
          <div key={idx} className="space-y-2">
            {lines.map((line, lineIdx) => {
              const trimmedLine = line.trim();
              
              // Empty line - small spacer
              if (!trimmedLine) {
                return <div key={lineIdx} className="h-1" />;
              }
              
              // Headers
              if (trimmedLine.startsWith('### ')) {
                return <h3 key={lineIdx} className="text-lg font-bold text-white mt-4 mb-2">{trimmedLine.slice(4)}</h3>;
              }
              if (trimmedLine.startsWith('## ')) {
                return <h2 key={lineIdx} className="text-xl font-bold text-white mt-4 mb-2">{trimmedLine.slice(3)}</h2>;
              }
              if (trimmedLine.startsWith('# ')) {
                return <h1 key={lineIdx} className="text-2xl font-bold text-white mt-4 mb-2">{trimmedLine.slice(2)}</h1>;
              }
              
              // Bullet points
              if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                return (
                  <div key={lineIdx} className="flex gap-2 ml-2">
                    <span className="text-indigo-400 mt-1">•</span>
                    <span className="text-gray-300 flex-1">{formatInlineText(trimmedLine.slice(2))}</span>
                  </div>
                );
              }
              
              // Numbered lists
              const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
              if (numberedMatch) {
                return (
                  <div key={lineIdx} className="flex gap-2 ml-2">
                    <span className="text-indigo-400 font-mono text-sm min-w-[1.5rem]">{numberedMatch[1]}.</span>
                    <span className="text-gray-300 flex-1">{formatInlineText(numberedMatch[2])}</span>
                  </div>
                );
              }
              
              // Regular paragraph
              return (
                <p key={lineIdx} className="text-gray-300 leading-relaxed">
                  {formatInlineText(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white transition-colors">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      <span className="text-[10px] uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
};

// --- Omni-Voice Overlay ---
const VoiceModeOverlay = ({ isOpen, onClose, isSpeaking, isListening, transcript, lastResponse, onEndCall, onStartListening, onStopListening }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="absolute top-6 right-6">
        <button onClick={onClose} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 text-white transition-all"><X size={24} /></button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-6 text-center space-y-12">
        <div className="relative">
          {/* Animated Visualizer */}
          <div className={`w-32 h-32 rounded-full blur-2xl absolute inset-0 transition-all duration-300 ${isSpeaking ? 'bg-indigo-500 animate-pulse scale-150' : isListening ? 'bg-purple-500 animate-pulse scale-125' : 'bg-gray-800'}`}></div>
          <div className="w-32 h-32 bg-black rounded-full border border-gray-700 relative z-10 flex items-center justify-center shadow-2xl">
             {isSpeaking ? <Volume2 size={40} className="text-indigo-400" /> : isListening ? <Mic size={40} className="text-purple-400 animate-pulse" /> : <Phone size={40} className="text-gray-500" />}
          </div>
        </div>

        <div className="space-y-4 min-h-[100px]">
          <h2 className="text-2xl font-light text-gray-200">
            {isSpeaking ? "Speaking..." : isListening ? "Listening..." : "Ready"}
          </h2>
          <p className="text-lg text-gray-400 font-medium leading-relaxed max-w-lg mx-auto">
            {isListening && transcript ? transcript : lastResponse ? lastResponse.slice(0, 150) + (lastResponse.length > 150 ? "..." : "") : "Tap the microphone or start speaking"}
          </p>
        </div>
        
        {/* Manual mic control */}
        <button 
          onClick={isListening ? onStopListening : onStartListening}
          className={`p-6 rounded-full transition-all ${isListening ? 'bg-purple-500 hover:bg-purple-600 scale-110' : 'bg-gray-800 hover:bg-gray-700'}`}
        >
          {isListening ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-gray-300" />}
        </button>
      </div>

      <div className="pb-12">
        <button onClick={onEndCall} className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-full text-red-400 font-medium flex items-center gap-3 transition-all hover:scale-105 active:scale-95">
          <PhoneOff size={20} /> End Call
        </button>
      </div>
    </div>
  );
};

// --- IndexedDB Storage Manager ---
// Provides ~50MB-unlimited storage vs localStorage's 5MB limit

const DB_NAME = 'neural-nexus-db';
const DB_VERSION = 1;

const dbManager = {
  db: null,
  
  async init() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Sessions store - each session is a separate entry for efficient updates
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        
        // Knowledge base store
        if (!db.objectStoreNames.contains('knowledge')) {
          db.createObjectStore('knowledge', { keyPath: 'id' });
        }
        
        // Settings store (key-value)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  },
  
  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async put(storeName, item) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async putAll(storeName, items) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      items.forEach(item => store.put(item));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  
  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  async clear(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  // Get storage estimate
  async getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
        percent: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(1) : 0
      };
    }
    return { used: 0, quota: 0, percent: 0 };
  }
};

// Storage helper functions
const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

// Migrate from localStorage to IndexedDB (one-time)
const migrateFromLocalStorage = async () => {
  try {
    const oldSessions = localStorage.getItem('ollama_sessions');
    const oldKnowledge = localStorage.getItem('ollama_knowledge');
    
    if (oldSessions) {
      const sessions = JSON.parse(oldSessions);
      await dbManager.putAll('sessions', sessions);
      localStorage.removeItem('ollama_sessions');
      console.log('Migrated sessions to IndexedDB');
    }
    
    if (oldKnowledge) {
      const knowledge = JSON.parse(oldKnowledge);
      await dbManager.putAll('knowledge', knowledge);
      localStorage.removeItem('ollama_knowledge');
      console.log('Migrated knowledge to IndexedDB');
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
};

// --- Main Application ---

export default function App() {
  // State: Core - Start with empty/default, load from IndexedDB async
  const [sessions, setSessions] = useState([{ id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() }]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [storageInfo, setStorageInfo] = useState({ used: 0, quota: 0, percent: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // State: Knowledge Base
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [activeKnowledgeIds, setActiveKnowledgeIds] = useState([]);

  // State: UI
  const [input, setInput] = useState('');
  const [models, setModels] = useState([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelMgrOpen, setModelMgrOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  // State: Features
  const [attachments, setAttachments] = useState([]); 
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [slashCmdsVisible, setSlashCmdsVisible] = useState(false);
  const [persona, setPersona] = useState('default');

  // State: Config - Use empty string to use Vite proxy, or full URL like http://localhost:11434 for direct
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem('ollama_endpoint') || '');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, expert AI assistant.');
  const [params, setParams] = useState({
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
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [pullProgress, setPullProgress] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastAssistantResponseRef = useRef('');
  const saveTimeoutRef = useRef(null);

  // --- Effects ---

  // Initialize: Load data from IndexedDB on mount
  useEffect(() => {
    const initStorage = async () => {
      try {
        await dbManager.init();
        
        // Migrate from localStorage if needed (one-time)
        await migrateFromLocalStorage();
        
        // Load sessions
        const savedSessions = await dbManager.getAll('sessions');
        if (savedSessions && savedSessions.length > 0) {
          // Sort by date descending
          savedSessions.sort((a, b) => (b.date || 0) - (a.date || 0));
          setSessions(savedSessions);
          setCurrentSessionId(savedSessions[0].id);
        } else {
          // Create default session
          const defaultSession = { id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() };
          setSessions([defaultSession]);
          setCurrentSessionId(defaultSession.id);
          await dbManager.put('sessions', defaultSession);
        }
        
        // Load knowledge base
        const savedKnowledge = await dbManager.getAll('knowledge');
        if (savedKnowledge) {
          setKnowledgeBase(savedKnowledge);
        }
        
        // Get storage info
        const info = await dbManager.getStorageEstimate();
        setStorageInfo(info);
        
      } catch (e) {
        console.error('Failed to initialize storage:', e);
        // Fallback to defaults
        const defaultSession = { id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() };
        setSessions([defaultSession]);
        setCurrentSessionId(defaultSession.id);
      } finally {
        setIsLoading(false);
      }
    };
    
    initStorage();
  }, []);

  // Save sessions to IndexedDB (debounced)
  useEffect(() => { 
    if (isLoading) return; // Don't save during initial load
    
    // Debounce saves to avoid too many writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Save each session individually for efficiency
        for (const session of sessions) {
          await dbManager.put('sessions', session);
        }
        
        // Update storage info
        const info = await dbManager.getStorageEstimate();
        setStorageInfo(info);
      } catch (e) {
        console.error('Failed to save sessions:', e);
      }
    }, 500); // 500ms debounce
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sessions, isLoading]);

  // Save knowledge base to IndexedDB
  useEffect(() => { 
    if (isLoading) return;
    
    const saveKnowledge = async () => {
      try {
        // Clear and re-add all (simpler for array management)
        await dbManager.clear('knowledge');
        await dbManager.putAll('knowledge', knowledgeBase);
      } catch (e) {
        console.error('Failed to save knowledge:', e);
      }
    };
    
    saveKnowledge();
  }, [knowledgeBase, isLoading]);

  // Save endpoint to localStorage (small, fast access needed)
  useEffect(() => { localStorage.setItem('ollama_endpoint', endpoint); }, [endpoint]);
  
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sessions, currentSessionId, streaming]);
  useEffect(() => { checkConnection(); }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Help modal
      if (e.key === '?' && e.shiftKey && document.activeElement.tagName !== 'TEXTAREA') setHelpOpen(true);
      
      // Escape closes modals and zen mode
      if (e.key === 'Escape') { 
        setSettingsOpen(false); setHelpOpen(false); setModelMgrOpen(false); 
        setSlashCmdsVisible(false); setKnowledgeOpen(false); setVoiceModeOpen(false);
        setZenMode(false);
      }
      
      // Ctrl/Cmd + Shift + Z toggles zen mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        setZenMode(prev => !prev);
      }
      
      // Ctrl/Cmd + N for new chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        createNewChat();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (input.startsWith('/') && input.length < 10) setSlashCmdsVisible(true);
    else setSlashCmdsVisible(false);
  }, [input]);

  // --- Logic ---

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession.messages;
  const selectedModel = currentSession.model;
  
  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const res = await fetch(`${endpoint}/api/tags`);
      if (!res.ok) throw new Error('Failed to connect');
      const data = await res.json();
      setModels(data.models || []);
      if (data.models.length > 0 && !selectedModel) updateCurrentSession({ model: data.models[0].name });
      setConnectionStatus('connected');
    } catch (err) {
      console.error(err);
      setConnectionStatus('error');
    }
  };

  const createNewChat = () => {
    const newSession = { id: Date.now(), title: 'New Chat', messages: [], model: models.length > 0 ? models[0].name : '', date: Date.now() };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const deleteSession = async (e, id) => {
    e.stopPropagation();
    
    // Delete from IndexedDB
    try {
      await dbManager.delete('sessions', id);
    } catch (err) {
      console.error('Failed to delete session from DB:', err);
    }
    
    const newSessions = sessions.filter(s => s.id !== id);
    if (newSessions.length === 0) {
        const fresh = { id: Date.now(), title: 'New Chat', messages: [], model: models[0]?.name || '', date: Date.now() };
        setSessions([fresh]);
        setCurrentSessionId(fresh.id);
        // Save the new session
        dbManager.put('sessions', fresh).catch(console.error);
    } else {
        setSessions(newSessions);
        if (currentSessionId === id) setCurrentSessionId(newSessions[0].id);
    }
  };

  const updateCurrentSession = (updates) => {
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, ...updates } : s));
  };

  // Persona definitions with distinct configurations
  const personaConfigs = {
    default: {
      name: 'Default',
      icon: User,
      color: 'indigo',
      systemPrompt: 'You are a helpful, knowledgeable AI assistant. Provide clear, accurate, and well-structured responses. Be concise but thorough.',
      params: { temperature: 0.7, top_p: 0.9, top_k: 40, repeat_penalty: 1.1 }
    },
    coder: {
      name: 'Coder',
      icon: FileCode,
      color: 'emerald',
      systemPrompt: `You are an expert software engineer and architect. Follow these guidelines:
- Write clean, efficient, well-documented code
- Use modern best practices and design patterns
- Prefer functional programming where appropriate
- Include error handling and edge cases
- Explain your reasoning and trade-offs
- Suggest optimizations and improvements
- Use proper formatting with code blocks and language tags`,
      params: { temperature: 0.2, top_p: 0.85, top_k: 30, repeat_penalty: 1.05 }
    },
    writer: {
      name: 'Writer',
      icon: PenTool,
      color: 'purple',
      systemPrompt: `You are a creative writer and storyteller. Your writing style:
- Use vivid, evocative language and rich imagery
- Create compelling narratives with depth
- Employ metaphors, similes, and literary devices
- Vary sentence structure for rhythm and flow
- Develop authentic voices and characters
- Balance description with dialogue and action
- Evoke emotions and sensory experiences`,
      params: { temperature: 0.9, top_p: 0.95, top_k: 60, repeat_penalty: 1.0 }
    },
    analyst: {
      name: 'Analyst',
      icon: BarChart,
      color: 'amber',
      systemPrompt: `You are a data analyst and critical thinker. Your approach:
- Be precise, objective, and evidence-based
- Structure information logically with clear headers
- Use bullet points and numbered lists for clarity
- Present data with appropriate context
- Identify patterns, trends, and anomalies
- Consider multiple perspectives and alternatives
- Quantify when possible, qualify when necessary
- Cite assumptions and limitations`,
      params: { temperature: 0.3, top_p: 0.8, top_k: 25, repeat_penalty: 1.15 }
    }
  };

  const switchPersona = (type) => {
    const config = personaConfigs[type] || personaConfigs.default;
    setPersona(type);
    setSystemPrompt(config.systemPrompt);
    setParams(prev => ({ ...prev, ...config.params }));
  };

  const currentPersonaConfig = personaConfigs[persona] || personaConfigs.default;

  // File upload configuration
  const FILE_CONFIG = {
    maxImageSize: 20 * 1024 * 1024,  // 20MB for images
    maxTextSize: 10 * 1024 * 1024,   // 10MB for text files
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
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  };

  const getFileExtension = (filename) => {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return filename; // Files like Dockerfile, Makefile
    return filename.slice(lastDot).toLowerCase();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const [fileError, setFileError] = useState(null);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setFileError(null);
    
    files.forEach(file => {
      const ext = getFileExtension(file.name);
      const isImage = FILE_CONFIG.allowedImageTypes.includes(file.type) || file.type.startsWith('image/');
      const isAllowedText = FILE_CONFIG.allowedTextExtensions.includes(ext) || 
                           FILE_CONFIG.allowedTextExtensions.includes(file.name);
      
      // Validate file type
      if (!isImage && !isAllowedText) {
        setFileError(`Unsupported file type: ${file.name}. Only images and code/text files are supported.`);
        return;
      }
      
      // Validate file size
      if (isImage && file.size > FILE_CONFIG.maxImageSize) {
        setFileError(`Image too large: ${file.name} (${formatFileSize(file.size)}). Max: ${formatFileSize(FILE_CONFIG.maxImageSize)}`);
        return;
      }
      
      if (!isImage && file.size > FILE_CONFIG.maxTextSize) {
        setFileError(`File too large: ${file.name} (${formatFileSize(file.size)}). Max: ${formatFileSize(FILE_CONFIG.maxTextSize)}`);
        return;
      }
      
      const reader = new FileReader();
      
      reader.onerror = () => {
        setFileError(`Failed to read file: ${file.name}`);
      };
      
      if (isImage) {
        reader.onloadend = () => setAttachments(prev => [...prev, { 
          type: 'image', 
          content: reader.result, 
          name: file.name,
          size: file.size 
        }]);
        reader.readAsDataURL(file);
      } else {
        reader.onloadend = () => setAttachments(prev => [...prev, { 
          type: 'file', 
          content: reader.result, 
          name: file.name,
          size: file.size,
          ext: ext 
        }]);
        reader.readAsText(file);
      }
    });
    e.target.value = ''; 
  };

  const pullModel = async (modelName) => {
    setPullProgress({ status: 'starting', completed: 0, total: 100 });
    try {
      const response = await fetch(`${endpoint}/api/pull`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true })
      });
      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while(true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if(!line.trim()) continue;
          try {
             const json = JSON.parse(line);
             if(json.status === 'success') { setPullProgress(null); checkConnection(); } 
             else if (json.completed && json.total) {
                setPullProgress({ status: json.status, completed: json.completed, total: json.total, percent: Math.round((json.completed / json.total) * 100) });
             } else { setPullProgress(prev => ({ ...prev, status: json.status })); }
          } catch(e) {}
        }
      }
    } catch (err) { setPullProgress({ status: 'Error: ' + err.message, error: true }); }
  };

  // --- Voice & Speech ---
  const voiceModeOpenRef = useRef(false);
  
  useEffect(() => {
    voiceModeOpenRef.current = voiceModeOpen;
  }, [voiceModeOpen]);

  const startVoiceMode = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice mode requires Chrome, Edge, or Safari. Firefox is not supported.");
      return;
    }
    setVoiceModeOpen(true);
    // Small delay to ensure state is set
    setTimeout(() => startListening(), 100);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startListening = () => {
    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Use Chrome, Edge, or Safari.");
      return;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // Show interim results
        if (interimTranscript) {
          setInput(interimTranscript);
        }
        
        // Process final result
        if (finalTranscript) {
          setInput(finalTranscript);
          // Auto-send if in voice mode
          if (voiceModeOpenRef.current) {
            handleSend(finalTranscript, true);
          }
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart if still in voice mode and not speaking
        if (voiceModeOpenRef.current && !window.speechSynthesis.speaking) {
          setTimeout(() => {
            if (voiceModeOpenRef.current) {
              startListening();
            }
          }, 500);
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      alert('Failed to start voice recognition. Please check microphone permissions.');
    }
  };

  const speakMessage = (text, msgIdx = null) => {
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/[#*`]/g, '')
      .slice(0, 500); // Limit length for TTS
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    if (msgIdx !== null) {
      // Toggle speak for individual message
      if (speakingMsgId === msgIdx) {
        setSpeakingMsgId(null);
        return;
      }
      utterance.onend = () => setSpeakingMsgId(null);
      setSpeakingMsgId(msgIdx);
    } else if (voiceModeOpenRef.current) {
      // Voice mode: chain listening after speaking
      utterance.onend = () => {
        if (voiceModeOpenRef.current) {
          setTimeout(() => startListening(), 300);
        }
      };
    }
    
    window.speechSynthesis.speak(utterance);
  };

  const endVoiceMode = () => {
    stopListening();
    window.speechSynthesis.cancel();
    setVoiceModeOpen(false);
    setSpeakingMsgId(null);
    setInput('');
  };

  const executeSlashCommand = (cmd) => {
    switch(cmd) {
      case '/clear': setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [] } : s)); break;
      case '/reset': updateCurrentSession({ messages: [] }); setAttachments([]); break;
      case '/save': exportChat(); break;
      case '/new': createNewChat(); break;
      default: break;
    }
    setInput(''); setSlashCmdsVisible(false);
  };

  const exportChat = () => {
    const content = messages.map(m => `## ${m.role.toUpperCase()}\n\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `nexus-${currentSession.title.replace(/\s+/g, '_')}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleSend = async (overrideInput = null, isVoice = false) => {
    const txt = overrideInput || input;
    if (txt.startsWith('/')) { executeSlashCommand(txt.trim()); return; }
    if ((!txt.trim() && attachments.length === 0) || !selectedModel) return;

    const images = attachments.filter(a => a.type === 'image').map(a => a.content.split(',')[1]);
    const fileContexts = attachments.filter(a => a.type === 'file').map(a => `\n--- FILE: ${a.name} ---\n${a.content}\n--- END FILE ---\n`).join('');
    
    // Inject Knowledge Base
    const knowledgeContext = knowledgeBase.filter(k => activeKnowledgeIds.includes(k.id)).map(k => `\n--- KNOWLEDGE: ${k.title} ---\n${k.content}\n`).join('');

    let fullContent = txt + fileContexts + knowledgeContext;
    // Keep full attachment content for image previews and chat continuity (IndexedDB has plenty of space)
    const userMsg = { role: 'user', content: fullContent, displayContent: txt, images: images, attachments: attachments };
    
    const startTime = Date.now();
    const updatedMessages = [...messages, userMsg];
    updateCurrentSession({ messages: updatedMessages });
    
    if (messages.length === 0) {
      const title = txt.slice(0, 30) + (txt.length > 30 ? '...' : '');
      updateCurrentSession({ title });
    }

    setInput(''); setAttachments([]); setStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      // Build options object with all parameters
      const options = {
        temperature: parseFloat(params.temperature),
        top_k: parseInt(params.top_k),
        top_p: parseFloat(params.top_p),
        repeat_penalty: parseFloat(params.repeat_penalty),
        num_predict: parseInt(params.num_predict),
        num_ctx: parseInt(params.num_ctx),
        ...(params.seed !== -1 && { seed: parseInt(params.seed) }),
        ...(params.mirostat > 0 && {
          mirostat: parseInt(params.mirostat),
          mirostat_tau: parseFloat(params.mirostat_tau),
          mirostat_eta: parseFloat(params.mirostat_eta)
        }),
        ...(params.num_gpu !== -1 && { num_gpu: parseInt(params.num_gpu) }),
        ...(params.num_thread > 0 && { num_thread: parseInt(params.num_thread) })
      };

      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'system', content: systemPrompt }, ...updatedMessages.map(m => ({ role: m.role, content: m.content, images: m.images }))],
          stream: true,
          options
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Add empty assistant message
      updateCurrentSession({ messages: [...updatedMessages, { role: 'assistant', content: '', timing: 0, tokenCount: 0 }] });

      let tokens = 0;
      let finalContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message && json.message.content) {
              tokens++;
              finalContent += json.message.content;
              const elapsed = (Date.now() - startTime) / 1000;
              
              // Use finalContent for immutable update instead of mutating
              setSessions(prev => prev.map(s => {
                if (s.id === currentSessionId) {
                    const newMsgs = s.messages.slice(0, -1); // All messages except last
                    const newAssistantMsg = {
                      role: 'assistant',
                      content: finalContent,
                      timing: elapsed.toFixed(1),
                      tokenSpeed: (tokens / elapsed).toFixed(1)
                    };
                    return { ...s, messages: [...newMsgs, newAssistantMsg] };
                }
                return s;
              }));
            }
            if (json.done) { 
                setStreaming(false); 
                abortControllerRef.current = null; 
                lastAssistantResponseRef.current = finalContent;
                if (isVoice) speakMessage(finalContent);
            }
          } catch (e) { }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { role: 'assistant', content: `**Error:** ${err.message}` }] } : s));
      }
      setStreaming(false);
    }
  };

  const addKnowledge = (title, content) => {
    setKnowledgeBase([...knowledgeBase, { id: Date.now(), title, content }]);
  };

  // Loading screen while IndexedDB initializes
  if (isLoading) {
    return (
      <div className="flex h-full bg-[#09090b] text-gray-200 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading Neural Nexus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#09090b] text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* Sidebar - Hidden in Zen Mode */}
      {!zenMode && (
        <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-[#0c0c0e] border-r border-gray-800 flex flex-col shrink-0 relative z-30 overflow-hidden`}>
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0c0c0e] min-w-[320px]">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg tracking-tight">
              <Cpu size={20} /><span>NEURAL </span><span className="text-white">NEXUS</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400"><ChevronRight /></button>
          </div>

          <div className="p-3 space-y-2 min-w-[320px]">
            <button onClick={createNewChat} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all shadow-lg active:scale-95">
              <Plus size={18} /><span>New Session</span>
            </button>
            
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-gray-600" />
              <input 
                type="text" 
                placeholder="Search history..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#18181b] border border-gray-800 rounded-lg py-2 pl-9 pr-3 text-xs text-gray-300 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar min-w-[320px]">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 px-2">History</div>
            {filteredSessions.map((session) => (
              <div key={session.id} onClick={() => { setCurrentSessionId(session.id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border border-transparent ${currentSessionId === session.id ? 'bg-[#18181b] border-gray-700 text-white shadow-sm' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={16} className={currentSessionId === session.id ? "text-indigo-400" : "text-gray-600"} />
                  <div className="flex flex-col overflow-hidden">
                      <span className="truncate text-sm font-medium">{session.title}</span>
                      <span className="text-[10px] text-gray-600 truncate">{new Date(session.date).toLocaleDateString()} • {session.model || 'No Model'}</span>
                  </div>
                </div>
                <button onClick={(e) => deleteSession(e, session.id)} className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-800 bg-[#0a0a0c] space-y-3 min-w-[320px]">
              <div>
                 <div className="flex justify-between items-end mb-1">
                   <label className="text-[10px] uppercase font-bold text-gray-500">Active Model</label>
                   <button onClick={() => setModelMgrOpen(true)} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"><DownloadCloud size={10} /> Install</button>
                 </div>
                 <div className="relative">
                   <select value={selectedModel} onChange={(e) => updateCurrentSession({ model: e.target.value })} className="w-full bg-[#18181b] border border-gray-700 text-gray-200 text-sm rounded-lg p-2.5 appearance-none focus:outline-none focus:border-indigo-500">
                     <option value="" disabled>Select a model...</option>
                     {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                   </select>
                   <Box size={14} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                 </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                     <Button variant="icon" onClick={() => setKnowledgeOpen(true)} title="Knowledge Base"><Database size={16} /></Button>
                     <Button variant="icon" onClick={() => setHelpOpen(true)} title="Shortcuts"><Keyboard size={16} /></Button>
                     <Button variant="icon" onClick={() => setSettingsOpen(true)} title="Settings"><Settings size={16} /></Button>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative bg-[#09090b]">
        
        {/* Header - Different in Zen Mode */}
        {zenMode ? (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-mono ${connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </div>
            <button 
              onClick={() => setZenMode(false)} 
              className="p-2.5 bg-gray-800/70 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-all backdrop-blur-sm border border-gray-700/50"
              title="Exit Zen Mode"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4 md:px-6 bg-[#09090b]/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
               {!isSidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 hover:bg-gray-800 rounded-lg text-gray-400"><ChevronRight size={20} /></button>}
               <div className="flex items-center gap-4">
                  <h2 className="text-gray-200 font-medium text-sm md:text-base hidden md:block">{currentSession.title}</h2>
                  {/* Persona Matrix */}
                  <div className="bg-[#18181b] p-1 rounded-lg border border-gray-700 flex items-center gap-1">
                      {Object.entries(personaConfigs).map(([id, config]) => {
                        const Icon = config.icon;
                        const isActive = persona === id;
                        const colorClasses = {
                          indigo: isActive ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10',
                          emerald: isActive ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10',
                          purple: isActive ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-purple-400 hover:bg-purple-500/10',
                          amber: isActive ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-amber-400 hover:bg-amber-500/10'
                        };
                        return (
                          <button 
                            key={id}
                            onClick={() => switchPersona(id)}
                            className={`p-1.5 rounded transition-all ${colorClasses[config.color]} ${isActive ? 'shadow' : ''}`}
                            title={`${config.name} (Temp: ${config.params.temperature})`}
                          >
                            <Icon size={14} />
                          </button>
                        );
                      })}
                  </div>
                  {/* Active Persona Label */}
                  <span className={`hidden lg:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                    persona === 'coder' ? 'bg-emerald-500/10 text-emerald-400' :
                    persona === 'writer' ? 'bg-purple-500/10 text-purple-400' :
                    persona === 'analyst' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-indigo-500/10 text-indigo-400'
                  }`}>
                    {currentPersonaConfig.name}
                  </span>
               </div>
            </div>
            <div className="flex gap-2">
              <Button variant="accent" onClick={startVoiceMode} icon={Phone} title="Omni-Voice Mode"><span className="hidden md:inline text-xs">Voice</span></Button>
              <Button variant="ghost" onClick={() => setZenMode(true)} icon={Layout} title="Zen Mode" />
            </div>
          </div>
        )}

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="min-h-full flex flex-col items-center justify-center text-gray-500 py-8">
              {/* Animated Logo */}
              <div className="relative w-20 h-20 mb-6 flex-shrink-0">
                {/* Outer rotating ring */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/40 animate-[spin_8s_linear_infinite]"></div>
                {/* Inner static circle with icon */}
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-900/50 to-purple-900/50 flex items-center justify-center border border-indigo-500/20 shadow-2xl">
                  <Zap size={28} className="text-indigo-400" />
                </div>
              </div>
              <h3 className="text-2xl font-thin tracking-tight text-white mb-1">NEURAL <span className="font-bold text-indigo-400">NEXUS</span></h3>
              <p className="text-xs text-gray-500 mb-6 tracking-widest uppercase">Omni Class Interface</p>
              
              {/* Persona Selection Cards */}
              <div className="mb-8 w-full max-w-2xl">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-3 text-center">Select a Persona</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(personaConfigs).map(([id, config]) => {
                    const Icon = config.icon;
                    const isActive = persona === id;
                    const colorStyles = {
                      indigo: { border: 'border-indigo-500', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
                      emerald: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
                      purple: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
                      amber: { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' }
                    };
                    const style = colorStyles[config.color];
                    return (
                      <button
                        key={id}
                        onClick={() => switchPersona(id)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          isActive 
                            ? `${style.border} ${style.bg}` 
                            : 'border-gray-800 bg-[#18181b]/50 hover:border-gray-700 hover:bg-[#18181b]'
                        }`}
                      >
                        <Icon size={20} className={isActive ? style.text : 'text-gray-500'} />
                        <h4 className={`text-sm font-bold mt-2 ${isActive ? style.text : 'text-gray-300'}`}>{config.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-1">Temp: {config.params.temperature}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-3 max-w-md w-full">
                 {[
                   { icon: Phone, title: "Voice Mode", desc: "Hands-free chat", action: startVoiceMode },
                   { icon: Database, title: "Knowledge", desc: "Context injection", action: () => setKnowledgeOpen(true) },
                   { icon: Layout, title: "Zen Mode", desc: "Focus view", action: () => setZenMode(true) },
                   { icon: Settings, title: "Settings", desc: "Configure", action: () => setSettingsOpen(true) }
                 ].map((item, i) => (
                    <button 
                      key={i} 
                      onClick={item.action}
                      className="p-4 bg-[#18181b]/30 border border-gray-800 hover:border-gray-700 rounded-xl transition-all hover:bg-[#18181b] group text-left"
                    >
                        <item.icon size={18} className="text-gray-600 group-hover:text-indigo-400 mb-2 transition-colors" />
                        <h4 className="text-xs font-bold text-gray-400 group-hover:text-gray-200">{item.title}</h4>
                        <p className="text-[10px] text-gray-600">{item.desc}</p>
                    </button>
                 ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group/msg`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-lg ${msg.role === 'user' ? 'order-2 bg-indigo-600' : 'bg-[#18181b] border border-gray-700'}`}>
                  {msg.role === 'user' ? <span className="text-xs font-bold">ME</span> : <Terminal size={14} className="text-indigo-400" />}
                </div>

                <div className={`flex flex-col max-w-[85%] md:max-w-[75%] w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`relative px-5 py-4 rounded-2xl shadow-md w-full ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-[#18181b] border border-gray-800 text-gray-200 rounded-tl-sm'}`}>
                      {/* Attachments with Image Previews */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.attachments.map((att, i) => (
                            att.type === 'image' && att.content ? (
                              <div key={i} className="relative group">
                                <img 
                                  src={att.content} 
                                  alt={att.name} 
                                  className="max-h-48 max-w-64 rounded-lg border border-white/20 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(att.content, '_blank')}
                                />
                                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[150px]">{att.name}</span>
                              </div>
                            ) : (
                              <div key={i} className="flex items-center gap-2 bg-black/20 rounded-lg p-2 text-xs border border-white/10">
                                <FileText size={12}/>
                                <span className="truncate max-w-[150px]">{att.name}</span>
                                {att.size && <span className="text-[10px] opacity-60">{formatBytes(att.size)}</span>}
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{msg.displayContent || msg.content}</p>
                      ) : (
                        <MessageContent content={msg.content} />
                      )}
                      
                      {msg.role === 'assistant' && msg.content === '' && (
                         <div className="flex gap-1 h-4 items-center">
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                         </div>
                      )}
                    </div>
                    
                    {msg.role === 'assistant' && msg.content !== '' && (
                        <div className="flex items-center gap-3 mt-2 ml-1">
                            <button onClick={() => speakMessage(msg.content, idx)} className={`text-gray-500 hover:text-indigo-400 transition-colors ${speakingMsgId === idx ? 'text-indigo-400 animate-pulse' : ''}`}>
                                {speakingMsgId === idx ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                            {msg.timing && (
                              <span className="flex items-center gap-2 text-[10px] text-gray-600 font-mono">
                                <span className="flex items-center gap-1"><Clock size={10} />{msg.timing}s</span>
                                {msg.tokenSpeed && <span className="flex items-center gap-1"><Zap size={10} />{msg.tokenSpeed} t/s</span>}
                              </span>
                            )}
                        </div>
                    )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-[#09090b]">
          <div className="max-w-4xl mx-auto relative">
             {/* File Error Alert */}
             {fileError && (
               <div className="absolute bottom-full left-0 right-0 mb-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-bottom-2">
                 <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
                 <span className="text-sm text-red-300 flex-1">{fileError}</span>
                 <button onClick={() => setFileError(null)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
               </div>
             )}
             
             {attachments.length > 0 && (
               <div className={`absolute bottom-full left-0 ${fileError ? 'mb-16' : 'mb-4'} flex gap-2 overflow-x-auto max-w-full p-2 animate-in slide-in-from-bottom-2`}>
                 {attachments.map((att, i) => (
                   <div key={i} className="bg-[#18181b] border border-gray-700 rounded-lg p-2 flex items-center gap-3 min-w-[120px] shadow-xl">
                     {att.type === 'image' ? <img src={att.content} alt="Preview" className="h-8 w-8 object-cover rounded" /> : <div className="h-8 w-8 bg-gray-800 rounded flex items-center justify-center"><FileText size={16} className="text-gray-400"/></div>}
                     <div className="flex flex-col">
                       <span className="text-xs text-gray-300 truncate max-w-[100px]">{att.name}</span>
                       {att.size && <span className="text-[10px] text-gray-500">{formatFileSize(att.size)}</span>}
                     </div>
                     <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="hover:text-red-400"><X size={14} /></button>
                   </div>
                 ))}
               </div>
             )}

             {/* Slash Commands */}
             {slashCmdsVisible && (
               <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#18181b] border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                 <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase">Commands</div>
                 {['/clear', '/reset', '/save', '/new'].map(cmd => (
                   <button key={cmd} onClick={() => executeSlashCommand(cmd)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white transition-colors font-mono">
                     {cmd}
                   </button>
                 ))}
               </div>
             )}

            <div className={`relative bg-[#18181b] rounded-xl flex items-end p-2 border transition-colors shadow-2xl ${streaming ? 'border-indigo-500/30' : 'border-gray-700 hover:border-gray-600'}`}>
              <div className="pb-1 pl-1 flex flex-col gap-1">
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,.txt,.md,.rmd,.markdown,.json,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.scala,.html,.css,.scss,.sass,.less,.sql,.sh,.bash,.yaml,.yml,.toml,.xml,.csv,.tsv,.log,.env,.conf,.config,.ini,.r,.R,.jl,.lua,.pl,.ipynb,.tex,.bib,.rst,.zig,.ex,.exs,.hs,.ml,.clj,.vim,.fish" />
                 <button onClick={() => fileInputRef.current?.click()} disabled={streaming || !selectedModel} className="p-2 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-50" title="Attach">
                   <Plus size={20} />
                 </button>
                 <button onClick={() => {if(isListening){setIsListening(false);recognitionRef.current?.stop()}else{startListening()}}} disabled={streaming || !selectedModel} className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isListening ? 'text-red-400 bg-red-500/10 animate-pulse' : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'}`} title="Voice">
                   {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                 </button>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                placeholder={isListening ? "Listening..." : "Message... (Type / for commands)"}
                disabled={!selectedModel || streaming}
                className="w-full bg-transparent text-gray-200 p-3 max-h-40 min-h-[50px] resize-none focus:outline-none placeholder-gray-600 disabled:cursor-not-allowed text-sm md:text-base scrollbar-hide"
                rows={1}
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
              />
              
              <div className="pb-1 pr-1">
                 {streaming ? (
                   <button onClick={() => abortControllerRef.current?.abort()} className="p-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"><Square size={18} fill="currentColor" /></button>
                 ) : (
                   <button onClick={() => handleSend()} disabled={(!input.trim() && attachments.length === 0) || !selectedModel} className={`p-2.5 rounded-lg transition-all duration-200 ${(input.trim() || attachments.length > 0) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500'}`}><Send size={18} /></button>
                 )}
              </div>
            </div>
            <div className="flex justify-center mt-3">
               <span className="text-[10px] text-gray-600 font-medium">Drag & Drop files • <kbd className="font-sans">Shift+Enter</kbd> new line</span>
            </div>
          </div>
        </div>

      </div>

      {/* Voice Mode Overlay */}
      <VoiceModeOverlay 
         isOpen={voiceModeOpen} 
         onClose={() => { setVoiceModeOpen(false); setIsListening(false); recognitionRef.current?.stop(); }}
         isSpeaking={speakingMsgId !== null}
         isListening={isListening}
         transcript={input}
         lastResponse={lastAssistantResponseRef.current}
         onEndCall={() => { setVoiceModeOpen(false); setIsListening(false); recognitionRef.current?.stop(); window.speechSynthesis.cancel(); }}
         onStartListening={startListening}
         onStopListening={() => { setIsListening(false); recognitionRef.current?.stop(); }}
      />

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f1f23]">
              <h3 className="font-bold text-gray-200 flex items-center gap-2"><Settings size={18} /> Engine Configuration</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ollama Endpoint</label>
                 <div className="flex gap-2">
                   <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="flex-1 bg-[#09090b] border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-indigo-300 focus:border-indigo-500 focus:outline-none" />
                   <Button variant="secondary" onClick={checkConnection} icon={RefreshCw} title="Test" />
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">System Prompt</label>
                 <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="w-full bg-[#09090b] border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none min-h-[100px] resize-y" />
               </div>
               <div className="pt-2 border-t border-gray-800">
                  <button onClick={() => setAdvancedSettingsOpen(!advancedSettingsOpen)} className="flex items-center gap-2 text-sm text-indigo-400 font-medium hover:text-indigo-300"><Sliders size={16} />{advancedSettingsOpen ? 'Hide Advanced' : 'Show Advanced'}</button>
               </div>
               {advancedSettingsOpen && (
                 <div className="space-y-4 pt-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                   {/* Sampling Parameters */}
                   <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Sampling</div>
                   
                   <div>
                     <div className="flex justify-between mb-1">
                       <label className="text-xs text-gray-400">Temperature</label>
                       <span className="text-xs text-indigo-400 font-mono">{params.temperature}</span>
                     </div>
                     <input type="range" min="0" max="2" step="0.1" value={params.temperature} onChange={(e) => setParams({...params, temperature: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <p className="text-[10px] text-gray-600 mt-1">Creativity level. Higher = more random.</p>
                   </div>
                   
                   <div>
                     <div className="flex justify-between mb-1">
                       <label className="text-xs text-gray-400">Top P</label>
                       <span className="text-xs text-indigo-400 font-mono">{params.top_p}</span>
                     </div>
                     <input type="range" min="0" max="1" step="0.05" value={params.top_p} onChange={(e) => setParams({...params, top_p: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <p className="text-[10px] text-gray-600 mt-1">Nucleus sampling threshold.</p>
                   </div>
                   
                   <div>
                     <div className="flex justify-between mb-1">
                       <label className="text-xs text-gray-400">Top K</label>
                       <span className="text-xs text-indigo-400 font-mono">{params.top_k}</span>
                     </div>
                     <input type="range" min="1" max="100" step="1" value={params.top_k} onChange={(e) => setParams({...params, top_k: parseInt(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <p className="text-[10px] text-gray-600 mt-1">Limits vocabulary to top K tokens.</p>
                   </div>
                   
                   <div>
                     <div className="flex justify-between mb-1">
                       <label className="text-xs text-gray-400">Repeat Penalty</label>
                       <span className="text-xs text-indigo-400 font-mono">{params.repeat_penalty}</span>
                     </div>
                     <input type="range" min="1" max="2" step="0.05" value={params.repeat_penalty} onChange={(e) => setParams({...params, repeat_penalty: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <p className="text-[10px] text-gray-600 mt-1">Penalizes repeated tokens.</p>
                   </div>
                   
                   {/* Generation Limits */}
                   <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pt-2 border-t border-gray-800">Generation</div>
                   
                   <div>
                     <div className="flex justify-between mb-1">
                       <label className="text-xs text-gray-400">Max Tokens (num_predict)</label>
                       <span className="text-xs text-indigo-400 font-mono">{params.num_predict}</span>
                     </div>
                     <input type="range" min="128" max="8192" step="128" value={params.num_predict} onChange={(e) => setParams({...params, num_predict: parseInt(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <p className="text-[10px] text-gray-600 mt-1">Maximum tokens to generate.</p>
                   </div>
                   
                   <div>
                     <div className="flex justify-between mb-1">
                       <label className="text-xs text-gray-400">Context Length (num_ctx)</label>
                       <span className="text-xs text-indigo-400 font-mono">{params.num_ctx}</span>
                     </div>
                     <input type="range" min="512" max="32768" step="512" value={params.num_ctx} onChange={(e) => setParams({...params, num_ctx: parseInt(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <p className="text-[10px] text-gray-600 mt-1">Context window size.</p>
                   </div>
                   
                   <div>
                     <label className="text-xs text-gray-400 block mb-1">Seed</label>
                     <input type="number" value={params.seed} onChange={(e) => setParams({...params, seed: parseInt(e.target.value) || -1})} className="w-full bg-[#09090b] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300 focus:border-indigo-500 focus:outline-none" />
                     <p className="text-[10px] text-gray-600 mt-1">-1 for random. Fixed seed = reproducible output.</p>
                   </div>
                   
                   {/* Mirostat */}
                   <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pt-2 border-t border-gray-800">Mirostat</div>
                   
                   <div>
                     <div className="flex justify-between mb-1">
                       <label className="text-xs text-gray-400">Mirostat Mode</label>
                       <span className="text-xs text-indigo-400 font-mono">{params.mirostat === 0 ? 'Off' : `v${params.mirostat}`}</span>
                     </div>
                     <input type="range" min="0" max="2" step="1" value={params.mirostat} onChange={(e) => setParams({...params, mirostat: parseInt(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <p className="text-[10px] text-gray-600 mt-1">0=off, 1=Mirostat, 2=Mirostat 2.0</p>
                   </div>
                   
                   {params.mirostat > 0 && (
                     <>
                       <div>
                         <div className="flex justify-between mb-1">
                           <label className="text-xs text-gray-400">Mirostat Tau</label>
                           <span className="text-xs text-indigo-400 font-mono">{params.mirostat_tau}</span>
                         </div>
                         <input type="range" min="0" max="10" step="0.1" value={params.mirostat_tau} onChange={(e) => setParams({...params, mirostat_tau: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                         <p className="text-[10px] text-gray-600 mt-1">Target entropy (5.0 default).</p>
                       </div>
                       <div>
                         <div className="flex justify-between mb-1">
                           <label className="text-xs text-gray-400">Mirostat Eta</label>
                           <span className="text-xs text-indigo-400 font-mono">{params.mirostat_eta}</span>
                         </div>
                         <input type="range" min="0" max="1" step="0.01" value={params.mirostat_eta} onChange={(e) => setParams({...params, mirostat_eta: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                         <p className="text-[10px] text-gray-600 mt-1">Learning rate (0.1 default).</p>
                       </div>
                     </>
                   )}
                   
                   {/* Hardware */}
                   <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pt-2 border-t border-gray-800">Hardware</div>
                   
                   <div>
                     <label className="text-xs text-gray-400 block mb-1">GPU Layers (num_gpu)</label>
                     <input type="number" value={params.num_gpu} onChange={(e) => setParams({...params, num_gpu: parseInt(e.target.value) || -1})} className="w-full bg-[#09090b] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300 focus:border-indigo-500 focus:outline-none" />
                     <p className="text-[10px] text-gray-600 mt-1">-1 = auto, 0 = CPU only.</p>
                   </div>
                   
                   <div>
                     <label className="text-xs text-gray-400 block mb-1">CPU Threads (num_thread)</label>
                     <input type="number" value={params.num_thread} onChange={(e) => setParams({...params, num_thread: parseInt(e.target.value) || 0})} className="w-full bg-[#09090b] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300 focus:border-indigo-500 focus:outline-none" />
                     <p className="text-[10px] text-gray-600 mt-1">0 = auto detect.</p>
                   </div>
                   
                   {/* Storage Info */}
                   <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pt-2 border-t border-gray-800">Storage</div>
                   
                   <div className="bg-[#09090b] rounded-lg p-3 space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-gray-400">Used</span>
                       <span className="text-indigo-400 font-mono">{formatBytes(storageInfo.used)}</span>
                     </div>
                     <div className="flex justify-between text-xs">
                       <span className="text-gray-400">Available</span>
                       <span className="text-green-400 font-mono">{formatBytes(storageInfo.quota)}</span>
                     </div>
                     <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                       <div 
                         className={`h-1.5 rounded-full transition-all ${parseFloat(storageInfo.percent) > 80 ? 'bg-red-500' : parseFloat(storageInfo.percent) > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                         style={{ width: `${Math.min(storageInfo.percent, 100)}%` }}
                       ></div>
                     </div>
                     <p className="text-[10px] text-gray-600 mt-1">Using IndexedDB for unlimited storage (browser-managed).</p>
                     <div className="flex gap-2 mt-2">
                       <button
                         onClick={async () => {
                           if (confirm('Clear all chat history? This cannot be undone.')) {
                             await dbManager.clear('sessions');
                             const fresh = { id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() };
                             setSessions([fresh]);
                             setCurrentSessionId(fresh.id);
                             await dbManager.put('sessions', fresh);
                             const info = await dbManager.getStorageEstimate();
                             setStorageInfo(info);
                           }
                         }}
                         className="flex-1 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded border border-red-500/30 transition-colors"
                       >
                         Clear All Chats
                       </button>
                       <button
                         onClick={async () => {
                           const info = await dbManager.getStorageEstimate();
                           setStorageInfo(info);
                         }}
                         className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded border border-gray-700 transition-colors"
                       >
                         Refresh
                       </button>
                     </div>
                   </div>
                   
                   {/* Reset Button */}
                   <button 
                     onClick={() => setParams({
                       temperature: 0.7, top_k: 40, top_p: 0.9, repeat_penalty: 1.1,
                       num_predict: 2048, num_ctx: 4096, seed: -1,
                       mirostat: 0, mirostat_tau: 5.0, mirostat_eta: 0.1,
                       num_gpu: -1, num_thread: 0
                     })}
                     className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded border border-gray-700 transition-colors"
                   >
                     Reset to Defaults
                   </button>
                 </div>
               )}
            </div>
            <div className="p-4 border-t border-gray-800 bg-[#1f1f23] flex justify-end"><Button onClick={() => setSettingsOpen(false)}>Done</Button></div>
          </div>
        </div>
      )}

      {/* Model Manager */}
      {modelMgrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
             <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f1f23]">
               <h3 className="font-bold text-gray-200 flex items-center gap-2"><DownloadCloud size={18} /> Model Manager</h3>
               <button onClick={() => setModelMgrOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
             </div>
             <div className="p-6">
                {!pullProgress ? (
                  <div className="space-y-4">
                     <p className="text-sm text-gray-400">Enter a model tag (e.g., <code className="text-indigo-300">llama3</code>).</p>
                     <form onSubmit={(e) => { e.preventDefault(); pullModel(e.target.modelName.value); }}>
                        <div className="flex gap-2">
                           <input name="modelName" type="text" placeholder="Tag name..." className="flex-1 bg-[#09090b] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" required />
                           <Button type="submit">Pull</Button>
                        </div>
                     </form>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                     <div className="text-indigo-400 font-bold text-lg animate-pulse">{pullProgress.status}</div>
                     {pullProgress.total > 0 && <div className="w-full bg-gray-800 rounded-full h-2.5"><div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${pullProgress.percent}%` }}></div></div>}
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Knowledge Base */}
      {knowledgeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden h-[80vh] flex flex-col">
             <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f1f23]">
               <h3 className="font-bold text-gray-200 flex items-center gap-2"><Database size={18} /> Knowledge Base</h3>
               <button onClick={() => setKnowledgeOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {knowledgeBase.length === 0 && <p className="text-center text-gray-500 text-sm mt-10">No knowledge entries yet.</p>}
                {knowledgeBase.map(k => (
                  <div key={k.id} className="bg-[#09090b] border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors flex items-start gap-3">
                     <button onClick={() => {
                        setActiveKnowledgeIds(prev => prev.includes(k.id) ? prev.filter(id => id !== k.id) : [...prev, k.id]);
                     }} className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all ${activeKnowledgeIds.includes(k.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600 hover:border-gray-400'}`}>
                        {activeKnowledgeIds.includes(k.id) && <Check size={12} className="text-white" />}
                     </button>
                     <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                           <h4 className="font-bold text-sm text-gray-200">{k.title}</h4>
                           <button onClick={() => setKnowledgeBase(prev => prev.filter(i => i.id !== k.id))} className="text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 font-mono">{k.content}</p>
                     </div>
                  </div>
                ))}
             </div>
             <div className="p-4 border-t border-gray-800 bg-[#1f1f23]">
                <form onSubmit={(e) => { e.preventDefault(); addKnowledge(e.target.title.value, e.target.content.value); e.target.reset(); }} className="space-y-2">
                   <input name="title" placeholder="Title (e.g., API Docs)" className="w-full bg-[#09090b] border border-gray-700 rounded p-2 text-sm focus:border-indigo-500 focus:outline-none" required />
                   <textarea name="content" placeholder="Content to inject..." className="w-full bg-[#09090b] border border-gray-700 rounded p-2 text-sm h-20 resize-none focus:border-indigo-500 focus:outline-none" required />
                   <Button type="submit" className="w-full">Add to Knowledge Base</Button>
                </form>
             </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
              <button onClick={() => setHelpOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
              <h3 className="font-bold text-xl text-gray-200 mb-6 flex items-center gap-2"><HelpCircle size={24} className="text-indigo-500" /> Shortcuts</h3>
              <div className="space-y-3">
                 {[{ label: "Send", key: "Enter" }, { label: "New Line", key: "Shift+Ent" }, { label: "Commands", key: "/" }, { label: "Close", key: "Esc" }].map((s, i) => (
                   <div key={i} className="flex justify-between items-center text-sm"><span className="text-gray-400">{s.label}</span><kbd className="bg-gray-800 px-2 py-1 rounded border border-gray-700 text-gray-300 font-mono text-xs">{s.key}</kbd></div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}