import React, { useRef } from 'react';
import {
  Plus,
  Mic,
  MicOff,
  Send,
  Square,
  X,
  AlertTriangle,
  FileCode,
  FileText,
  FileSpreadsheet,
  Loader2,
  Wrench
} from 'lucide-react';
import type { Attachment } from '../types';
import { formatFileSize } from '../utils/helpers';

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  isListening: boolean;
  onToggleListening: () => void;
  streaming: boolean;
  executingTools?: boolean;
  onStop: () => void;
  selectedModel: string;
  slashCmdsVisible: boolean;
  onExecuteSlashCommand: (cmd: string) => void;
  fileError: string | null;
  onClearFileError: () => void;
  processingFiles: string[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onInputChange,
  onSend,
  attachments,
  onAttachmentsChange,
  isListening,
  onToggleListening,
  streaming,
  executingTools = false,
  onStop,
  selectedModel,
  slashCmdsVisible,
  onExecuteSlashCommand,
  fileError,
  onClearFileError,
  processingFiles,
  onFileUpload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  const getFileIcon = (att: Attachment) => {
    if (att.type === 'image') return null;
    if (att.type === 'document') {
      if (att.docType === 'pdf') return <FileText size={16} className="text-red-400" />;
      if (att.docType === 'word') return <FileText size={16} className="text-blue-400" />;
      if (att.docType === 'excel') return <FileSpreadsheet size={16} className="text-green-400" />;
    }
    return <FileCode size={16} className="text-gray-400" />;
  };

  const getFileBackground = (att: Attachment) => {
    if (att.docType === 'pdf') return 'bg-red-900/30';
    if (att.docType === 'word') return 'bg-blue-900/30';
    if (att.docType === 'excel') return 'bg-green-900/30';
    return 'bg-gray-800';
  };

  return (
    <div className="px-4 md:px-6 py-3 bg-theme-bg-primary">
      <div className="max-w-4xl mx-auto relative">
        {/* File Error Alert */}
        {fileError && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-300 flex-1">{fileError}</span>
            <button onClick={onClearFileError} className="text-red-400 hover:text-red-300">
              <X size={16} />
            </button>
          </div>
        )}
        
        {/* Attachments Preview */}
        {(attachments.length > 0 || processingFiles.length > 0) && (
          <div className={`absolute bottom-full left-0 ${fileError ? 'mb-16' : 'mb-4'} flex gap-2 overflow-x-auto max-w-full p-2 animate-in slide-in-from-bottom-2`}>
            {/* Processing files indicator */}
            {processingFiles.map((name, i) => (
              <div key={`processing-${i}`} className="bg-theme-bg-secondary border border-indigo-500/50 rounded-lg p-2 flex items-center gap-3 min-w-[140px] shadow-xl">
                <div className="h-8 w-8 bg-indigo-900/50 rounded flex items-center justify-center">
                  <Loader2 size={16} className="text-indigo-400 animate-spin" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-theme-text-secondary truncate max-w-[100px]">{name}</span>
                  <span className="text-[10px] text-indigo-400">Processing...</span>
                </div>
              </div>
            ))}
            {/* Attached files */}
            {attachments.map((att, i) => (
              <div key={i} className="bg-theme-bg-secondary border border-theme-border-secondary rounded-lg p-2 flex items-center gap-3 min-w-[120px] shadow-xl">
                {att.type === 'image' ? (
                  <img src={att.content} alt="Preview" className="h-8 w-8 object-cover rounded" />
                ) : (
                  <div className={`h-8 w-8 rounded flex items-center justify-center ${getFileBackground(att)}`}>
                    {getFileIcon(att)}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs text-theme-text-secondary truncate max-w-[100px]">{att.name}</span>
                  <span className="text-[10px] text-theme-text-muted">
                    {att.docInfo || formatFileSize(att.size)}
                  </span>
                </div>
                <button 
                  onClick={() => removeAttachment(i)} 
                  className="hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Slash Commands */}
        {slashCmdsVisible && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-theme-bg-secondary border border-theme-border-secondary rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-3 py-2 text-[10px] font-bold text-theme-text-muted uppercase">Commands</div>
            {['/clear', '/reset', '/save', '/new'].map(cmd => (
              <button 
                key={cmd} 
                onClick={() => onExecuteSlashCommand(cmd)} 
                className="w-full text-left px-4 py-2 text-sm text-theme-text-secondary hover:bg-indigo-600 hover:text-white transition-colors font-mono"
              >
                {cmd}
              </button>
            ))}
          </div>
        )}

        {/* Input Container */}
        <div className={`relative bg-theme-bg-secondary rounded-xl flex items-end p-2 border transition-colors shadow-2xl ${
          streaming ? 'border-indigo-500/30' : 'border-theme-border-secondary hover:border-theme-border-primary'
        }`}>
          <div className="pb-1 pl-1 flex flex-col gap-1">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onFileUpload} 
              className="hidden" 
              multiple 
              accept="image/*,.txt,.md,.rmd,.markdown,.json,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.scala,.html,.css,.scss,.sass,.less,.sql,.sh,.bash,.yaml,.yml,.toml,.xml,.csv,.tsv,.log,.env,.conf,.config,.ini,.r,.R,.jl,.lua,.pl,.ipynb,.tex,.bib,.rst,.zig,.ex,.exs,.hs,.ml,.clj,.vim,.fish,.pdf,.docx,.doc,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={streaming || !selectedModel} 
              className="p-2 text-theme-text-muted hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" 
              title="Attach"
            >
              <Plus size={20} />
            </button>
            <button 
              onClick={onToggleListening} 
              disabled={streaming || !selectedModel} 
              className={`p-2 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                isListening 
                  ? 'text-red-400 bg-red-500/10 animate-pulse' 
                  : 'text-theme-text-muted hover:text-green-400 hover:bg-green-500/10'
              }`} 
              title="Voice"
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>

          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Message... (Type / for commands)"}
            disabled={!selectedModel || streaming}
            className="w-full bg-transparent text-theme-text-primary p-3 max-h-40 min-h-[50px] resize-none outline-none border-none placeholder-theme-text-muted disabled:cursor-not-allowed text-sm md:text-base scrollbar-hide"
            style={{ boxShadow: 'none' }}
            rows={1}
            onInput={handleTextareaInput}
          />
          
          <div className="pb-1 pr-1 flex items-center gap-2">
            {executingTools && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/30 animate-pulse">
                <Wrench size={14} className="text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-medium">Using tools...</span>
              </div>
            )}
            {streaming ? (
              <button 
                onClick={onStop} 
                className="p-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              >
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button 
                onClick={onSend} 
                disabled={(!input.trim() && attachments.length === 0) || !selectedModel} 
                className={`p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  (input.trim() || attachments.length > 0) 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'bg-theme-bg-tertiary text-theme-text-muted'
                }`}
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex justify-center mt-3">
          <span className="text-[10px] text-theme-text-muted font-medium">
            Drag & Drop files • <kbd className="font-sans">Shift+Enter</kbd> new line
          </span>
        </div>
      </div>
    </div>
  );
};
