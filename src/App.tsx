import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { ChevronRight, Layout, Phone, X } from 'lucide-react';

// Components - eagerly loaded (needed immediately)
import {
  Button,
  Tooltip,
  Sidebar,
  ChatInput,
  ChatMessage,
  WelcomeScreen,
  VoiceModeOverlay,
  personaConfigs
} from './components';

// Components - lazily loaded (modals not needed on initial render)
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const ModelManagerModal = lazy(() => import('./components/ModelManagerModal'));
const KnowledgeBaseModal = lazy(() => import('./components/KnowledgeBaseModal'));
const HelpModal = lazy(() => import('./components/HelpModal'));

// Utils
import { dbManager, migrateFromLocalStorage } from './utils/storage';
import { processDocument } from './utils/documents';
import { 
  formatFileSize, 
  getApiUrl, 
  manageContext, 
  estimateTokens, 
  formatTokenCount
} from './utils/helpers';
import { toolRegistry, clearEmbeddingCache } from './utils/tools';

// Types
import type {
  Session,
  Message,
  Attachment,
  KnowledgeEntry,
  Model,
  ModelParams,
  PersonaType,
  ConnectionStatus,
  StorageInfo,
  ToolCall,
  ToolDefinition
} from './types';

// PDF.js setup
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// File upload configuration
const FILE_CONFIG = {
  maxImageSize: 50 * 1024 * 1024,   // 50MB for images
  maxTextSize: 25 * 1024 * 1024,    // 25MB for text files
  maxDocSize: 100 * 1024 * 1024,    // 100MB for documents
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
};

const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.slice(lastDot).toLowerCase();
};

const defaultParams: ModelParams = {
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
};

