import React, { useState } from 'react';
import { Terminal, Clock, Zap, Volume2, VolumeX, FileCode, FileText, FileSpreadsheet, Copy, Check } from 'lucide-react';
import { MessageContent } from './MessageContent';
import type { Message } from '../types';
import { formatBytes } from '../utils/helpers';

interface ChatMessageProps {
  message: Message;
  index: number;
  speakingMsgId: number | null;
  onSpeakMessage: (text: string, index: number) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  index,
  speakingMsgId,
  onSpeakMessage
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`flex gap-2 sm:gap-4 max-w-4xl mx-auto ${isUser ? 'justify-end' : 'justify-start'} group/msg`}>
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-lg ${
        isUser ? 'order-2 bg-theme-bg-elevated border border-theme-border-secondary' : 'bg-theme-bg-secondary border border-theme-border-secondary'
      }`}>
        {isUser ? (
          <span className="text-[10px] sm:text-xs font-bold text-theme-text-primary">ME</span>
        ) : (
          <Terminal size={14} className="text-indigo-400 sm:w-[14px] sm:h-[14px] w-[12px] h-[12px]" />
        )}
      </div>

      <div className={`flex flex-col max-w-[85%] sm:max-w-[80%] md:max-w-[75%] w-full ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-3 py-3 sm:px-5 sm:py-4 rounded-2xl shadow-md w-full ${
          isUser 
            ? 'bg-theme-bg-elevated border border-theme-border-secondary text-theme-text-primary rounded-tr-sm' 
            : 'bg-theme-bg-secondary border border-theme-border-primary text-theme-text-primary rounded-tl-sm'
        }`}>
          {/* Attachments with Image Previews */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att, i) => (
                att.type === 'image' && att.content ? (
                  <div key={i} className="relative group">
                    <img 
                      src={att.content} 
                      alt={att.name} 
                      className="max-h-48 max-w-64 rounded-lg border border-white/20 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(att.content, '_blank')}
                    />
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                      {att.name}
                    </span>
                  </div>
                ) : (
                  <div 
                    key={i} 
                    className={`flex items-center gap-2 rounded-lg p-2 text-xs border ${
                      att.docType === 'pdf' ? 'bg-red-900/20 border-red-500/30' :
                      att.docType === 'word' ? 'bg-blue-900/20 border-blue-500/30' :
                      att.docType === 'excel' ? 'bg-green-900/20 border-green-500/30' :
                      'bg-black/20 border-white/10'
                    }`}
                  >
                    {att.docType === 'pdf' && <FileText size={12} className="text-red-400"/>}
                    {att.docType === 'word' && <FileText size={12} className="text-blue-400"/>}
                    {att.docType === 'excel' && <FileSpreadsheet size={12} className="text-green-400"/>}
                    {!att.docType && <FileCode size={12}/>}
                    <span className="truncate max-w-[150px]">{att.name}</span>
                    <span className="text-[10px] opacity-60">{att.docInfo || formatBytes(att.size)}</span>
                  </div>
                )
              ))}
            </div>
          )}
          
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
              {message.displayContent || message.content}
            </p>
          ) : (
            <MessageContent content={message.content} />
          )}
          
          {/* Loading indicator */}
          {!isUser && message.content === '' && (
            <div className="flex gap-1 h-4 items-center">
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          )}
        </div>
        
        {/* Assistant message actions */}
        {!isUser && message.content !== '' && (
          <div className="flex items-center gap-3 mt-2 ml-1 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-opacity">
            <button 
              onClick={handleCopy}
              className={`p-1.5 text-theme-text-muted hover:text-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded touch-target-sm ${
                copied ? 'text-emerald-500' : ''
              }`}
              title={copied ? 'Copied!' : 'Copy message'}
            >
              {copied ? <Check size={16} className="sm:w-[14px] sm:h-[14px]" /> : <Copy size={16} className="sm:w-[14px] sm:h-[14px]" />}
            </button>
            <button 
              onClick={() => onSpeakMessage(message.content, index)} 
              className={`p-1.5 text-theme-text-muted hover:text-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded touch-target-sm ${
                speakingMsgId === index ? 'text-indigo-500 animate-pulse' : ''
              }`}
              title={speakingMsgId === index ? 'Stop speaking' : 'Read aloud'}
            >
              {speakingMsgId === index ? <VolumeX size={16} className="sm:w-[14px] sm:h-[14px]" /> : <Volume2 size={16} className="sm:w-[14px] sm:h-[14px]" />}
            </button>
            {message.timing && (
              <span className="flex items-center gap-2 text-[10px] text-theme-text-muted font-mono">
                <span className="flex items-center gap-1"><Clock size={10} />{message.timing}s</span>
                {message.tokenSpeed && <span className="hidden sm:flex items-center gap-1"><Zap size={10} />{message.tokenSpeed} t/s</span>}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
