import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPreviewable = ['html', 'svg', 'xml'].includes(language);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-4 border border-theme-border-secondary bg-[#0d1117] dark:bg-[#0d1117] shadow-lg w-full">
      <div className="flex justify-between items-center px-4 py-2 bg-[#161b22] border-b border-[#30363d] text-xs text-gray-400 select-none">
        <div className="flex gap-2 items-center">
          <span className="uppercase font-mono font-bold text-indigo-400">{language || 'text'}</span>
          {isPreviewable && (
            <button 
              onClick={() => setShowPreview(!showPreview)} 
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${showPreview ? 'bg-indigo-500/20 text-indigo-300' : 'hover:text-white hover:bg-white/10'}`}
            >
              {showPreview ? <EyeOff size={12}/> : <Eye size={12}/>} {showPreview ? 'Code' : 'Preview'}
            </button>
          )}
        </div>
        <button 
          onClick={handleCopy} 
          className="flex items-center gap-1 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          <span className="text-[10px] uppercase tracking-wider">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      {showPreview ? (
        <div className="bg-white p-4 overflow-auto min-h-[100px] max-h-[400px]">
          <div dangerouslySetInnerHTML={{ __html: code }} />
        </div>
      ) : (
        <pre className="p-4 overflow-x-auto font-mono text-sm text-gray-300 custom-scrollbar max-h-[500px]">
          <code className="block">{code}</code>
        </pre>
      )}
    </div>
  );
};
