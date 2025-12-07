import React from 'react';
import { X, Mic, MicOff, Volume2, Phone, PhoneOff } from 'lucide-react';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  lastResponse: string;
  onEndCall: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({ 
  isOpen, 
  onClose, 
  isSpeaking, 
  isListening, 
  transcript, 
  lastResponse, 
  onEndCall, 
  onStartListening, 
  onStopListening 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500 safe-area-top safe-area-bottom">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 safe-area-top">
        <button onClick={onClose} className="p-3 sm:p-3 bg-gray-800 rounded-full hover:bg-gray-700 text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 touch-target">
          <X size={24} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-4 sm:px-6 text-center space-y-8 sm:space-y-12">
        <div className="relative">
          {/* Animated Visualizer */}
          <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full blur-2xl absolute inset-0 transition-all duration-300 ${
            isSpeaking ? 'bg-indigo-500 animate-pulse scale-150' : 
            isListening ? 'bg-purple-500 animate-pulse scale-125' : 'bg-gray-800'
          }`}></div>
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-black rounded-full border border-gray-700 relative z-10 flex items-center justify-center shadow-2xl">
            {isSpeaking ? (
              <Volume2 size={32} className="sm:w-10 sm:h-10 text-indigo-400" />
            ) : isListening ? (
              <Mic size={32} className="sm:w-10 sm:h-10 text-purple-400 animate-pulse" />
            ) : (
              <Phone size={32} className="sm:w-10 sm:h-10 text-gray-500" />
            )}
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4 min-h-[80px] sm:min-h-[100px]">
          <h2 className="text-xl sm:text-2xl font-light text-gray-200">
            {isSpeaking ? "Speaking..." : isListening ? "Listening..." : "Ready"}
          </h2>
          <p className="text-base sm:text-lg text-gray-400 font-medium leading-relaxed max-w-sm sm:max-w-lg mx-auto">
            {isListening && transcript 
              ? transcript 
              : lastResponse 
                ? lastResponse.slice(0, 150) + (lastResponse.length > 150 ? "..." : "") 
                : "Tap the microphone or start speaking"
            }
          </p>
        </div>
        
        {/* Manual mic control */}
        <button 
          onClick={isListening ? onStopListening : onStartListening}
          className={`p-5 sm:p-6 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50 touch-target ${
            isListening ? 'bg-purple-500 hover:bg-purple-600 scale-110' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          {isListening ? (
            <MicOff size={28} className="sm:w-8 sm:h-8 text-white" />
          ) : (
            <Mic size={28} className="sm:w-8 sm:h-8 text-gray-300" />
          )}
        </button>
      </div>

      <div className="pb-8 sm:pb-12 safe-area-bottom">
        <button 
          onClick={onEndCall} 
          className="px-6 py-3 sm:px-8 sm:py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-full text-red-400 font-medium flex items-center gap-2 sm:gap-3 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/50 touch-target"
        >
          <PhoneOff size={18} className="sm:w-5 sm:h-5" /> End Call
        </button>
      </div>
    </div>
  );
};
