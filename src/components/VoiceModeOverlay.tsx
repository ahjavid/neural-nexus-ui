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
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="absolute top-6 right-6">
        <button onClick={onClose} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 text-white transition-all">
          <X size={24} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-6 text-center space-y-12">
        <div className="relative">
          {/* Animated Visualizer */}
          <div className={`w-32 h-32 rounded-full blur-2xl absolute inset-0 transition-all duration-300 ${
            isSpeaking ? 'bg-indigo-500 animate-pulse scale-150' : 
            isListening ? 'bg-purple-500 animate-pulse scale-125' : 'bg-gray-800'
          }`}></div>
          <div className="w-32 h-32 bg-black rounded-full border border-gray-700 relative z-10 flex items-center justify-center shadow-2xl">
            {isSpeaking ? (
              <Volume2 size={40} className="text-indigo-400" />
            ) : isListening ? (
              <Mic size={40} className="text-purple-400 animate-pulse" />
            ) : (
              <Phone size={40} className="text-gray-500" />
            )}
          </div>
        </div>

        <div className="space-y-4 min-h-[100px]">
          <h2 className="text-2xl font-light text-gray-200">
            {isSpeaking ? "Speaking..." : isListening ? "Listening..." : "Ready"}
          </h2>
          <p className="text-lg text-gray-400 font-medium leading-relaxed max-w-lg mx-auto">
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
          className={`p-6 rounded-full transition-all ${
            isListening ? 'bg-purple-500 hover:bg-purple-600 scale-110' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          {isListening ? (
            <MicOff size={32} className="text-white" />
          ) : (
            <Mic size={32} className="text-gray-300" />
          )}
        </button>
      </div>

      <div className="pb-12">
        <button 
          onClick={onEndCall} 
          className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-full text-red-400 font-medium flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
        >
          <PhoneOff size={20} /> End Call
        </button>
      </div>
    </div>
  );
};
