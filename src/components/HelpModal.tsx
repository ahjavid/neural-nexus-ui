import React from 'react';
import { HelpCircle, X, MessageSquare, Keyboard, Mic } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcutGroups = [
  {
    title: "Chat",
    icon: MessageSquare,
    shortcuts: [
      { label: "Send message", key: "Enter" },
      { label: "New line", key: "Shift+Enter" },
      { label: "Slash commands", key: "/" },
    ]
  },
  {
    title: "Navigation",
    icon: Keyboard,
    shortcuts: [
      { label: "Zen mode", key: "Ctrl+Shift+Z" },
      { label: "Show shortcuts", key: "Shift+?" },
      { label: "Close modal", key: "Esc" },
    ]
  },
  {
    title: "Features",
    icon: Mic,
    shortcuts: [
      { label: "Voice mode", key: "Voice button" },
      { label: "Attach files", key: "+ button" },
      { label: "Drag & drop", key: "Files" },
    ]
  }
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
      <div className="bg-theme-bg-secondary border border-theme-border-primary rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl p-4 sm:p-6 relative max-h-[90vh] sm:max-h-none overflow-y-auto">
        {/* Swipe indicator for mobile */}
        <div className="swipe-indicator sm:hidden" />
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-theme-text-muted hover:text-theme-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-lg p-2 -mr-1 -mt-1 touch-target-sm"
        >
          <X size={20} />
        </button>
        
        <h3 className="font-bold text-xl text-theme-text-primary mb-6 flex items-center gap-2">
          <HelpCircle size={24} className="text-indigo-500" /> Keyboard Shortcuts
        </h3>
        
        <div className="space-y-5">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx}>
              <div className="flex items-center gap-2 mb-2">
                <group.icon size={14} className="text-indigo-400" />
                <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">{group.title}</span>
              </div>
              <div className="space-y-2 pl-5">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-theme-text-secondary">{s.label}</span>
                    <kbd className="bg-theme-bg-tertiary px-2 py-1 rounded border border-theme-border-secondary text-theme-text-secondary font-mono text-xs">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-theme-border-primary">
          <p className="text-xs text-theme-text-muted text-center">
            Tip: Use <kbd className="bg-theme-bg-tertiary px-1.5 py-0.5 rounded text-theme-text-secondary font-mono text-[10px]">/</kbd> to see available commands
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
