import React from 'react';
import {
  Zap,
  Check,
  Brain,
  FileCode,
  PenTool,
  BarChart,
  Phone,
  Database,
  Layout,
  Settings,
  Keyboard
} from 'lucide-react';
import { personaConfigs } from './PersonaSelector';
import type { PersonaType } from '../types';

interface WelcomeScreenProps {
  connectionStatus: 'connected' | 'checking' | 'error' | 'disconnected';
  modelsCount: number;
  onRetryConnection: () => void;
  persona: PersonaType;
  onSwitchPersona: (persona: PersonaType) => void;
  onSetInput: (text: string) => void;
  selectedModel: string;
  onStartVoice: () => void;
  onOpenKnowledge: () => void;
  onOpenZen: () => void;
  onOpenSettings: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  connectionStatus,
  modelsCount,
  onRetryConnection,
  persona,
  onSwitchPersona,
  onSetInput,
  selectedModel,
  onStartVoice,
  onOpenKnowledge,
  onOpenZen,
  onOpenSettings
}) => {
  const suggestedPrompts = [
    { text: "Explain quantum computing simply", icon: Brain },
    { text: "Write a Python sorting function", icon: FileCode },
    { text: "Brainstorm creative ideas", icon: PenTool },
    { text: "Analyze pros and cons", icon: BarChart }
  ];

  const quickActions = [
    { icon: Phone, title: "Voice", action: onStartVoice },
    { icon: Database, title: "Knowledge", action: onOpenKnowledge },
    { icon: Layout, title: "Zen", action: onOpenZen },
    { icon: Settings, title: "Settings", action: onOpenSettings }
  ];

  return (
    <div className="min-h-full flex flex-col items-center justify-start py-8 md:py-12 text-gray-500 px-4">
      {/* Hero Section */}
      <div className="relative mb-6 flex-shrink-0">
        {/* Animated glow background */}
        <div className="absolute inset-0 -m-8 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
        
        {/* Main Logo Container */}
        <div className="relative">
          {/* Outer rotating ring */}
          <div className="absolute -inset-3 rounded-full border-2 border-dashed border-indigo-500/30 animate-[spin_12s_linear_infinite]"></div>
          {/* Middle ring */}
          <div className="absolute -inset-1.5 rounded-full border border-purple-500/20 animate-[spin_8s_linear_infinite_reverse]"></div>
          {/* Inner circle with icon */}
          <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-indigo-900/80 to-purple-900/80 flex items-center justify-center border border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
            <Zap size={28} className="text-indigo-400" />
          </div>
        </div>
      </div>
      
      {/* Brand Text */}
      <h1 className="text-2xl md:text-3xl font-extralight tracking-tight text-white mb-1 flex-shrink-0">
        NEURAL <span className="font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">NEXUS</span>
      </h1>
      <p className="text-[10px] text-gray-500 mb-4 tracking-[0.25em] uppercase flex-shrink-0">Your Local AI Companion</p>
      
      {/* Connection Status Banner */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 transition-all flex-shrink-0 ${
        connectionStatus === 'connected' 
          ? 'bg-emerald-500/10 border border-emerald-500/30' 
          : connectionStatus === 'checking'
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'bg-red-500/10 border border-red-500/30'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 
          connectionStatus === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
        }`}></div>
        <span className={`text-xs font-medium ${
          connectionStatus === 'connected' ? 'text-emerald-400' : 
          connectionStatus === 'checking' ? 'text-amber-400' : 'text-red-400'
        }`}>
          {connectionStatus === 'connected' ? `Connected • ${modelsCount} model${modelsCount !== 1 ? 's' : ''}` :
           connectionStatus === 'checking' ? 'Connecting...' : 'Not connected'}
        </span>
        {connectionStatus === 'error' && (
          <button 
            onClick={onRetryConnection} 
            className="ml-1 text-[10px] text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Retry
          </button>
        )}
      </div>
      
      {/* Persona Selection - Enhanced Cards */}
      <div className="w-full max-w-xl mb-6 flex-shrink-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 text-center font-medium">Choose Mode</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(personaConfigs) as [PersonaType, typeof personaConfigs[PersonaType]][]).map(([id, config]) => {
            const Icon = config.icon;
            const isActive = persona === id;
            const colorStyles = {
              indigo: { 
                active: 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-500 shadow-lg shadow-indigo-500/25', 
                inactive: 'hover:border-indigo-500/50 hover:bg-indigo-500/5',
                icon: 'text-indigo-400'
              },
              emerald: { 
                active: 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 shadow-lg shadow-emerald-500/25', 
                inactive: 'hover:border-emerald-500/50 hover:bg-emerald-500/5',
                icon: 'text-emerald-400'
              },
              purple: { 
                active: 'bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500 shadow-lg shadow-purple-500/25', 
                inactive: 'hover:border-purple-500/50 hover:bg-purple-500/5',
                icon: 'text-purple-400'
              },
              amber: { 
                active: 'bg-gradient-to-br from-amber-600 to-amber-700 border-amber-500 shadow-lg shadow-amber-500/25', 
                inactive: 'hover:border-amber-500/50 hover:bg-amber-500/5',
                icon: 'text-amber-400'
              }
            };
            const style = colorStyles[config.color];
            return (
              <button
                key={id}
                onClick={() => onSwitchPersona(id)}
                className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-300 ${
                  isActive 
                    ? `${style.active} text-white` 
                    : `border-gray-800 bg-[#18181b]/50 ${style.inactive}`
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : style.icon} />
                <span className={`font-medium text-xs ${isActive ? 'text-white' : 'text-gray-300'}`}>{config.name}</span>
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                    <Check size={10} className="text-gray-900" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Suggested Prompts */}
      <div className="w-full max-w-xl mb-6 flex-shrink-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 text-center font-medium">Try asking</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSetInput(prompt.text)}
              disabled={connectionStatus !== 'connected' || !selectedModel}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#18181b]/30 border border-gray-800/50 hover:border-gray-700 hover:bg-[#18181b]/60 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <prompt.icon size={14} className="text-gray-500 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
              <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors flex-1 truncate">{prompt.text}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Quick Actions - Compact */}
      <div className="flex items-center gap-2 flex-wrap justify-center flex-shrink-0">
        {quickActions.map((item, i) => (
          <button 
            key={i} 
            onClick={item.action}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b]/40 border border-gray-800/50 hover:border-gray-700 rounded-lg transition-all hover:bg-[#18181b]/70 group text-xs"
          >
            <item.icon size={12} className="text-gray-500 group-hover:text-indigo-400 transition-colors" />
            <span className="text-gray-400 group-hover:text-gray-200">{item.title}</span>
          </button>
        ))}
      </div>
      
      {/* Keyboard Shortcut Hint */}
      <p className="text-[10px] text-gray-600 mt-4 flex items-center gap-1.5 flex-shrink-0">
        <Keyboard size={10} />
        Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400 font-mono text-[9px]">?</kbd> for shortcuts
      </p>
    </div>
  );
};
