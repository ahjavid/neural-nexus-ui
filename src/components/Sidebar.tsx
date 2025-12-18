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
  SearchX,
  Cloud,
  Server,
  Users,
  Bot
} from 'lucide-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import type { Session, Model, ApiProvider, PeerReviewConfig } from '../types';

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
  apiProvider?: ApiProvider;
  // Agentic mode props
  agenticConfig?: PeerReviewConfig;
  onAgentModelChange?: (agentIdx: number, model: string) => void;
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
  onOpenSettings,
  apiProvider = 'ollama',
  agenticConfig,
  onAgentModelChange
}) => {
  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group sessions by time period
  const groupSessionsByDate = (sessions: Session[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = today - 30 * 24 * 60 * 60 * 1000;

    const groups: { [key: string]: Session[] } = {
      'Today': [],
      'Yesterday': [],
      'Last 7 Days': [],
      'Last 30 Days': [],
      'Older': []
    };

    sessions.forEach(session => {
      const sessionDate = new Date(session.date).setHours(0, 0, 0, 0);
      if (sessionDate >= today) {
        groups['Today'].push(session);
      } else if (sessionDate >= yesterday) {
        groups['Yesterday'].push(session);
      } else if (sessionDate >= weekAgo) {
        groups['Last 7 Days'].push(session);
      } else if (sessionDate >= monthAgo) {
        groups['Last 30 Days'].push(session);
      } else {
        groups['Older'].push(session);
      }
    });

    return groups;
  };

  const groupedSessions = groupSessionsByDate(filteredSessions);

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className={`sidebar-backdrop lg:hidden ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div className={`${isOpen ? 'w-[85vw] sm:w-80' : 'w-0'} transition-all duration-300 bg-theme-bg-primary border-r border-theme-border-primary flex flex-col shrink-0 fixed lg:relative z-30 overflow-hidden h-full`}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-theme-border-primary flex items-center justify-between bg-theme-bg-primary min-w-[280px] sm:min-w-[320px]">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Cpu size={20} className="text-indigo-400" /><span className="text-theme-text-primary">NEURAL </span><span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">NEXUS</span>
        </div>
        <button 
          onClick={onClose} 
          className="lg:hidden text-theme-text-muted p-2 -mr-2 hover:bg-theme-bg-elevated rounded-lg touch-target"
          aria-label="Close sidebar"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2 min-w-[280px] sm:min-w-[320px]">
        <button 
          onClick={onCreateNew} 
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-3 sm:p-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-theme-bg-primary touch-target"
        >
          <Plus size={18} /><span>New Session</span>
        </button>
        
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
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
      <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar momentum-scroll min-w-[280px] sm:min-w-[320px]">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-theme-text-muted">
            <SearchX size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No sessions found</p>
            {searchQuery && (
              <p className="text-xs text-theme-text-muted mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSessions).map(([period, periodSessions]) => {
              if (periodSessions.length === 0) return null;
              return (
                <div key={period} className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <h3 className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                      {period}
                    </h3>
                    <span className="text-[9px] font-medium text-theme-text-muted bg-theme-bg-secondary px-1.5 py-0.5 rounded">
                      {periodSessions.length}
                    </span>
                  </div>
                  {periodSessions.map((session) => {
                    const userMessages = session.messages.filter(m => m.role === 'user').length;
                    
                    return (
                      <div 
                        key={session.id} 
                        onClick={() => onSelectSession(session.id)}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectSession(session.id)}
                        className={`group flex items-start justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                          currentSessionId === session.id 
                            ? 'bg-theme-bg-secondary border-theme-border-secondary text-theme-text-primary' 
                            : 'border-transparent text-theme-text-muted hover:bg-theme-bg-secondary/70 hover:text-theme-text-secondary hover:border-theme-border-secondary/50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 overflow-hidden flex-1 min-w-0">
                          <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                            currentSessionId === session.id 
                              ? 'bg-theme-bg-tertiary' 
                              : 'bg-theme-bg-tertiary group-hover:bg-theme-bg-elevated'
                          }`}>
                            <MessageSquare 
                              size={14} 
                              className={currentSessionId === session.id ? "text-theme-text-primary" : "text-theme-text-muted"} 
                            />
                          </div>
                          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                            <span className="truncate text-sm font-medium leading-snug">
                              {session.title}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-theme-text-muted">
                              <span className="truncate">{session.model || 'No Model'}</span>
                              <span className="opacity-50">•</span>
                              <span className="shrink-0 flex items-center gap-0.5">
                                {userMessages} msg{userMessages !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Tooltip content="Delete session" position="left">
                          <button 
                            onClick={(e) => onDeleteSession(e, session.id)} 
                            className="p-1 rounded-md text-theme-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 shrink-0 ml-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 sm:p-4 border-t border-theme-border-primary bg-theme-bg-primary space-y-3 min-w-[280px] sm:min-w-[320px] safe-area-bottom">
        {/* Agentic Mode - Show 3 agent models */}
        {agenticConfig?.enabled ? (
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-purple-400" />
                <label className="text-[10px] uppercase font-bold text-purple-400">
                  Peer Review Mode
                </label>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                3 Agents
              </span>
            </div>
            <div className="space-y-1.5">
              {agenticConfig.agents.map((agent, idx) => (
                <div key={agent.id} className="flex items-center gap-2">
                  <Tooltip content={agent.name} position="right">
                    <Bot size={12} className={
                      idx === 0 ? 'text-blue-400' : 
                      idx === 1 ? 'text-green-400' : 'text-orange-400'
                    } />
                  </Tooltip>
                  <select 
                    value={agent.model} 
                    onChange={(e) => onAgentModelChange?.(idx, e.target.value)} 
                    className="flex-1 bg-theme-bg-secondary border border-theme-border-secondary text-theme-text-primary text-[11px] rounded-lg p-1.5 appearance-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all cursor-pointer"
                  >
                    <option value="" disabled>Select...</option>
                    {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Single Model - Original UI */
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-1.5">
                {apiProvider === 'groq' ? (
                  <Cloud size={12} className="text-purple-400" />
                ) : (
                  <Server size={12} className="text-indigo-400" />
                )}
                <label className="text-[10px] uppercase font-bold text-theme-text-muted">
                  {apiProvider === 'groq' ? 'Groq Model' : 'Ollama Model'}
                </label>
              </div>
              {apiProvider === 'ollama' && (
                <button 
                  onClick={onOpenModelManager} 
                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <DownloadCloud size={10} /> Install
                </button>
              )}
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
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Button variant="icon" onClick={onOpenKnowledge} title="Knowledge Base"><Database size={16} /></Button>
            <Button variant="icon" onClick={onOpenHelp} title="Shortcuts"><Keyboard size={16} /></Button>
            <Button variant="icon" onClick={onOpenSettings} title="Settings"><Settings size={16} /></Button>
          </div>
          <Tooltip 
            content={connectionStatus === 'connected' 
              ? `Connected to ${apiProvider === 'groq' ? 'Groq' : 'Ollama'}` 
              : connectionStatus === 'checking' 
              ? 'Connecting...' 
              : `Disconnected - Click Settings to configure ${apiProvider === 'groq' ? 'Groq API' : 'Ollama'}`
            }
            position="left"
          >
            <div 
              className={`w-2.5 h-2.5 rounded-full cursor-help transition-all ${
                connectionStatus === 'connected' 
                  ? 'bg-green-500 shadow-sm shadow-green-500/50' 
                  : connectionStatus === 'checking'
                  ? 'bg-amber-500 animate-pulse shadow-sm shadow-amber-500/50'
                  : 'bg-red-500 shadow-sm shadow-red-500/50'
              }`}
            />
          </Tooltip>
        </div>
      </div>
    </div>
    </>
  );
};
