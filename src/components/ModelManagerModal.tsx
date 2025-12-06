import React, { useState } from 'react';
import { DownloadCloud, X } from 'lucide-react';
import { Button } from './Button';

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pullProgress: {
    status: string;
    completed?: number;
    total?: number;
    percent?: number;
    error?: boolean;
  } | null;
  onPullModel: (modelName: string) => void;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
  pullProgress,
  onPullModel
}) => {
  const [modelName, setModelName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modelName.trim()) {
      onPullModel(modelName.trim());
      setModelName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f1f23]">
          <h3 className="font-bold text-gray-200 flex items-center gap-2">
            <DownloadCloud size={18} /> Model Manager
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-lg p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {!pullProgress ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter a model tag (e.g., <code className="text-indigo-300">llama3</code>).
              </p>
              <form onSubmit={handleSubmit}>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Tag name..." 
                    className="flex-1 bg-[#09090b] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" 
                    required 
                  />
                  <Button type="submit">Pull</Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className={`font-bold text-lg ${pullProgress.error ? 'text-red-400' : 'text-indigo-400 animate-pulse'}`}>
                {pullProgress.status}
              </div>
              {pullProgress.total && pullProgress.total > 0 && (
                <div className="w-full bg-gray-800 rounded-full h-2.5">
                  <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${pullProgress.percent || 0}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelManagerModal;
