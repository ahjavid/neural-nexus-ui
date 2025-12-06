import React from 'react';
import { Database, X, Trash2, Check } from 'lucide-react';
import { Button } from './Button';
import type { KnowledgeEntry } from '../types';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBase: KnowledgeEntry[];
  activeKnowledgeIds: number[];
  onToggleKnowledge: (id: number) => void;
  onDeleteKnowledge: (id: number) => void;
  onAddKnowledge: (title: string, content: string) => void;
}

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  knowledgeBase,
  activeKnowledgeIds,
  onToggleKnowledge,
  onDeleteKnowledge,
  onAddKnowledge
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    
    if (title && content) {
      onAddKnowledge(title, content);
      form.reset();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f1f23]">
          <h3 className="font-bold text-gray-200 flex items-center gap-2">
            <Database size={18} /> Knowledge Base
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {knowledgeBase.length === 0 && (
            <p className="text-center text-gray-500 text-sm mt-10">No knowledge entries yet.</p>
          )}
          {knowledgeBase.map(k => (
            <div 
              key={k.id} 
              className="bg-[#09090b] border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors flex items-start gap-3"
            >
              <button 
                onClick={() => onToggleKnowledge(k.id)} 
                className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  activeKnowledgeIds.includes(k.id) 
                    ? 'bg-indigo-600 border-indigo-600' 
                    : 'border-gray-600 hover:border-gray-400'
                }`}
              >
                {activeKnowledgeIds.includes(k.id) && <Check size={12} className="text-white" />}
              </button>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-bold text-sm text-gray-200">{k.title}</h4>
                  <button 
                    onClick={() => onDeleteKnowledge(k.id)} 
                    className="text-gray-600 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 font-mono">{k.content}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-gray-800 bg-[#1f1f23]">
          <form onSubmit={handleSubmit} className="space-y-2">
            <input 
              name="title" 
              placeholder="Title (e.g., API Docs)" 
              className="w-full bg-[#09090b] border border-gray-700 rounded p-2 text-sm focus:border-indigo-500 focus:outline-none" 
              required 
            />
            <textarea 
              name="content" 
              placeholder="Content to inject..." 
              className="w-full bg-[#09090b] border border-gray-700 rounded p-2 text-sm h-20 resize-none focus:border-indigo-500 focus:outline-none" 
              required 
            />
            <Button type="submit" className="w-full">Add to Knowledge Base</Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;
