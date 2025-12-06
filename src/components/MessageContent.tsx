import React, { useState } from 'react';
import { Brain } from 'lucide-react';
import { CodeBlock } from './CodeBlock';

// Inline text formatting helper
const formatInlineText = (text: string): React.ReactNode => {
  if (!text) return null;
  
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g);
  
  return parts.map((part, idx) => {
    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="bg-gray-800 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-700/50">
          {part.slice(1, -1)}
        </code>
      );
    }
    
    // Process bold text
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return <strong key={`${idx}-${bIdx}`} className="text-white font-semibold">{bPart.slice(2, -2)}</strong>;
      }
      // Process italic
      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, iIdx) => {
        if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
          return <em key={`${idx}-${bIdx}-${iIdx}`} className="italic text-gray-300">{iPart.slice(1, -1)}</em>;
        }
        return iPart;
      });
    });
  });
};

interface MessageContentProps {
  content: string;
}

export const MessageContent: React.FC<MessageContentProps> = ({ content }) => {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  
  if (!content) return null;

  // Extract thinking/reasoning blocks
  const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  const reasoning = thinkMatch ? thinkMatch[1].trim() : null;
  const cleanContent = content.replace(/<think>[\s\S]*?(<\/think>|$)/, '').trim();
  
  // Split content by code blocks
  const parts = cleanContent.split(/(```[\s\S]*?```)/g).filter(p => p);

  return (
    <div className="space-y-2 leading-relaxed break-words w-full text-[15px]">
      {/* Reasoning Block */}
      {reasoning && (
        <div className="mb-4 border border-purple-500/30 rounded-lg overflow-hidden bg-purple-950/20">
          <button 
            onClick={() => setReasoningOpen(!reasoningOpen)} 
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-900/20 hover:bg-purple-900/30 text-xs font-bold text-purple-300 uppercase tracking-wider transition-colors"
          >
            <Brain size={14} className="text-purple-400" /> 
            Thinking Process 
            <span className="ml-auto text-[10px] opacity-70 font-normal normal-case">
              {reasoningOpen ? '▼ Hide' : '▶ Show'}
            </span>
          </button>
          {reasoningOpen && (
            <div className="p-4 text-sm text-gray-400 font-mono bg-black/20 border-t border-purple-500/20 whitespace-pre-wrap leading-relaxed">
              {reasoning}
            </div>
          )}
        </div>
      )}
      
      {/* Main Content */}
      {parts.map((part, idx) => {
        // Code blocks
        if (part.startsWith('```')) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          const language = match ? match[1].toLowerCase() : '';
          const code = match ? match[2].trim() : part.slice(3, -3).trim();
          return <CodeBlock key={idx} code={code} language={language} />;
        }
        
        // Regular text - split by lines and render
        const lines = part.split('\n');
        return (
          <div key={idx} className="space-y-2">
            {lines.map((line, lineIdx) => {
              const trimmedLine = line.trim();
              
              // Empty line - small spacer
              if (!trimmedLine) {
                return <div key={lineIdx} className="h-1" />;
              }
              
              // Headers
              if (trimmedLine.startsWith('### ')) {
                return <h3 key={lineIdx} className="text-lg font-bold text-white mt-4 mb-2">{trimmedLine.slice(4)}</h3>;
              }
              if (trimmedLine.startsWith('## ')) {
                return <h2 key={lineIdx} className="text-xl font-bold text-white mt-4 mb-2">{trimmedLine.slice(3)}</h2>;
              }
              if (trimmedLine.startsWith('# ')) {
                return <h1 key={lineIdx} className="text-2xl font-bold text-white mt-4 mb-2">{trimmedLine.slice(2)}</h1>;
              }
              
              // Bullet points
              if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                return (
                  <div key={lineIdx} className="flex gap-2 ml-2">
                    <span className="text-indigo-400 mt-1">•</span>
                    <span className="text-gray-300 flex-1">{formatInlineText(trimmedLine.slice(2))}</span>
                  </div>
                );
              }
              
              // Numbered lists
              const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
              if (numberedMatch) {
                return (
                  <div key={lineIdx} className="flex gap-2 ml-2">
                    <span className="text-indigo-400 font-mono text-sm min-w-[1.5rem]">{numberedMatch[1]}.</span>
                    <span className="text-gray-300 flex-1">{formatInlineText(numberedMatch[2])}</span>
                  </div>
                );
              }
              
              // Regular paragraph
              return (
                <p key={lineIdx} className="text-gray-300 leading-relaxed">
                  {formatInlineText(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
