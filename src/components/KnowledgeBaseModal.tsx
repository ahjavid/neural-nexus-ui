import React, { useState, useRef } from 'react';
import { Database, X, Trash2, Check, Upload, Link, FileText, Globe, File, Loader2, ChevronDown, ChevronRight, Brain, Tag, Hash } from 'lucide-react';
import { Button } from './Button';
import type { KnowledgeEntry } from '../types';
import { processDocument, fetchUrlContent, chunkText } from '../utils/documents';
import { extractEntities, extractKeywords } from '../utils/neurosymbolic';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBase: KnowledgeEntry[];
  activeKnowledgeIds: number[];
  onToggleKnowledge: (id: number) => void;
  onDeleteKnowledge: (id: number) => void;
  onAddKnowledge: (title: string, content: string, metadata?: Partial<KnowledgeEntry>) => void;
}

type AddMode = 'text' | 'file' | 'url';

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  knowledgeBase,
  activeKnowledgeIds,
  onToggleKnowledge,
  onDeleteKnowledge,
  onAddKnowledge
}) => {
  const [addMode, setAddMode] = useState<AddMode>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showEntities, setShowEntities] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache for extracted entities (computed on demand)
  const [entityCache, setEntityCache] = useState<Map<number, { entities: Array<{type: string; value: string}>; keywords: string[] }>>(new Map());

  if (!isOpen) return null;

  const handleTextSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    
    if (title && content) {
      const chunks = chunkText(content);
      onAddKnowledge(title, content, {
        source: 'manual',
        chunks,
        createdAt: Date.now(),
        charCount: content.length
      });
      form.reset();
      setError(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const result = await processDocument(file);
        const chunks = chunkText(result.text);
        
        onAddKnowledge(file.name, result.text, {
          source: 'file',
          fileName: file.name,
          fileType: result.type,
          chunks,
          createdAt: Date.now(),
          charCount: result.text.length
        });
      } catch (err) {
        setError(`Failed to process ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUrlFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      setError('Invalid URL format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchUrlContent(parsedUrl.href);
      const chunks = chunkText(result.text);
      
      onAddKnowledge(result.title || parsedUrl.hostname, result.text, {
        source: 'url',
        url: parsedUrl.href,
        chunks,
        createdAt: Date.now(),
        charCount: result.text.length
      });
      
      setUrl('');
    } catch (err) {
      setError(`Failed to fetch URL: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    setIsLoading(false);
  };

  const getSourceIcon = (entry: KnowledgeEntry) => {
    switch (entry.source) {
      case 'file':
        return <File size={12} className="text-blue-400" />;
      case 'url':
        return <Globe size={12} className="text-green-400" />;
      default:
        return <FileText size={12} className="text-gray-400" />;
    }
  };

  const formatCharCount = (count?: number) => {
    if (!count) return '';
    if (count < 1000) return `${count} chars`;
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K chars`;
    return `${(count / 1000000).toFixed(1)}M chars`;
  };

  // Get or compute entity info for a knowledge entry
  const getEntityInfo = (entry: KnowledgeEntry) => {
    // Check if already cached
    if (entityCache.has(entry.id)) {
      return entityCache.get(entry.id)!;
    }
    
    // Extract entities and keywords
    const extraction = extractEntities(entry.content);
    const keywords = extractKeywords(entry.content, 8);
    
    // Deduplicate entities
    const seenEntities = new Set<string>();
    const uniqueEntities = extraction.entities
      .filter(e => {
        const key = `${e.type}:${e.value}`;
        if (seenEntities.has(key)) return false;
        seenEntities.add(key);
        return true;
      })
      .slice(0, 10)
      .map(e => ({ type: e.type, value: e.value }));
    
    const result = { entities: uniqueEntities, keywords };
    
    // Cache the result
    setEntityCache(new Map(entityCache).set(entry.id, result));
    
    return result;
  };

  // Get entity type color
  const getEntityColor = (type: string) => {
    const colors: Record<string, string> = {
      date: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      time: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      money: 'bg-green-500/20 text-green-400 border-green-500/30',
      percentage: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      email: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      phone: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      url: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      number: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      duration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      ordinal: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-theme-bg-secondary border border-theme-border-primary rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-theme-border-primary flex justify-between items-center bg-theme-bg-tertiary">
          <h3 className="font-bold text-theme-text-primary flex items-center gap-2">
            <Database size={18} /> Knowledge Base
            <span className="text-xs text-theme-text-muted font-normal">({knowledgeBase.length} entries)</span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
              <Brain size={10} /> Neurosymbolic AI
            </span>
          </h3>
          <button onClick={onClose} className="text-theme-text-muted hover:text-theme-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-lg p-1">
            <X size={20} />
          </button>
        </div>
        
        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {knowledgeBase.length === 0 && (
            <div className="text-center py-10">
              <Database size={40} className="mx-auto text-theme-text-muted mb-3" />
              <p className="text-theme-text-secondary text-sm">No knowledge entries yet.</p>
              <p className="text-theme-text-muted text-xs mt-1">Add documents, URLs, or text to get started.</p>
            </div>
          )}
          {knowledgeBase.map(k => (
            <div 
              key={k.id} 
              className="bg-theme-bg-primary border border-theme-border-primary rounded-xl overflow-hidden hover:border-theme-border-secondary transition-colors"
            >
              <div className="p-3 flex items-start gap-3">
                <button 
                  onClick={() => onToggleKnowledge(k.id)} 
                  className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${
                    activeKnowledgeIds.includes(k.id) 
                      ? 'bg-indigo-600 border-indigo-600' 
                      : 'border-theme-border-secondary hover:border-theme-border-primary'
                  }`}
                >
                  {activeKnowledgeIds.includes(k.id) && <Check size={12} className="text-white" />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getSourceIcon(k)}
                    <h4 className="font-medium text-sm text-theme-text-primary truncate">{k.title}</h4>
                    {/* Neurosymbolic badge */}
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-0.5">
                      <Brain size={9} /> AI
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-[10px] text-theme-text-muted">
                    {k.source === 'url' && k.url && (
                      <span className="truncate max-w-[200px]">{k.url}</span>
                    )}
                    {k.source === 'file' && k.fileType && (
                      <span className="uppercase">{k.fileType}</span>
                    )}
                    {k.charCount && <span>{formatCharCount(k.charCount)}</span>}
                    {k.chunks && <span>• {k.chunks.length} chunks</span>}
                  </div>
                  
                  {/* Entity/Keyword Preview (always show if expanded) */}
                  {(expandedId === k.id || showEntities === k.id) && (() => {
                    const info = getEntityInfo(k);
                    return (
                      <div className="mt-2 space-y-2">
                        {/* Entities */}
                        {info.entities.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-theme-text-muted flex items-center gap-0.5 mr-1">
                              <Tag size={10} /> Entities:
                            </span>
                            {info.entities.slice(0, 6).map((e, i) => (
                              <span 
                                key={i} 
                                className={`px-1.5 py-0.5 rounded text-[9px] border ${getEntityColor(e.type)}`}
                                title={e.type}
                              >
                                {e.value.slice(0, 25)}{e.value.length > 25 ? '…' : ''}
                              </span>
                            ))}
                            {info.entities.length > 6 && (
                              <span className="text-[9px] text-theme-text-muted">+{info.entities.length - 6} more</span>
                            )}
                          </div>
                        )}
                        
                        {/* Keywords */}
                        {info.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-theme-text-muted flex items-center gap-0.5 mr-1">
                              <Hash size={10} /> Keywords:
                            </span>
                            {info.keywords.slice(0, 8).map((kw, i) => (
                              <span 
                                key={i} 
                                className="px-1.5 py-0.5 rounded text-[9px] bg-theme-bg-tertiary text-theme-text-secondary border border-theme-border-secondary"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Preview / Expand */}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => setExpandedId(expandedId === k.id ? null : k.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {expandedId === k.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {expandedId === k.id ? 'Hide content' : 'Show content'}
                    </button>
                    <button
                      onClick={() => setShowEntities(showEntities === k.id ? null : k.id)}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <Brain size={12} />
                      {showEntities === k.id ? 'Hide analysis' : 'Show analysis'}
                    </button>
                  </div>
                  
                  {expandedId === k.id && (
                    <pre className="mt-2 p-2 bg-theme-bg-secondary rounded text-[11px] text-theme-text-secondary max-h-40 overflow-auto whitespace-pre-wrap font-mono">
                      {k.content.slice(0, 2000)}{k.content.length > 2000 ? '...' : ''}
                    </pre>
                  )}
                </div>
                
                <button 
                  onClick={() => onDeleteKnowledge(k.id)} 
                  className="text-theme-text-muted hover:text-red-400 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Add Section */}
        <div className="border-t border-theme-border-primary bg-theme-bg-tertiary">
          {/* Mode Tabs */}
          <div className="flex border-b border-theme-border-primary">
            <button
              onClick={() => { setAddMode('text'); setError(null); }}
              className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                addMode === 'text' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-theme-text-muted hover:text-theme-text-secondary'
              }`}
            >
              <FileText size={14} /> Text
            </button>
            <button
              onClick={() => { setAddMode('file'); setError(null); }}
              className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                addMode === 'file' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-theme-text-muted hover:text-theme-text-secondary'
              }`}
            >
              <Upload size={14} /> File Upload
            </button>
            <button
              onClick={() => { setAddMode('url'); setError(null); }}
              className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                addMode === 'url' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-theme-text-muted hover:text-theme-text-secondary'
              }`}
            >
              <Link size={14} /> URL
            </button>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              {error}
            </div>
          )}
          
          {/* Add Forms */}
          <div className="p-4">
            {addMode === 'text' && (
              <form onSubmit={handleTextSubmit} className="space-y-2">
                <input 
                  name="title" 
                  placeholder="Title (e.g., API Docs, Meeting Notes)" 
                  className="w-full bg-theme-bg-primary border border-theme-border-secondary rounded px-3 py-2 text-sm text-theme-text-primary focus:border-indigo-500 focus:outline-none" 
                  required 
                />
                <textarea 
                  name="content" 
                  placeholder="Paste your text content here..." 
                  className="w-full bg-theme-bg-primary border border-theme-border-secondary rounded px-3 py-2 text-sm text-theme-text-primary h-24 resize-none focus:border-indigo-500 focus:outline-none" 
                  required 
                />
                <Button type="submit" className="w-full">Add Text</Button>
              </form>
            )}
            
            {addMode === 'file' && (
              <div className="space-y-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-theme-border-secondary rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 size={24} className="mx-auto text-indigo-400 animate-spin" />
                  ) : (
                    <Upload size={24} className="mx-auto text-theme-text-muted mb-2" />
                  )}
                  <p className="text-sm text-theme-text-secondary">
                    {isLoading ? 'Processing...' : 'Click to upload files'}
                  </p>
                  <p className="text-[10px] text-theme-text-muted mt-1">
                    PDF, DOCX, TXT, MD, JSON, CSV, and more
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md,.json,.csv,.xml,.html,.js,.ts,.py,.yaml,.yml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
            
            {addMode === 'url' && (
              <form onSubmit={handleUrlFetch} className="space-y-2">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/page" 
                    className="flex-1 bg-theme-bg-primary border border-theme-border-secondary rounded px-3 py-2 text-sm text-theme-text-primary focus:border-indigo-500 focus:outline-none" 
                    required 
                  />
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Fetch'}
                  </Button>
                </div>
                <p className="text-[10px] text-theme-text-muted">
                  Enter a URL to fetch and extract its text content
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;
