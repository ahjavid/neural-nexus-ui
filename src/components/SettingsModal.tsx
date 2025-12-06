import React, { useState } from 'react';
import { Settings, X, RefreshCw, Sliders } from 'lucide-react';
import { Button } from './Button';
import type { ModelParams } from '../types';
import { formatBytes } from '../utils/helpers';

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
  onRefreshStorage
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (!isOpen) return null;

  const updateParam = (key: keyof ModelParams, value: number) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f1f23]">
          <h3 className="font-bold text-gray-200 flex items-center gap-2">
            <Settings size={18} /> Engine Configuration
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Endpoint */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ollama Endpoint</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={endpoint} 
                onChange={(e) => onEndpointChange(e.target.value)} 
                className="flex-1 bg-[#09090b] border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-indigo-300 focus:border-indigo-500 focus:outline-none" 
              />
              <Button variant="secondary" onClick={onTestConnection} icon={RefreshCw} title="Test" />
            </div>
          </div>
          
          {/* System Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">System Prompt</label>
            <textarea 
              value={systemPrompt} 
              onChange={(e) => onSystemPromptChange(e.target.value)} 
              className="w-full bg-[#09090b] border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none min-h-[100px] resize-y" 
            />
          </div>
          
          {/* Advanced Toggle */}
          <div className="pt-2 border-t border-gray-800">
            <button 
              onClick={() => setAdvancedOpen(!advancedOpen)} 
              className="flex items-center gap-2 text-sm text-indigo-400 font-medium hover:text-indigo-300"
            >
              <Sliders size={16} />{advancedOpen ? 'Hide Advanced' : 'Show Advanced'}
            </button>
          </div>
          
          {/* Advanced Settings */}
          {advancedOpen && (
            <div className="space-y-4 pt-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {/* Sampling Parameters */}
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Sampling</div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Temperature</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.temperature}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="0.1" 
                  value={params.temperature} 
                  onChange={(e) => updateParam('temperature', parseFloat(e.target.value))} 
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-gray-600 mt-1">Creativity level. Higher = more random.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Top P</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.top_p}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={params.top_p} 
                  onChange={(e) => updateParam('top_p', parseFloat(e.target.value))} 
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-gray-600 mt-1">Nucleus sampling threshold.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Top K</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.top_k}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  step="1" 
                  value={params.top_k} 
                  onChange={(e) => updateParam('top_k', parseInt(e.target.value))} 
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-gray-600 mt-1">Limits vocabulary to top K tokens.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Repeat Penalty</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.repeat_penalty}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="2" 
                  step="0.05" 
                  value={params.repeat_penalty} 
                  onChange={(e) => updateParam('repeat_penalty', parseFloat(e.target.value))} 
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-gray-600 mt-1">Penalizes repeated tokens.</p>
              </div>
              
              {/* Generation Limits */}
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pt-2 border-t border-gray-800">Generation</div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Max Tokens (num_predict)</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.num_predict}</span>
                </div>
                <input 
                  type="range" 
                  min="128" 
                  max="8192" 
                  step="128" 
                  value={params.num_predict} 
                  onChange={(e) => updateParam('num_predict', parseInt(e.target.value))} 
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-gray-600 mt-1">Maximum tokens to generate.</p>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Context Length (num_ctx)</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.num_ctx}</span>
                </div>
                <input 
                  type="range" 
                  min="512" 
                  max="32768" 
                  step="512" 
                  value={params.num_ctx} 
                  onChange={(e) => updateParam('num_ctx', parseInt(e.target.value))} 
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-gray-600 mt-1">Context window size.</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">Seed</label>
                <input 
                  type="number" 
                  value={params.seed} 
                  onChange={(e) => updateParam('seed', parseInt(e.target.value) || -1)} 
                  className="w-full bg-[#09090b] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300 focus:border-indigo-500 focus:outline-none" 
                />
                <p className="text-[10px] text-gray-600 mt-1">-1 for random. Fixed seed = reproducible output.</p>
              </div>
              
              {/* Mirostat */}
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pt-2 border-t border-gray-800">Mirostat</div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400">Mirostat Mode</label>
                  <span className="text-xs text-indigo-400 font-mono">{params.mirostat === 0 ? 'Off' : `v${params.mirostat}`}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="1" 
                  value={params.mirostat} 
                  onChange={(e) => updateParam('mirostat', parseInt(e.target.value))} 
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[10px] text-gray-600 mt-1">0=off, 1=Mirostat, 2=Mirostat 2.0</p>
              </div>
              
              {params.mirostat > 0 && (
                <>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-gray-400">Mirostat Tau</label>
                      <span className="text-xs text-indigo-400 font-mono">{params.mirostat_tau}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      step="0.1" 
                      value={params.mirostat_tau} 
                      onChange={(e) => updateParam('mirostat_tau', parseFloat(e.target.value))} 
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Target entropy (5.0 default).</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-gray-400">Mirostat Eta</label>
                      <span className="text-xs text-indigo-400 font-mono">{params.mirostat_eta}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={params.mirostat_eta} 
                      onChange={(e) => updateParam('mirostat_eta', parseFloat(e.target.value))} 
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Learning rate (0.1 default).</p>
                  </div>
                </>
              )}
              
              {/* Hardware */}
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pt-2 border-t border-gray-800">Hardware</div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">GPU Layers (num_gpu)</label>
                <input 
                  type="number" 
                  value={params.num_gpu} 
                  onChange={(e) => updateParam('num_gpu', parseInt(e.target.value) || -1)} 
                  className="w-full bg-[#09090b] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300 focus:border-indigo-500 focus:outline-none" 
                />
                <p className="text-[10px] text-gray-600 mt-1">-1 = auto, 0 = CPU only.</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">CPU Threads (num_thread)</label>
                <input 
                  type="number" 
                  value={params.num_thread} 
                  onChange={(e) => updateParam('num_thread', parseInt(e.target.value) || 0)} 
                  className="w-full bg-[#09090b] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300 focus:border-indigo-500 focus:outline-none" 
                />
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
                    className={`h-1.5 rounded-full transition-all ${
                      parseFloat(storageInfo.percent) > 80 ? 'bg-red-500' : 
                      parseFloat(storageInfo.percent) > 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(parseFloat(storageInfo.percent), 100)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Using IndexedDB for unlimited storage (browser-managed).</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={onClearChats}
                    className="flex-1 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded border border-red-500/30 transition-colors"
                  >
                    Clear All Chats
                  </button>
                  <button
                    onClick={onRefreshStorage}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded border border-gray-700 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              
              {/* Reset Button */}
              <button 
                onClick={() => onParamsChange(defaultParams)}
                className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded border border-gray-700 transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-800 bg-[#1f1f23] flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
