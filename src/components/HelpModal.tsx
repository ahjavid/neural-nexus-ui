import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { label: "Send", key: "Enter" },
  { label: "New Line", key: "Shift+Ent" },
  { label: "Commands", key: "/" },
  { label: "Close", key: "Esc" }
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <X size={20} />
        </button>
        
        <h3 className="font-bold text-xl text-gray-200 mb-6 flex items-center gap-2">
          <HelpCircle size={24} className="text-indigo-500" /> Shortcuts
        </h3>
        
        <div className="space-y-3">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-gray-400">{s.label}</span>
              <kbd className="bg-gray-800 px-2 py-1 rounded border border-gray-700 text-gray-300 font-mono text-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