export default function App() {
  // State: Core
  const [sessions, setSessions] = useState<Session[]>([
    { id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ used: 0, quota: 0, percent: '0' });
  const [isLoading, setIsLoading] = useState(true);

  // State: Knowledge Base
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
  const [activeKnowledgeIds, setActiveKnowledgeIds] = useState<number[]>([]);

  // State: UI
  const [input, setInput] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelMgrOpen, setModelMgrOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  // State: Features
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);
  const [slashCmdsVisible, setSlashCmdsVisible] = useState(false);
  const [persona, setPersona] = useState<PersonaType>('default');

  // State: Config
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem('ollama_endpoint') || 'http://localhost:11434');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, expert AI assistant.');
  const [params, setParams] = useState<ModelParams>(defaultParams);
  const [toolsEnabled, setToolsEnabled] = useState(() => {
    const saved = localStorage.getItem('nexus_tools_global_enabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [executingTools, setExecutingTools] = useState(false);
  const [modelCapabilities, setModelCapabilities] = useState<string[]>([]);
  const [capabilitiesChecked, setCapabilitiesChecked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [pullProgress, setPullProgress] = useState<{
    status: string;
    completed?: number;
    total?: number;
    percent?: number;
    error?: boolean;
  } | null>(null);

  // State: File handling
  const [fileError, setFileError] = useState<string | null>(null);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);

  // State: Context management
  const [contextUsage, setContextUsage] = useState<{ tokens: number; percent: number; status: 'ok' | 'warning' | 'critical' } | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const lastAssistantResponseRef = useRef('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceModeOpenRef = useRef(false);

  // Keep voiceModeOpenRef in sync
  useEffect(() => {
    voiceModeOpenRef.current = voiceModeOpen;
  }, [voiceModeOpen]);

  // Derived state
  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];
  const selectedModel = currentSession?.model || '';
  const currentPersonaConfig = personaConfigs[persona] || personaConfigs.default;

  // --- Effects ---

  // Initialize: Load data from IndexedDB on mount
  useEffect(() => {
    const initStorage = async () => {
      try {
        await dbManager.init();
        await migrateFromLocalStorage();

        const savedSessions = await dbManager.getAll('sessions') as Session[];
        if (savedSessions && savedSessions.length > 0) {
          savedSessions.sort((a, b) => (b.date || 0) - (a.date || 0));
          setSessions(savedSessions);
          setCurrentSessionId(savedSessions[0].id);
        } else {
          const defaultSession: Session = { id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() };
          setSessions([defaultSession]);
          setCurrentSessionId(defaultSession.id);
          await dbManager.put('sessions', defaultSession);
        }

        const savedKnowledge = await dbManager.getAll('knowledge') as KnowledgeEntry[];
        if (savedKnowledge) {
          setKnowledgeBase(savedKnowledge);
        }

        const info = await dbManager.getStorageEstimate();
        setStorageInfo(info);
      } catch (e) {
        console.error('Failed to initialize storage:', e);
        const defaultSession: Session = { id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() };
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
    if (isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        for (const session of sessions) {
          await dbManager.put('sessions', session);
        }
        const info = await dbManager.getStorageEstimate();
        setStorageInfo(info);
      } catch (e) {
        console.error('Failed to save sessions:', e);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sessions, isLoading]);

  // Save knowledge base to IndexedDB and localStorage (for tools)
  useEffect(() => {
    if (isLoading) return;

    const saveKnowledge = async () => {
      try {
        await dbManager.clear('knowledge');
        await dbManager.putAll('knowledge', knowledgeBase);
        // Also save to localStorage for RAG tool access
        localStorage.setItem('nexus_knowledge_base', JSON.stringify(knowledgeBase));
        // Clear embedding cache so RAG search re-embeds updated documents
        clearEmbeddingCache();
      } catch (e) {
        console.error('Failed to save knowledge:', e);
      }
    };

    saveKnowledge();
  }, [knowledgeBase, isLoading]);

  // Save endpoint to localStorage
  useEffect(() => {
    localStorage.setItem('ollama_endpoint', endpoint);
  }, [endpoint]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, streaming]);

  // Track context usage when messages change
  useEffect(() => {
    if (!messages.length) {
      setContextUsage(null);
      return;
    }
    
    // Estimate tokens for current conversation
    const systemTokens = estimateTokens(systemPrompt);
    const msgTokens = messages.reduce((total, msg) => total + estimateTokens(msg.content) + 4, 0);
    const totalTokens = systemTokens + msgTokens;
    const maxTokens = params.num_ctx;
    const percent = Math.round((totalTokens / maxTokens) * 100);
    
    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (percent >= 85) status = 'critical';
    else if (percent >= 60) status = 'warning';
    
    setContextUsage({ tokens: totalTokens, percent, status });
  }, [messages, systemPrompt, params.num_ctx]);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Check model capabilities when selected model changes
  useEffect(() => {
    if (selectedModel && endpoint) {
      setCapabilitiesChecked(false);
      checkModelCapabilities(selectedModel);
    } else {
      setModelCapabilities([]);
      setCapabilitiesChecked(true);
    }
  }, [selectedModel, endpoint]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Help modal - Shift+?
      if (e.key === '?' && e.shiftKey && (document.activeElement as HTMLElement)?.tagName !== 'TEXTAREA') {
        setHelpOpen(true);
      }

      // Escape closes modals and zen mode
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setHelpOpen(false);
        setModelMgrOpen(false);
        setSlashCmdsVisible(false);
        setKnowledgeOpen(false);
        setVoiceModeOpen(false);
        setZenMode(false);
      }

      // Zen mode toggle - Ctrl+Shift+Z (doesn't conflict with browser)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        setZenMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Slash commands visibility
  useEffect(() => {
    if (input.startsWith('/') && input.length < 10) {
      setSlashCmdsVisible(true);
    } else {
      setSlashCmdsVisible(false);
    }
  }, [input]);

  // --- Functions ---

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const res = await fetch(getApiUrl(endpoint, '/api/tags'));
      if (!res.ok) throw new Error('Failed to connect');
      const data = await res.json();
      setModels(data.models || []);
      if (data.models.length > 0 && !selectedModel) {
        updateCurrentSession({ model: data.models[0].name });
      }
      setConnectionStatus('connected');
    } catch (err) {
      console.error(err);
      setConnectionStatus('error');
    }
  };

  const createNewChat = useCallback(() => {
    const newSession: Session = {
      id: Date.now(),
      title: 'New Chat',
      messages: [],
      model: models.length > 0 ? models[0].name : '',
      date: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [models]);

  const deleteSession = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();

    try {
      await dbManager.delete('sessions', id);
    } catch (err) {
      console.error('Failed to delete session from DB:', err);
    }

    const newSessions = sessions.filter(s => s.id !== id);
    if (newSessions.length === 0) {
      const fresh: Session = { id: Date.now(), title: 'New Chat', messages: [], model: models[0]?.name || '', date: Date.now() };
      setSessions([fresh]);
      setCurrentSessionId(fresh.id);
      dbManager.put('sessions', fresh).catch(console.error);
    } else {
      setSessions(newSessions);
      if (currentSessionId === id) setCurrentSessionId(newSessions[0].id);
    }
  };

  const updateCurrentSession = (updates: Partial<Session>) => {
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, ...updates } : s));
  };

  // Check model capabilities via /api/show
  const checkModelCapabilities = async (modelName: string) => {
    try {
      const response = await fetch(getApiUrl(endpoint, '/api/show'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName })
      });
      
      if (response.ok) {
        const data = await response.json();
        const caps = Array.isArray(data.capabilities) ? data.capabilities : [];
        console.log(`Model ${modelName} capabilities:`, caps);
        setModelCapabilities(caps);
      } else {
        console.warn(`Failed to get capabilities for ${modelName}: HTTP ${response.status}`);
        setModelCapabilities([]);
      }
    } catch (err) {
      console.warn('Failed to check model capabilities:', err);
      setModelCapabilities([]);
    } finally {
      setCapabilitiesChecked(true);
    }
  };

  const switchPersona = (type: PersonaType) => {
    const config = personaConfigs[type] || personaConfigs.default;
    setPersona(type);
    setSystemPrompt(config.systemPrompt);
    // Apply all persona params including optional num_predict
    setParams(prev => ({
      ...prev,
      ...config.params,
      // Use persona's num_predict if defined, otherwise keep current value
      num_predict: config.params.num_predict ?? prev.num_predict
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFileError(null);

    for (const file of files) {
      const ext = getFileExtension(file.name);
      const isImage = FILE_CONFIG.allowedImageTypes.includes(file.type) || file.type.startsWith('image/');
      const isAllowedText = FILE_CONFIG.allowedTextExtensions.includes(ext) ||
        FILE_CONFIG.allowedTextExtensions.includes(file.name);
      const isDocument = FILE_CONFIG.allowedDocExtensions.includes(ext);

      if (!isImage && !isAllowedText && !isDocument) {
        setFileError(`Unsupported file type: ${file.name}. Supported: images, code/text files, PDF, Word, Excel.`);
        continue;
      }

      if (isImage && file.size > FILE_CONFIG.maxImageSize) {
        setFileError(`Image too large: ${file.name} (${formatFileSize(file.size)}). Max: ${formatFileSize(FILE_CONFIG.maxImageSize)}`);
        continue;
      }

      if (isAllowedText && file.size > FILE_CONFIG.maxTextSize) {
        setFileError(`File too large: ${file.name} (${formatFileSize(file.size)}). Max: ${formatFileSize(FILE_CONFIG.maxTextSize)}`);
        continue;
      }

      if (isDocument && file.size > FILE_CONFIG.maxDocSize) {
        setFileError(`Document too large: ${file.name} (${formatFileSize(file.size)}). Max: ${formatFileSize(FILE_CONFIG.maxDocSize)}`);
        continue;
      }

      if (isDocument) {
        setProcessingFiles(prev => [...prev, file.name]);
        try {
          const result = await processDocument(file);
          const docInfo = result.type === 'pdf' ? `${result.pageCount} pages` :
            result.type === 'excel' ? `${result.sheetCount} sheets` : 'document';

          setAttachments(prev => [...prev, {
            type: 'document',
            content: result.text,
            name: file.name,
            size: file.size,
            ext: ext,
            docType: result.type,
            docInfo: docInfo
          }]);
        } catch (error) {
          setFileError((error as Error).message);
        } finally {
          setProcessingFiles(prev => prev.filter(name => name !== file.name));
        }
        continue;
      }

      if (isImage) {
        const reader = new FileReader();
        reader.onerror = () => setFileError(`Failed to read file: ${file.name}`);
        reader.onloadend = () => setAttachments(prev => [...prev, {
          type: 'image',
          content: reader.result as string,
          name: file.name,
          size: file.size
        }]);
        reader.readAsDataURL(file);
        continue;
      }

      if (isAllowedText) {
        const reader = new FileReader();
        reader.onerror = () => setFileError(`Failed to read file: ${file.name}`);
        reader.onloadend = () => setAttachments(prev => [...prev, {
          type: 'file',
          content: reader.result as string,
          name: file.name,
          size: file.size,
          ext: ext
        }]);
        reader.readAsText(file);
      }
    }
    e.target.value = '';
  };

  const pullModel = async (modelName: string) => {
    setPullProgress({ status: 'starting', completed: 0, total: 100 });
    try {
      const response = await fetch(getApiUrl(endpoint, '/api/pull'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true })
      });
      if (!response.body) throw new Error('No body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.status === 'success') {
              setPullProgress(null);
              checkConnection();
            } else if (json.completed && json.total) {
              setPullProgress({
                status: json.status,
                completed: json.completed,
                total: json.total,
                percent: Math.round((json.completed / json.total) * 100)
              });
            } else {
              setPullProgress(prev => ({ ...prev!, status: json.status }));
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setPullProgress({ status: 'Error: ' + (err as Error).message, error: true });
    }
  };

  // --- Voice & Speech ---

  const startListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser. Use Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript) setInput(interimTranscript);
        if (finalTranscript) {
          setInput(finalTranscript);
          if (voiceModeOpenRef.current) {
            handleSend(finalTranscript, true);
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (voiceModeOpenRef.current && !window.speechSynthesis.speaking) {
          setTimeout(() => {
            if (voiceModeOpenRef.current) startListening();
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

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const speakMessage = (text: string, msgIdx: number | null = null) => {
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/[#*`]/g, '')
      .slice(0, 500);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (msgIdx !== null) {
      if (speakingMsgId === msgIdx) {
        setSpeakingMsgId(null);
        return;
      }
      utterance.onend = () => setSpeakingMsgId(null);
      setSpeakingMsgId(msgIdx);
    } else if (voiceModeOpenRef.current) {
      utterance.onend = () => {
        if (voiceModeOpenRef.current) {
          setTimeout(() => startListening(), 300);
        }
      };
    }

    window.speechSynthesis.speak(utterance);
  };

  const startVoiceMode = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice mode requires Chrome, Edge, or Safari. Firefox is not supported.');
      return;
    }
    setVoiceModeOpen(true);
    setTimeout(() => startListening(), 100);
  };

  const endVoiceMode = () => {
    stopListening();
    window.speechSynthesis.cancel();
    setVoiceModeOpen(false);
    setSpeakingMsgId(null);
    setInput('');
  };

  const executeSlashCommand = (cmd: string) => {
    switch (cmd) {
      case '/clear':
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [] } : s));
        break;
      case '/reset':
        updateCurrentSession({ messages: [] });
        setAttachments([]);
        break;
      case '/save':
        exportChat();
        break;
      case '/new':
        createNewChat();
        break;
    }
    setInput('');
    setSlashCmdsVisible(false);
  };

  const exportChat = () => {
    const content = messages.map(m => `## ${m.role.toUpperCase()}\n\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-${currentSession.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper: Execute a chat request with optional tools
  const executeChat = async (
    chatMessages: Array<{ role: string; content: string; images?: string[]; tool_calls?: ToolCall[]; tool_name?: string }>,
    tools: ToolDefinition[] | undefined,
    signal: AbortSignal
  ): Promise<{ content: string; tool_calls?: ToolCall[]; done: boolean }> => {
    const options = {
      temperature: params.temperature,
      top_k: params.top_k,
      top_p: params.top_p,
      repeat_penalty: params.repeat_penalty,
      num_predict: params.num_predict,
      num_ctx: params.num_ctx,
      ...(params.seed !== -1 && { seed: params.seed }),
      ...(params.mirostat > 0 && {
        mirostat: params.mirostat,
        mirostat_tau: params.mirostat_tau,
        mirostat_eta: params.mirostat_eta
      }),
      ...(params.num_gpu !== -1 && { num_gpu: params.num_gpu }),
      ...(params.num_thread > 0 && { num_thread: params.num_thread })
    };

    const response = await fetch(getApiUrl(endpoint, '/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        messages: chatMessages,
        stream: false, // Non-streaming for tool calls
        options,
        ...(tools && tools.length > 0 && { tools })
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return {
      content: json.message?.content || '',
      tool_calls: json.message?.tool_calls,
      done: json.done ?? true
    };
  };

  // Helper: Stream a chat response (no tools, for final response)
  const streamChat = async (
    chatMessages: Array<{ role: string; content: string; images?: string[]; tool_calls?: ToolCall[]; tool_name?: string }>,
    startTime: number,
    updatedMessages: Message[],
    isVoice: boolean,
    contentPrefix = ''
  ) => {
    const options = {
      temperature: params.temperature,
      top_k: params.top_k,
      top_p: params.top_p,
      repeat_penalty: params.repeat_penalty,
      num_predict: params.num_predict,
      num_ctx: params.num_ctx,
      ...(params.seed !== -1 && { seed: params.seed }),
      ...(params.mirostat > 0 && {
        mirostat: params.mirostat,
        mirostat_tau: params.mirostat_tau,
        mirostat_eta: params.mirostat_eta
      }),
      ...(params.num_gpu !== -1 && { num_gpu: params.num_gpu }),
      ...(params.num_thread > 0 && { num_thread: params.num_thread })
    };

    const response = await fetch(getApiUrl(endpoint, '/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        messages: chatMessages,
        stream: true,
        options
      }),
      signal: abortControllerRef.current?.signal
    });

    if (!response.body) throw new Error('No response body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    updateCurrentSession({
      messages: [...updatedMessages, { role: 'assistant', content: contentPrefix, timing: '0', tokenSpeed: '0' }]
    });

    let tokens = 0;
    let finalContent = contentPrefix;

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

            setSessions(prev => prev.map(s => {
              if (s.id === currentSessionId) {
                const newMsgs = s.messages.slice(0, -1);
                const newAssistantMsg: Message = {
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
        } catch (e) { /* ignore parse errors */ }
      }
    }
    return finalContent;
  };

  const handleSend = async (overrideInput: string | null = null, isVoice = false) => {
    const txt = overrideInput || input;
    if (txt.startsWith('/')) {
      executeSlashCommand(txt.trim());
      return;
    }
    if ((!txt.trim() && attachments.length === 0) || !selectedModel) return;

    const images = attachments.filter(a => a.type === 'image').map(a => a.content.split(',')[1]);
    const fileContexts = attachments.filter(a => a.type === 'file').map(a => `\n--- FILE: ${a.name} ---\n${a.content}\n--- END FILE ---\n`).join('');
    const docContexts = attachments.filter(a => a.type === 'document').map(a => `\n--- DOCUMENT: ${a.name} (${a.docInfo}) ---\n${a.content}\n--- END DOCUMENT ---\n`).join('');

    const knowledgeContext = knowledgeBase
      .filter(k => activeKnowledgeIds.includes(k.id))
      .map(k => `\n--- KNOWLEDGE: ${k.title} ---\n${k.content}\n`).join('');

    const fullContent = txt + fileContexts + docContexts + knowledgeContext;
    const userMsg: Message = {
      role: 'user',
      content: fullContent,
      displayContent: txt,
      images: images,
      attachments: attachments
    };

    const startTime = Date.now();
    const updatedMessages = [...messages, userMsg];
    updateCurrentSession({ messages: updatedMessages });

    if (messages.length === 0) {
      const title = txt.slice(0, 30) + (txt.length > 30 ? '...' : '');
      updateCurrentSession({ title });
    }

    setInput('');
    setAttachments([]);
    setStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      // Determine if model supports tools based on capabilities check
      const modelSupportsTools = modelCapabilities.includes('tools');
      
      // Only use tools if: enabled globally AND (model confirmed to support OR capabilities not yet checked)
      const shouldTryTools = toolsEnabled && (modelSupportsTools || !capabilitiesChecked);
      const tools = shouldTryTools ? toolRegistry.getToolDefinitions() : [];
      
      // Build enhanced system prompt with context-aware hints
      let enhancedSystemPrompt = systemPrompt;
      const hints = currentPersonaConfig.contextHints;
      
      // Add context-aware hints based on current state
      if (hints) {
        const contextAdditions: string[] = [];
        
        // Knowledge base context
        if (knowledgeBase.length > 0 && shouldTryTools) {
          if (hints.withKnowledgeBase) {
            contextAdditions.push(hints.withKnowledgeBase);
          }
          const kbContext = `The user has uploaded ${knowledgeBase.length} document(s): ${knowledgeBase.map(k => `"${k.title}"`).join(', ')}.`;
          contextAdditions.push(kbContext);
        }
        
        // Attachment context - check current message attachments
        const msgAttachments = userMsg.attachments || [];
        const hasCodeAttachments = msgAttachments.some((a: Attachment) => 
          a.type === 'file' && /\.(js|jsx|ts|tsx|py|java|c|cpp|go|rs|rb|php|swift|kt)$/i.test(a.name)
        );
        const hasDocAttachments = msgAttachments.some((a: Attachment) => 
          a.type === 'document' || (a.type === 'file' && /\.(md|txt|json|yaml|yml)$/i.test(a.name))
        );
        
        if (hasCodeAttachments && hints.withCodeAttachments) {
          contextAdditions.push(hints.withCodeAttachments);
        }
        if (hasDocAttachments && hints.withDocAttachments) {
          contextAdditions.push(hints.withDocAttachments);
        }
        
        // Long conversation context
        if (updatedMessages.length > 10 && hints.longConversation) {
          contextAdditions.push(hints.longConversation);
        }
        
        // Append all context additions
        if (contextAdditions.length > 0) {
          enhancedSystemPrompt += '\n\n**Context:**\n- ' + contextAdditions.join('\n- ');
        }
      } else if (knowledgeBase.length > 0 && shouldTryTools) {
        // Fallback for personas without contextHints defined
        const kbContext = `\n\n**IMPORTANT - Knowledge Base Available:** The user has uploaded ${knowledgeBase.length} document(s) to their personal knowledge base: ${knowledgeBase.map(k => `"${k.title}"`).join(', ')}. When the user asks about their documents, files, data, transactions, statements, or any personal/uploaded content, you MUST use the rag_search tool FIRST to search their knowledge base. Do NOT make up information - always search first.`;
        enhancedSystemPrompt += kbContext;
      }
      
      // Apply context management - trim messages if context is too large
      const contextResult = manageContext(
        enhancedSystemPrompt,
        updatedMessages.map(m => ({ role: m.role, content: m.content, images: m.images })),
        {
          maxContextTokens: params.num_ctx,      // Total context window
          reserveForResponse: params.num_predict, // Reserve for response
          keepFirstMessages: 2,  // Keep initial context
          keepLastMessages: 12   // Keep recent conversation
        }
      );
      
      // Log context management info (for debugging)
      if (contextResult.trimmedCount > 0) {
        console.log(`Context management: Trimmed ${contextResult.trimmedCount} messages to fit context window`);
      }
      
      // Build chat messages for API with managed context
      let chatMessages: Array<{ role: string; content: string; images?: string[]; tool_calls?: ToolCall[]; tool_name?: string }> = [
        { role: 'system', content: enhancedSystemPrompt },
        ...contextResult.messages
      ];
      
      // Show warning if context is still too large
      if (contextResult.warning) {
        console.warn('Context warning:', contextResult.warning);
      }

      // If tools are enabled but model confirmed NOT to support them, show notice
      if (toolsEnabled && capabilitiesChecked && !modelSupportsTools && toolRegistry.getToolDefinitions().length > 0) {
        const toolNotice = '⚠️ **Note:** This model does not support tool calling. Responding without tools.\n\n---\n\n';
        await streamChat(chatMessages, startTime, updatedMessages, isVoice, toolNotice);
        return;
      }

      // If tools are enabled and model supports them, use tool calling flow
      if (tools.length > 0) {
        let maxIterations = 5; // Prevent infinite loops
        let iteration = 0;
        let toolsSupported = true;
        
        while (iteration < maxIterations && toolsSupported) {
          iteration++;
          
          // Show indicator when checking for tool calls (iteration > 1 means we're processing tool results)
          if (iteration > 1) {
            setExecutingTools(true);
          }
          
          try {
            const result = await executeChat(chatMessages, tools, abortControllerRef.current!.signal);
            
            // Check if model wants to use tools (either via tool_calls or JSON in content)
            let toolCalls = result.tool_calls || [];
            
            // Some models output tool calls as JSON in content instead of using tool_calls
            if (toolCalls.length === 0 && result.content) {
              const jsonMatch = result.content.match(/\{\s*"name"\s*:\s*"(\w+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}/s);
              if (jsonMatch) {
                try {
                  const toolName = jsonMatch[1];
                  const toolArgs = JSON.parse(jsonMatch[2]);
                  // Verify this is a known tool
                  if (tools.some(t => t.function.name === toolName)) {
                    toolCalls = [{
                      type: 'function' as const,
                      function: { name: toolName, arguments: toolArgs }
                    }];
                    console.log(`Parsed JSON tool call from content: ${toolName}`);
                  }
                } catch (parseErr) {
                  console.warn('Failed to parse JSON tool call from content:', parseErr);
                }
              }
            }
            
            if (toolCalls.length > 0) {
              setExecutingTools(true);
              
              // Add assistant message with tool calls to chat history
              chatMessages.push({
                role: 'assistant',
                content: result.content || '',
                tool_calls: toolCalls
              });
              
              // Execute all tool calls
              const toolResults = await toolRegistry.executeToolCalls(toolCalls);
              
              // Add tool results to chat history
              for (const toolResult of toolResults) {
                chatMessages.push({
                  role: 'tool',
                  tool_name: toolResult.name,
                  content: toolResult.result
                });
              }
              
              // Keep executingTools true - we'll loop and continue
              // Continue loop to get next response
            } else {
              // No tool calls, we have the final response
              setExecutingTools(false);
              
              // Update with the final content
              const elapsed = (Date.now() - startTime) / 1000;
              const finalMsg: Message = {
                role: 'assistant',
                content: result.content,
                timing: elapsed.toFixed(1),
                tokenSpeed: '—' // Non-streaming doesn't give token count
              };
              
              updateCurrentSession({
                messages: [...updatedMessages, finalMsg]
              });
              
              setStreaming(false);
              abortControllerRef.current = null;
              lastAssistantResponseRef.current = result.content;
              if (isVoice) speakMessage(result.content);
              break;
            }
          } catch (toolErr) {
            // Check if model doesn't support tools (400 Bad Request) - fallback in case capabilities check missed it
            const errMsg = (toolErr as Error).message;
            if (errMsg.includes('400') || errMsg.toLowerCase().includes('bad request')) {
              console.warn('Model does not support tool calling, falling back to streaming mode');
              toolsSupported = false;
              setExecutingTools(false);
              // Fall through to streaming mode below
            } else {
              // Re-throw other errors
              throw toolErr;
            }
          }
        }
        
        // If tools weren't supported (runtime error), fall back to streaming with a notice
        if (!toolsSupported) {
          // Reset chat messages (remove any tool-related messages)
          chatMessages = [
            { role: 'system', content: systemPrompt },
            ...updatedMessages.map(m => ({ role: m.role, content: m.content, images: m.images }))
          ];
          
          // Stream the response with a notice about tool limitation
          const toolNotice = '⚠️ **Note:** This model does not support tool calling. Responding without tools.\n\n---\n\n';
          await streamChat(chatMessages, startTime, updatedMessages, isVoice, toolNotice);
        }
      } else {
        // No tools, use streaming as before
        await streamChat(chatMessages, startTime, updatedMessages, isVoice);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSessions(prev => prev.map(s =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, { role: 'assistant', content: `**Error:** ${(err as Error).message}` }] }
            : s
        ));
      }
      setStreaming(false);
      setExecutingTools(false);
    }
  };

  const addKnowledge = (title: string, content: string, metadata?: Partial<KnowledgeEntry>) => {
    setKnowledgeBase([...knowledgeBase, { 
      id: Date.now(), 
      title, 
      content,
      ...metadata 
    }]);
  };

  const toggleKnowledge = (id: number) => {
    setActiveKnowledgeIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleClearChats = async () => {
    if (confirm('Clear all chat history? This cannot be undone.')) {
      await dbManager.clear('sessions');
      const fresh: Session = { id: Date.now(), title: 'New Chat', messages: [], model: '', date: Date.now() };
      setSessions([fresh]);
      setCurrentSessionId(fresh.id);
      await dbManager.put('sessions', fresh);
      const info = await dbManager.getStorageEstimate();
      setStorageInfo(info);
    }
  };

  const refreshStorage = async () => {
    const info = await dbManager.getStorageEstimate();
    setStorageInfo(info);
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex h-full bg-theme-bg-primary text-theme-text-primary items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-theme-text-muted">Loading Neural Nexus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-theme-bg-primary text-theme-text-primary font-sans overflow-hidden selection:bg-indigo-500/30">
      {/* Sidebar */}
      {!zenMode && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={(id) => {
            setCurrentSessionId(id);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          onCreateNew={createNewChat}
          onDeleteSession={deleteSession}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedModel={selectedModel}
          onModelChange={(model) => updateCurrentSession({ model })}
          models={models}
          connectionStatus={connectionStatus}
          onOpenModelManager={() => setModelMgrOpen(true)}
          onOpenKnowledge={() => setKnowledgeOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative bg-theme-bg-primary">
        {/* Header */}
        {zenMode ? (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-mono ${
              connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </div>
            <Tooltip content="Exit Zen Mode" position="bottom">
              <button
                onClick={() => setZenMode(false)}
                className="p-2.5 bg-theme-bg-elevated/70 hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-primary rounded-full transition-all backdrop-blur-sm border border-theme-border-primary/50"
              >
                <X size={18} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="h-16 border-b border-theme-border-primary flex items-center justify-between px-4 md:px-6 bg-theme-bg-primary/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 hover:bg-theme-bg-elevated rounded-lg text-theme-text-muted">
                  <ChevronRight size={20} />
                </button>
              )}
              <div className="flex items-center gap-4">
                <h2 className="text-theme-text-primary font-medium text-sm md:text-base hidden md:block">{currentSession.title}</h2>
                {/* Persona Matrix */}
                <div className="bg-theme-bg-secondary p-1 rounded-lg border border-theme-border-secondary flex items-center gap-1">
                  {Object.entries(personaConfigs).map(([id, config]) => {
                    const Icon = config.icon;
                    const isActive = persona === id;
                    const colorClasses: Record<string, string> = {
                      indigo: isActive ? 'bg-indigo-600 text-white' : 'text-theme-text-muted hover:text-indigo-400 hover:bg-indigo-500/10',
                      emerald: isActive ? 'bg-emerald-600 text-white' : 'text-theme-text-muted hover:text-emerald-400 hover:bg-emerald-500/10',
                      purple: isActive ? 'bg-purple-600 text-white' : 'text-theme-text-muted hover:text-purple-400 hover:bg-purple-500/10',
                      amber: isActive ? 'bg-amber-600 text-white' : 'text-theme-text-muted hover:text-amber-400 hover:bg-amber-500/10'
                    };
                    return (
                      <Tooltip key={id} content={`${config.name} (Temp: ${config.params.temperature})`} position="bottom">
                        <button
                          onClick={() => switchPersona(id as PersonaType)}
                          className={`p-1.5 rounded transition-all ${colorClasses[config.color]} ${isActive ? 'shadow' : ''}`}
                        >
                          <Icon size={14} />
                        </button>
                      </Tooltip>
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
                {/* Context Usage Indicator */}
                {contextUsage && messages.length > 0 && (
                  <Tooltip 
                    content={`~${formatTokenCount(contextUsage.tokens)} tokens used of ${formatTokenCount(params.num_ctx)} context`} 
                    position="bottom"
                  >
                    <div className={`hidden lg:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full cursor-default ${
                      contextUsage.status === 'critical' ? 'bg-red-500/10 text-red-400' :
                      contextUsage.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-theme-bg-tertiary text-theme-text-muted'
                    }`}>
                      <div className="w-12 h-1.5 bg-theme-bg-elevated rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            contextUsage.status === 'critical' ? 'bg-red-500' :
                            contextUsage.status === 'warning' ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(contextUsage.percent, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono">{contextUsage.percent}%</span>
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="accent" onClick={startVoiceMode} icon={Phone} title="Omni-Voice Mode" tooltipPosition="bottom">
                <span className="hidden md:inline text-xs">Voice</span>
              </Button>
              <Button variant="ghost" onClick={() => setZenMode(true)} icon={Layout} title="Zen Mode" tooltipPosition="bottom" />
            </div>
          </div>
        )}

        {/* Chat Feed */}
        <div className={`flex-1 min-h-0 px-4 md:px-6 py-2 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent`}>
          {messages.length === 0 ? (
            <WelcomeScreen
              connectionStatus={connectionStatus}
              modelsCount={models.length}
              selectedModel={selectedModel}
              persona={persona}
              onSwitchPersona={switchPersona}
              onSetInput={setInput}
              onStartVoice={startVoiceMode}
              onOpenKnowledge={() => setKnowledgeOpen(true)}
              onOpenZen={() => setZenMode(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onRetryConnection={checkConnection}
            />
          ) : (
            messages.map((msg, idx) => (
              <ChatMessage
                key={idx}
                message={msg}
                index={idx}
                speakingMsgId={speakingMsgId}
                onSpeakMessage={speakMessage}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <ChatInput
          input={input}
          onInputChange={setInput}
          onSend={() => handleSend()}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          isListening={isListening}
          onToggleListening={() => {
            if (isListening) {
              stopListening();
            } else {
              startListening();
            }
          }}
          streaming={streaming}
          executingTools={executingTools}
          onStop={() => abortControllerRef.current?.abort()}
          selectedModel={selectedModel}
          slashCmdsVisible={slashCmdsVisible}
          onExecuteSlashCommand={executeSlashCommand}
          fileError={fileError}
          onClearFileError={() => setFileError(null)}
          processingFiles={processingFiles}
          onFileUpload={handleFileUpload}
        />
      </div>

      {/* Voice Mode Overlay */}
      <VoiceModeOverlay
        isOpen={voiceModeOpen}
        onClose={() => {
          setVoiceModeOpen(false);
          stopListening();
        }}
        isSpeaking={speakingMsgId !== null}
        isListening={isListening}
        transcript={input}
        lastResponse={lastAssistantResponseRef.current}
        onEndCall={endVoiceMode}
        onStartListening={startListening}
        onStopListening={stopListening}
      />

      {/* Modals - Lazily loaded */}
      <Suspense fallback={null}>
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          endpoint={endpoint}
          onEndpointChange={setEndpoint}
          onTestConnection={checkConnection}
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
          params={params}
          onParamsChange={setParams}
          storageInfo={storageInfo}
          onClearChats={handleClearChats}
          onRefreshStorage={refreshStorage}
          toolsEnabled={toolsEnabled}
          onToolsEnabledChange={(enabled) => {
            setToolsEnabled(enabled);
            localStorage.setItem('nexus_tools_global_enabled', JSON.stringify(enabled));
          }}
        />

        <ModelManagerModal
          isOpen={modelMgrOpen}
          onClose={() => setModelMgrOpen(false)}
          pullProgress={pullProgress}
          onPullModel={pullModel}
        />

        <KnowledgeBaseModal
          isOpen={knowledgeOpen}
          onClose={() => setKnowledgeOpen(false)}
          knowledgeBase={knowledgeBase}
          activeKnowledgeIds={activeKnowledgeIds}
          onToggleKnowledge={toggleKnowledge}
          onDeleteKnowledge={(id: number) => setKnowledgeBase(prev => prev.filter(k => k.id !== id))}
          onAddKnowledge={addKnowledge}
        />

        <HelpModal
          isOpen={helpOpen}
          onClose={() => setHelpOpen(false)}
        />
      </Suspense>
    </div>
  );
}
