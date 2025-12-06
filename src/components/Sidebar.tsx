import React from 'react';
import {
  Cpu,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Database,
  Keyboard,
  Settings,
  DownloadCloud,
  SearchX
} from 'lucide-react';
import { Button } from './Button';
import { formatRelativeDate } from '../utils/helpers';
import type { Session, Model } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  currentSessionId: number | null;
  onSelectSession: (id: number) => void;
  onCreateNew: () => void;
  onDeleteSession: (e: React.MouseEvent, id: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  models: Model[];
  connectionStatus: 'connected' | 'checking' | 'error' | 'disconnected';
  onOpenModelManager: () => void;
  onOpenKnowledge: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateNew,
  onDeleteSession,
  searchQuery,
  onSearchChange,
  selectedModel,
  onModelChange,
  models,
  connectionStatus,
  onOpenModelManager,
  onOpenKnowledge,
  onOpenHelp,
  onOpenSettings
}) => {
  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={`${isOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-theme-bg-primary border-r border-theme-border-primary flex flex-col shrink-0 relative z-30 overflow-hidden`}>
      {/* Header */}
      <div className="p-4 border-b border-theme-border-primary flex items-center justify-between bg-theme-bg-primary min-w-[320px]">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Cpu size={20} className="text-indigo-400" /><span className="text-theme-text-primary">NEURAL </span><span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">NEXUS</span>
        </div>
        <button 
          onClick={onClose} 
          className="lg:hidden text-theme-text-muted"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2 min-w-[320px]">
        <button 
          onClick={onCreateNew} 
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-theme-bg-primary"
        >
          <Plus size={18} /><span>New Session</span>
        </button>
        
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-theme-text-muted" />
          <input 
            type="text" 
            placeholder="Search history..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-theme-bg-secondary border border-theme-border-primary rounded-lg py-2 pl-9 pr-3 text-xs text-theme-text-secondary focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
          />
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar min-w-[320px]">
        <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-2 px-2">History</div>
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-theme-text-muted">
            <SearchX size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No sessions found</p>
            {searchQuery && (
              <p className="text-xs text-theme-text-muted mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div 
              key={session.id} 
              onClick={() => onSelectSession(session.id)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectSession(session.id)}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                currentSessionId === session.id 
                  ? 'bg-theme-bg-secondary border-theme-border-secondary text-theme-text-primary shadow-sm' 
                  : 'text-theme-text-muted hover:bg-theme-bg-secondary/50 hover:text-theme-text-secondary'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare 
                  size={16} 
                  className={currentSessionId === session.id ? "text-indigo-400" : "text-theme-text-muted"} 
                />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium">{session.title}</span>
                  <span className="text-[10px] text-theme-text-muted truncate">
                    {formatRelativeDate(session.date)} • {session.model || 'No Model'}
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => onDeleteSession(e, session.id)} 
                className="p-1.5 rounded-md text-theme-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                title="Delete session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-theme-border-primary bg-theme-bg-primary space-y-3 min-w-[320px]">
        <div>
          <div className="flex justify-between items-end mb-1">
            <label className="text-[10px] uppercase font-bold text-theme-text-muted">Active Model</label>
            <button 
              onClick={onOpenModelManager} 
              className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
            >
              <DownloadCloud size={10} /> Install
            </button>
          </div>
          <div className="relative">
            <select 
              value={selectedModel} 
              onChange={(e) => onModelChange(e.target.value)} 
              className="w-full bg-theme-bg-secondary border border-theme-border-secondary text-theme-text-primary text-sm rounded-lg p-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all cursor-pointer"
            >
              <option value="" disabled>Select a model...</option>
              {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3 text-theme-text-muted pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Button variant="icon" onClick={onOpenKnowledge} title="Knowledge Base"><Database size={16} /></Button>
            <Button variant="icon" onClick={onOpenHelp} title="Shortcuts"><Keyboard size={16} /></Button>
            <Button variant="icon" onClick={onOpenSettings} title="Settings"><Settings size={16} /></Button>
          </div>
          <div 
            className={`w-2.5 h-2.5 rounded-full cursor-help transition-all ${
              connectionStatus === 'connected' 
                ? 'bg-green-500 shadow-sm shadow-green-500/50' 
                : connectionStatus === 'checking'
                ? 'bg-amber-500 animate-pulse shadow-sm shadow-amber-500/50'
                : 'bg-red-500 shadow-sm shadow-red-500/50'
            }`}
            title={connectionStatus === 'connected' 
              ? 'Connected to Ollama' 
              : connectionStatus === 'checking' 
              ? 'Connecting...' 
              : 'Disconnected - Click Settings to configure'
            }
          />
        </div>
      </div>
    </div>
  );
};
