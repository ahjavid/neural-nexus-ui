import React from 'react';
import { User, FileCode, PenTool, BarChart } from 'lucide-react';
import type { PersonaType, PersonaConfig } from '../types';

// Persona configurations
export const personaConfigs: Record<PersonaType, PersonaConfig> = {
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

interface PersonaSelectorProps {
  currentPersona: PersonaType;
  onSelect: (persona: PersonaType) => void;
  variant?: 'compact' | 'full';
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({ 
  currentPersona, 
  onSelect, 
  variant = 'compact' 
}) => {
  if (variant === 'compact') {
    return (
      <div className="bg-theme-bg-secondary p-1 rounded-lg border border-theme-border-secondary flex items-center gap-1">
        {Object.entries(personaConfigs).map(([id, config]) => {
          const Icon = config.icon;
          const isActive = currentPersona === id;
          const colorClasses: Record<string, string> = {
            indigo: isActive ? 'bg-indigo-600 text-white' : 'text-theme-text-muted hover:text-indigo-400 hover:bg-indigo-500/10',
            emerald: isActive ? 'bg-emerald-600 text-white' : 'text-theme-text-muted hover:text-emerald-400 hover:bg-emerald-500/10',
            purple: isActive ? 'bg-purple-600 text-white' : 'text-theme-text-muted hover:text-purple-400 hover:bg-purple-500/10',
            amber: isActive ? 'bg-amber-600 text-white' : 'text-theme-text-muted hover:text-amber-400 hover:bg-amber-500/10'
          };
          return (
            <button 
              key={id}
              onClick={() => onSelect(id as PersonaType)}
              className={`p-1.5 rounded transition-all ${colorClasses[config.color]} ${isActive ? 'shadow' : ''}`}
              title={`${config.name} (Temp: ${config.params.temperature})`}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    );
  }

  // Full variant for welcome screen
  return (
    <div className="grid grid-cols-4 gap-2">
      {Object.entries(personaConfigs).map(([id, config]) => {
        const Icon = config.icon;
        const isActive = currentPersona === id;
        const colorStyles: Record<string, { active: string; inactive: string; icon: string }> = {
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
            onClick={() => onSelect(id as PersonaType)}
            className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-300 ${
              isActive 
                ? `${style.active} text-white` 
                : `border-theme-border-primary bg-theme-bg-secondary/50 ${style.inactive}`
            }`}
          >
            <Icon size={18} className={isActive ? 'text-white' : style.icon} />
            <span className={`font-medium text-xs ${isActive ? 'text-white' : 'text-theme-text-secondary'}`}>
              {config.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};
