import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, X, RefreshCw, Sliders, Wrench, ToggleLeft, ToggleRight, Key, Database, ChevronDown, Loader2, Sun, Moon, Monitor, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import type { ModelParams } from '../types';
import { formatBytes, getApiUrl } from '../utils/helpers';
import { toolRegistry, setToolConfig, getToolConfigValue } from '../utils/tools';
import { downloadExport, readImportFile, importData, type ExportData } from '../utils/storage';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint: string;
  onEndpointChange: (endpoint: string) => void;
  onTestConnection: () => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  params: ModelParams;
  onParamsChange: (params: ModelParams) => void;
  storageInfo: { used: number; quota: number; percent: string };
  onClearChats: () => void;
  onRefreshStorage: () => void;
  toolsEnabled: boolean;
  onToolsEnabledChange: (enabled: boolean) => void;
}

const defaultParams: ModelParams = {
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
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  endpoint,
  onEndpointChange,
  onTestConnection,
  systemPrompt,
  onSystemPromptChange,
  params,
  onParamsChange,
  storageInfo,
  onClearChats,
  onRefreshStorage,
  toolsEnabled,
  onToolsEnabledChange
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [, forceUpdate] = useState({});
  const [tavilyApiKey, setTavilyApiKey] = useState(getToolConfigValue('tavilyApiKey') || '');
  const [embeddingModel, setEmbeddingModel] = useState(getToolConfigValue('embeddingModel') || 'mxbai-embed-large:latest');
  const [showApiKey, setShowApiKey] = useState(false);
  const [embeddingModels, setEmbeddingModels] = useState<string[]>([]);
  const [loadingEmbeddingModels, setLoadingEmbeddingModels] = useState(false);
  
  // Export/Import state
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{ sessions: number; knowledge: number; settings: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle export
  const handleExport = async () => {
    setExportStatus('exporting');
    try {
      await downloadExport({ includeSessions: true, includeKnowledge: true, includeSettings: true });
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (err) {
      console.error('Export failed:', err);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  // Handle import
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportStatus('importing');
    try {
      const data: ExportData = await readImportFile(file);
      const result = await importData(data, { 
        importSessions: true, 
        importKnowledge: true, 
        importSettings: true,
        mergeMode: 'merge'
      });
      setImportResult(result);
      setImportStatus('success');
      
      // Reload page to apply imported data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
    }
    
    // Reset file input
    e.target.value = '';
  };

  // Fetch embedding models from Ollama
  const fetchEmbeddingModels = useCallback(async () => {
    setLoadingEmbeddingModels(true);
    try {
      // First get all models
      const tagsRes = await fetch(getApiUrl(endpoint, '/api/tags'));
      if (!tagsRes.ok) throw new Error('Failed to fetch models');
      const tagsData = await tagsRes.json();
      const allModels = tagsData.models || [];

      // Check each model's capabilities to find embedding models
      const embeddingModelsList: string[] = [];
      for (const model of allModels) {
        try {
          const showRes = await fetch(getApiUrl(endpoint, '/api/show'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model.name })
          });
          if (showRes.ok) {
            const showData = await showRes.json();
            if (showData.capabilities?.includes('embedding')) {
              embeddingModelsList.push(model.name);
            }
          }
        } catch {
          // Skip models that fail to load
        }
      }
      setEmbeddingModels(embeddingModelsList);
    } catch (err) {
      console.error('Failed to fetch embedding models:', err);
    } finally {
      setLoadingEmbeddingModels(false);
    }
  }, [endpoint]);

  // Fetch embedding models when tools section is opened
  useEffect(() => {
    if (toolsOpen && embeddingModels.length === 0) {
      fetchEmbeddingModels();
    }
  }, [toolsOpen, embeddingModels.length, fetchEmbeddingModels]);

  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const updateParam = (key: keyof ModelParams, value: number) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-theme-bg-secondary border border-theme-border-primary rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-theme-border-primary flex justify-between items-center bg-theme-bg-tertiary">
          <h3 className="font-bold text-theme-text-primary flex items-center gap-2">
            <Settings size={18} /> Engine Configuration
          </h3>
          <button onClick={onClose} className="text-theme-text-muted hover:text-theme-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-lg p-1">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Endpoint */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Ollama Endpoint</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={endpoint} 
                onChange={(e) => onEndpointChange(e.target.value)} 
                className="flex-1 bg-theme-bg-primary border border-theme-border-secondary rounded-lg px-3 py-2 text-sm font-mono text-indigo-400 focus:border-indigo-500 focus:outline-none" 
              />
              <Button variant="secondary" onClick={onTestConnection} icon={RefreshCw} title="Test" />
            </div>
          </div>
          
          {/* System Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">System Prompt</label>
            <textarea 
              value={systemPrompt} 
              onChange={(e) => onSystemPromptChange(e.target.value)} 
              className="w-full bg-theme-bg-primary border border-theme-border-secondary rounded-lg p-3 text-sm text-theme-text-secondary focus:border-indigo-500 focus:outline-none min-h-[100px] resize-y" 
            />
          </div>

          {/* Theme Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Theme</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                  theme === 'light'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-theme-bg-primary border-theme-border-secondary text-theme-text-muted hover:border-theme-border-primary hover:text-theme-text-secondary'
                }`}
              >
                <Sun size={16} />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                    : 'bg-theme-bg-primary border-theme-border-secondary text-theme-text-muted hover:border-theme-border-primary hover:text-theme-text-secondary'
                }`}
              >
                <Moon size={16} />
                <span className="text-sm font-medium">Dark</span>
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                  theme === 'system'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-theme-bg-primary border-theme-border-secondary text-theme-text-muted hover:border-theme-border-primary hover:text-theme-text-secondary'
                }`}
              >
                <Monitor size={16} />
                <span className="text-sm font-medium">System</span>
              </button>
            </div>
          </div>
          
          {/* Advanced Toggle */}
          <div className="pt-2 border-t border-theme-border-primary">
            <button 
              onClick={() => setAdvancedOpen(!advancedOpen)} 
              className="flex items-center gap-2 text-sm text-indigo-400 font-medium hover:text-indigo-300"
            >
              <Sliders size={16} />{advancedOpen ? 'Hide Advanced' : 'Show Advanced'}
            </button>
          </div>
          
          {/* Tools Toggle */}
          <div className="pt-2 border-t border-theme-border-primary">
            <button 
              onClick={() => setToolsOpen(!toolsOpen)} 
              className="flex items-center gap-2 text-sm text-emerald-400 font-medium hover:text-emerald-300"
            >
              <Wrench size={16} />{toolsOpen ? 'Hide Tools' : 'Show Tools (Function Calling)'}
            </button>
          </div>
          
          {/* Tools Settings */}
          {toolsOpen && (
            <div className="space-y-4 pt-2">
              {/* Global Toggle */}
              <div className="flex items-center justify-between p-3 bg-theme-bg-primary rounded-lg border border-theme-border-primary">
                <div>
                  <div className="text-sm font-medium text-theme-text-primary">Enable Tool Calling</div>
                  <div className="text-[10px] text-theme-text-muted mt-0.5">Allow AI to use tools for enhanced capabilities</div>
                </div>
                <button
                  onClick={() => onToolsEnabledChange(!toolsEnabled)}
                  className={`transition-colors ${toolsEnabled ? 'text-emerald-400' : 'text-theme-text-muted'}`}
                >
                  {toolsEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
              
              {toolsEnabled && (
                <>
                  <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Available Tools</div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {toolRegistry.getAllTools().map((tool) => (
                      <div
                        key={tool.definition.function.name}
                        className={`p-3 rounded-lg border transition-colors ${
                          tool.enabled 
                            ? 'bg-emerald-500/10 border-emerald-500/30' 
                            : 'bg-theme-bg-primary border-theme-border-primary'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-mono text-theme-text-primary truncate">
                              {tool.definition.function.name}
                            </div>
                            <div className="text-[10px] text-theme-text-muted mt-1 line-clamp-2">
                              {tool.definition.function.description}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              toolRegistry.setToolEnabled(tool.definition.function.name, !tool.enabled);
                              toolRegistry.saveState();
                              forceUpdate({});
                            }}
                            className={`shrink-0 transition-colors ${
                              tool.enabled ? 'text-emerald-400' : 'text-theme-text-muted'
                            }`}
                          >
                            {tool.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-[10px] text-theme-text-muted bg-theme-bg-primary p-3 rounded-lg border border-theme-border-primary">
                    <strong className="text-theme-text-secondary">Note:</strong> Tool calling requires models that support function calling 
                    (e.g., qwen3, llama3.1+, mistral). When enabled, responses may be slightly slower as the AI 
                    decides whether to use tools.
                  </div>
                  
                  {/* API Keys and Settings */}
                  <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mt-4">Tool Configuration</div>
                  
                  {/* Tavily API Key */}
                  <div className="p-3 bg-theme-bg-primary rounded-lg border border-theme-border-primary space-y-2">
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-amber-400" />
                      <span className="text-xs font-medium text-theme-text-secondary">Tavily API Key (Enhanced Web Search)</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={tavilyApiKey}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTavilyApiKey(value);
                          setToolConfig('tavilyApiKey', value);
                        }}
                        placeholder="tvly-..."
                        className="flex-1 bg-theme-bg-secondary border border-theme-border-secondary rounded px-2 py-1.5 text-xs font-mono text-theme-text-secondary focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="px-2 text-xs text-theme-text-muted hover:text-theme-text-secondary"
                      >
                        {showApiKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-[10px] text-theme-text-muted">
                      Optional: Adds AI-powered web search. Without it, uses DuckDuckGo. Get free key at <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">tavily.com</a>
                    </p>
                  </div>
                  
                  {/* Embedding Model */}
                  <div className="p-3 bg-theme-bg-primary rounded-lg border border-theme-border-primary space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database size={14} className="text-purple-400" />
                        <span className="text-xs font-medium text-theme-text-secondary">Embedding Model (for RAG)</span>
                      </div>
                      <button
                        onClick={fetchEmbeddingModels}
                        disabled={loadingEmbeddingModels}
                        className="text-theme-text-muted hover:text-purple-400 transition-colors disabled:opacity-50"
                        title="Refresh embedding models"
                      >
                        {loadingEmbeddingModels ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={embeddingModel}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEmbeddingModel(value);
                          setToolConfig('embeddingModel', value);
                        }}
                        className="w-full bg-theme-bg-secondary border border-theme-border-secondary rounded px-2 py-1.5 text-xs font-mono text-theme-text-secondary focus:border-purple-500 focus:outline-none appearance-none cursor-pointer pr-8"
                      >
                        {embeddingModels.length === 0 && (
                          <option value={embeddingModel}>{embeddingModel}</option>
                        )}
                        {embeddingModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-theme-text-muted">
                      {embeddingModels.length > 0 
                        ? `${embeddingModels.length} embedding model${embeddingModels.length > 1 ? 's' : ''} available`
                        : 'Click refresh to load embedding models from Ollama'
                      }
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Advanced Settings */}
          {advancedOpen && (
            <div className="space-y-4 pt-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {/* Sampling Parameters */}
              <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Sampling</div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-theme-text-secondary">Temperature</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.temperature}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="0.1" 
                  value={params.temperature} 
                  onChange={(e) => updateParam('temperature', parseFloat(e.target.value))} 
                  className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">Creativity level. Higher = more random.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-theme-text-secondary">Top P</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.top_p}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={params.top_p} 
                  onChange={(e) => updateParam('top_p', parseFloat(e.target.value))} 
                  className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">Nucleus sampling threshold.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-theme-text-secondary">Top K</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.top_k}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  step="1" 
                  value={params.top_k} 
                  onChange={(e) => updateParam('top_k', parseInt(e.target.value))} 
                  className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">Limits vocabulary to top K tokens.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-theme-text-secondary">Repeat Penalty</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.repeat_penalty}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="2" 
                  step="0.05" 
                  value={params.repeat_penalty} 
                  onChange={(e) => updateParam('repeat_penalty', parseFloat(e.target.value))} 
                  className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">Penalizes repeated tokens.</p>
              </div>
              
              {/* Generation Limits */}
              <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider pt-2 border-t border-theme-border-primary">Generation</div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-theme-text-secondary">Max Tokens (num_predict)</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.num_predict}</span>
                </div>
                <input 
                  type="range" 
                  min="128" 
                  max="8192" 
                  step="128" 
                  value={params.num_predict} 
                  onChange={(e) => updateParam('num_predict', parseInt(e.target.value))} 
                  className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">Maximum tokens to generate.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-theme-text-secondary">Context Length (num_ctx)</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.num_ctx}</span>
                </div>
                <input 
                  type="range" 
                  min="512" 
                  max="32768" 
                  step="512" 
                  value={params.num_ctx} 
                  onChange={(e) => updateParam('num_ctx', parseInt(e.target.value))} 
                  className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">Context window size.</p>
              </div>
              
              <div>
                <label className="text-xs text-theme-text-secondary block mb-1">Seed</label>
                <input 
                  type="number" 
                  value={params.seed} 
                  onChange={(e) => updateParam('seed', parseInt(e.target.value) || -1)} 
                  className="w-full bg-theme-bg-primary border border-theme-border-secondary rounded px-3 py-1.5 text-sm font-mono text-theme-text-secondary focus:border-indigo-500 focus:outline-none" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">-1 for random. Fixed seed = reproducible output.</p>
              </div>
              
              {/* Mirostat */}
              <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider pt-2 border-t border-theme-border-primary">Mirostat</div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-theme-text-secondary">Mirostat Mode</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.mirostat === 0 ? 'Off' : `v${params.mirostat}`}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="1" 
                  value={params.mirostat} 
                  onChange={(e) => updateParam('mirostat', parseInt(e.target.value))} 
                  className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">0=off, 1=Mirostat, 2=Mirostat 2.0</p>
              </div>
              
              {params.mirostat > 0 && (
                <>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-theme-text-secondary">Mirostat Tau</label>
                      <span className="text-xs text-indigo-400 font-mono">{params.mirostat_tau}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      step="0.1" 
                      value={params.mirostat_tau} 
                      onChange={(e) => updateParam('mirostat_tau', parseFloat(e.target.value))} 
                      className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                    />
                    <p className="text-[10px] text-theme-text-muted mt-1">Target entropy (5.0 default).</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-theme-text-secondary">Mirostat Eta</label>
                      <span className="text-xs text-indigo-400 font-mono">{params.mirostat_eta}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={params.mirostat_eta} 
                      onChange={(e) => updateParam('mirostat_eta', parseFloat(e.target.value))} 
                      className="w-full h-1 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                    />
                    <p className="text-[10px] text-theme-text-muted mt-1">Learning rate (0.1 default).</p>
                  </div>
                </>
              )}
              
              {/* Hardware */}
              <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider pt-2 border-t border-theme-border-primary">Hardware</div>
              
              <div>
                <label className="text-xs text-theme-text-secondary block mb-1">GPU Layers (num_gpu)</label>
                <input 
                  type="number" 
                  value={params.num_gpu} 
                  onChange={(e) => updateParam('num_gpu', parseInt(e.target.value) || -1)} 
                  className="w-full bg-theme-bg-primary border border-theme-border-secondary rounded px-3 py-1.5 text-sm font-mono text-theme-text-secondary focus:border-indigo-500 focus:outline-none" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">-1 = auto, 0 = CPU only.</p>
              </div>
              
              <div>
                <label className="text-xs text-theme-text-secondary block mb-1">CPU Threads (num_thread)</label>
                <input 
                  type="number" 
                  value={params.num_thread} 
                  onChange={(e) => updateParam('num_thread', parseInt(e.target.value) || 0)} 
                  className="w-full bg-theme-bg-primary border border-theme-border-secondary rounded px-3 py-1.5 text-sm font-mono text-theme-text-secondary focus:border-indigo-500 focus:outline-none" 
                />
                <p className="text-[10px] text-theme-text-muted mt-1">0 = auto detect.</p>
              </div>
              
              {/* Storage Info */}
              <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider pt-2 border-t border-theme-border-primary">Storage</div>
              
              <div className="bg-theme-bg-primary rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-theme-text-secondary">Used</span>
                  <span className="text-indigo-400 font-mono">{formatBytes(storageInfo.used)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-theme-text-secondary">Available</span>
                  <span className="text-green-400 font-mono">{formatBytes(storageInfo.quota)}</span>
                </div>
                <div className="w-full bg-theme-bg-tertiary rounded-full h-1.5 mt-2">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      parseFloat(storageInfo.percent) > 80 ? 'bg-red-500' : 
                      parseFloat(storageInfo.percent) > 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(parseFloat(storageInfo.percent), 100)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-theme-text-muted mt-1">Using IndexedDB for unlimited storage (browser-managed).</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={onClearChats}
                    className="flex-1 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded border border-red-500/30 transition-colors"
                  >
                    Clear All Chats
                  </button>
                  <button
                    onClick={onRefreshStorage}
                    className="px-3 py-1.5 text-xs text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-tertiary rounded border border-theme-border-secondary transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              
              {/* Export/Import */}
              <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider pt-2 border-t border-theme-border-primary">Backup & Restore</div>
              
              <div className="bg-theme-bg-primary rounded-lg p-3 space-y-3">
                <p className="text-[10px] text-theme-text-muted">Export your sessions, knowledge base, and settings to a JSON file. Import to restore on any device.</p>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    disabled={exportStatus === 'exporting'}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded border transition-colors ${
                      exportStatus === 'success' 
                        ? 'text-green-400 border-green-500/30 bg-green-500/10'
                        : exportStatus === 'error'
                        ? 'text-red-400 border-red-500/30 bg-red-500/10'
                        : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border-indigo-500/30'
                    }`}
                  >
                    {exportStatus === 'exporting' ? (
                      <><Loader2 size={14} className="animate-spin" /> Exporting...</>
                    ) : exportStatus === 'success' ? (
                      <><Check size={14} /> Exported!</>
                    ) : exportStatus === 'error' ? (
                      <><AlertCircle size={14} /> Failed</>
                    ) : (
                      <><Download size={14} /> Export All</>
                    )}
                  </button>
                  
                  <button
                    onClick={handleImportClick}
                    disabled={importStatus === 'importing'}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded border transition-colors ${
                      importStatus === 'success' 
                        ? 'text-green-400 border-green-500/30 bg-green-500/10'
                        : importStatus === 'error'
                        ? 'text-red-400 border-red-500/30 bg-red-500/10'
                        : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30'
                    }`}
                  >
                    {importStatus === 'importing' ? (
                      <><Loader2 size={14} className="animate-spin" /> Importing...</>
                    ) : importStatus === 'success' ? (
                      <><Check size={14} /> Imported!</>
                    ) : importStatus === 'error' ? (
                      <><AlertCircle size={14} /> Failed</>
                    ) : (
                      <><Upload size={14} /> Import</>
                    )}
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                
                {importStatus === 'success' && importResult && (
                  <p className="text-[10px] text-green-400">
                    Imported {importResult.sessions} sessions, {importResult.knowledge} knowledge entries, {importResult.settings} settings. Reloading...
                  </p>
                )}
              </div>
              
              {/* Reset Button */}
              <button 
                onClick={() => onParamsChange(defaultParams)}
                className="w-full mt-2 py-2 text-xs text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-tertiary rounded border border-theme-border-secondary transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-theme-border-primary bg-theme-bg-tertiary flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
