import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { DocumentResult, KnowledgeChunk } from '../types';
import { extractEntities, extractKeywords, cosineSimilarity } from './neurosymbolic';

// Set up PDF.js worker using Web Worker with module type
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
    { type: 'module' }
  );
}

// ============================================
// Types & Interfaces
// ============================================

/**
 * Chunking strategy for document processing
 */
export type ChunkingStrategy = 
  | 'fixed'           // Fixed size with overlap (basic)
  | 'sentence'        // Sentence-aware splitting (current default)
  | 'semantic'        // Split on semantic boundaries (topic changes)
  | 'hierarchical'    // Preserve document structure (headers/sections)
  | 'entity-aware';   // Keep entities together in chunks

/**
 * Basic chunking options
 */
export interface ChunkOptions {
  chunkSize?: number;      // Target size of each chunk in characters
  chunkOverlap?: number;   // Overlap between chunks for context continuity
  minChunkSize?: number;   // Minimum chunk size to keep
  extractEntities?: boolean; // Whether to extract entities from chunks
}

/**
 * Extended options for semantic chunking strategies
 */
export interface SemanticChunkOptions extends ChunkOptions {
  /** Chunking strategy to use (default: 'sentence') */
  strategy?: ChunkingStrategy;
  /** Preserve code blocks without splitting (default: true) */
  preserveCodeBlocks?: boolean;
  /** Respect markdown headings as section boundaries (default: true) */
  respectHeadings?: boolean;
  /** Maximum sentences per chunk for semantic strategy (default: 10) */
  maxSentencesPerChunk?: number;
  /** Similarity threshold for semantic boundary detection 0-1 (default: 0.5) */
  semanticSimilarityThreshold?: number;
  /** Function to get embeddings for semantic chunking */
  getEmbedding?: (text: string) => Promise<number[]>;
  /** Minimum sentences to include in a chunk (default: 2) */
  minSentencesPerChunk?: number;
}

/**
 * Section detected during hierarchical parsing
 */
interface DocumentSection {
  heading: string;
  level: number;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Code block detected during parsing
 */
interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
  placeholder: string;
}

/**
 * Enhanced chunk with entity and keyword support
 */
export interface EnhancedKnowledgeChunk extends KnowledgeChunk {
  entities?: Array<{ type: string; value: string }>;
  keywords?: string[];
  /** Section heading this chunk belongs to (for hierarchical) */
  sectionHeading?: string;
  /** Section level (1-6 for h1-h6) */
  sectionLevel?: number;
  /** Chunking strategy used to create this chunk */
  chunkStrategy?: ChunkingStrategy;
}

const defaultChunkOptions: Required<Omit<ChunkOptions, 'extractEntities'>> & { extractEntities: boolean } = {
  chunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
  extractEntities: true
};

/**
 * Split text into chunks for better RAG retrieval
 * Uses sentence-aware splitting to avoid cutting mid-sentence
 * Optionally extracts entities for neurosymbolic search
 */
export const chunkText = (text: string, options: ChunkOptions = {}): EnhancedKnowledgeChunk[] => {
  const opts = { ...defaultChunkOptions, ...options };
  const chunks: EnhancedKnowledgeChunk[] = [];
  
  // Normalize whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  if (normalizedText.length <= opts.chunkSize) {
    // Text is small enough, return as single chunk
    const chunk: EnhancedKnowledgeChunk = {
      id: `chunk-0`,
      content: normalizedText,
      index: 0
    };
    
    // Extract entities if enabled
    if (opts.extractEntities) {
      const extraction = extractEntities(normalizedText);
      chunk.entities = extraction.entities.slice(0, 20).map(e => ({
        type: e.type,
        value: e.value
      }));
      chunk.keywords = extractKeywords(normalizedText, 10);
    }
    
    return [chunk];
  }
  
  // Split by sentences first (periods, exclamation marks, question marks followed by space)
  const sentences = normalizedText.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed chunk size
    if (currentChunk.length + sentence.length > opts.chunkSize && currentChunk.length >= opts.minChunkSize) {
      // Save current chunk
      const chunk: EnhancedKnowledgeChunk = {
        id: `chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        index: chunkIndex
      };
      
      // Extract entities if enabled
      if (opts.extractEntities) {
        const extraction = extractEntities(currentChunk);
        chunk.entities = extraction.entities.slice(0, 15).map(e => ({
          type: e.type,
          value: e.value
        }));
        chunk.keywords = extractKeywords(currentChunk, 8);
      }
      
      chunks.push(chunk);
      chunkIndex++;
      
      // Start new chunk with overlap (last part of previous chunk)
      const overlapStart = Math.max(0, currentChunk.length - opts.chunkOverlap);
      currentChunk = currentChunk.slice(overlapStart) + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim().length >= opts.minChunkSize) {
    const chunk: EnhancedKnowledgeChunk = {
      id: `chunk-${chunkIndex}`,
      content: currentChunk.trim(),
      index: chunkIndex
    };
    
    // Extract entities if enabled
    if (opts.extractEntities) {
      const extraction = extractEntities(currentChunk);
      chunk.entities = extraction.entities.slice(0, 15).map(e => ({
        type: e.type,
        value: e.value
      }));
      chunk.keywords = extractKeywords(currentChunk, 8);
    }
    
    chunks.push(chunk);
  }
  
  return chunks;
};

/**
 * Extract document summary with entities for preview
 */
export const getDocumentSummary = (text: string): {
  preview: string;
  entityCount: number;
  keyEntities: Array<{ type: string; value: string }>;
  keywords: string[];
} => {
  const extraction = extractEntities(text);
  const keywords = extractKeywords(text, 10);
  
  // Get preview (first 200 chars)
  const preview = text.slice(0, 200).trim() + (text.length > 200 ? '...' : '');
  
  // Get key entities (deduplicated, top 5)
  const seenEntities = new Set<string>();
  const keyEntities = extraction.entities
    .filter(e => {
      const key = `${e.type}:${e.value}`;
      if (seenEntities.has(key)) return false;
      seenEntities.add(key);
      return true;
    })
    .slice(0, 5)
    .map(e => ({ type: e.type, value: e.value }));
  
  return {
    preview,
    entityCount: extraction.entities.length,
    keyEntities,
    keywords
  };
};

// ============================================
// Semantic Chunking Implementation
// ============================================

/** Default options for semantic chunking */
const defaultSemanticOptions: Required<Omit<SemanticChunkOptions, 'getEmbedding'>> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
  extractEntities: true,
  strategy: 'sentence',
  preserveCodeBlocks: true,
  respectHeadings: true,
  maxSentencesPerChunk: 10,
  semanticSimilarityThreshold: 0.5,
  minSentencesPerChunk: 2
};

/** Regex patterns for detecting section boundaries */
const HEADING_PATTERNS = [
  /^#{1,6}\s+.+$/gm,                    // Markdown headings
  /^[A-Z][A-Z0-9\s]{2,50}$/gm,          // ALL CAPS headings
  /^(?:\d+\.)+\s+.+$/gm,                // Numbered headings (1. 1.1. etc)
  /^[IVX]+\.\s+.+$/gm,                  // Roman numeral headings
];

/** Regex for code blocks */
const CODE_BLOCK_REGEX = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;

/**
 * Split text into sentences with better handling of abbreviations
 */
const splitIntoSentences = (text: string): string[] => {
  // Common abbreviations that shouldn't end sentences
  const abbreviations = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc', 'i.e', 'e.g', 'al', 'Inc', 'Ltd', 'Corp'];
  
  // Protect abbreviations
  let protected_ = text;
  abbreviations.forEach((abbr, i) => {
    protected_ = protected_.replace(new RegExp(`\\b${abbr}\\.`, 'gi'), `__ABBR${i}__`);
  });
  
  // Split on sentence endings
  const sentences = protected_
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // Restore abbreviations
  return sentences.map(s => {
    let restored = s;
    abbreviations.forEach((abbr, i) => {
      restored = restored.replace(new RegExp(`__ABBR${i}__`, 'g'), `${abbr}.`);
    });
    return restored;
  });
};

/**
 * Extract code blocks and replace with placeholders
 */
const extractCodeBlocks = (text: string): { text: string; blocks: CodeBlock[] } => {
  const blocks: CodeBlock[] = [];
  let index = 0;
  
  const cleanedText = text.replace(CODE_BLOCK_REGEX, (match, offset) => {
    const placeholder = `__CODE_BLOCK_${index}__`;
    const langMatch = match.match(/^```(\w*)/);
    blocks.push({
      language: langMatch?.[1] || '',
      code: match,
      startIndex: offset,
      endIndex: offset + match.length,
      placeholder
    });
    index++;
    return placeholder;
  });
  
  return { text: cleanedText, blocks };
};

/**
 * Restore code blocks from placeholders
 */
const restoreCodeBlocks = (text: string, blocks: CodeBlock[]): string => {
  let restored = text;
  blocks.forEach(block => {
    restored = restored.replace(block.placeholder, block.code);
  });
  return restored;
};

/**
 * Parse document into hierarchical sections based on headings
 */
const parseDocumentSections = (text: string): DocumentSection[] => {
  const sections: DocumentSection[] = [];
  const lines = text.split('\n');
  
  let currentSection: DocumentSection | null = null;
  let contentStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for markdown headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.endIndex = contentStart;
        currentSection.content = lines.slice(
          lines.findIndex((_, idx) => idx > lines.indexOf(currentSection!.heading.replace(/^#+\s*/, ''))),
          i
        ).join('\n').trim();
        if (currentSection.content) {
          sections.push(currentSection);
        }
      }
      
      currentSection = {
        heading: headingMatch[2],
        level: headingMatch[1].length,
        content: '',
        startIndex: contentStart,
        endIndex: 0
      };
      contentStart = i + 1;
    }
  }
  
  // Add final section
  if (currentSection) {
    currentSection.endIndex = lines.length;
    currentSection.content = lines.slice(contentStart).join('\n').trim();
    if (currentSection.content) {
      sections.push(currentSection);
    }
  }
  
  // If no sections found, treat entire text as one section
  if (sections.length === 0) {
    sections.push({
      heading: '',
      level: 0,
      content: text,
      startIndex: 0,
      endIndex: text.length
    });
  }
  
  return sections;
};

/**
 * Group sentences by semantic similarity using sliding window
 */
const groupSentencesBySimilarity = async (
  sentences: string[],
  getEmbedding: (text: string) => Promise<number[]>,
  threshold: number,
  minSentences: number,
  maxSentences: number
): Promise<string[][]> => {
  if (sentences.length === 0) return [];
  if (sentences.length <= minSentences) return [sentences];
  
  const groups: string[][] = [];
  let currentGroup: string[] = [sentences[0]];
  
  // Get embeddings for all sentences
  const embeddings: number[][] = [];
  for (const sentence of sentences) {
    try {
      const emb = await getEmbedding(sentence);
      embeddings.push(emb);
    } catch {
      // If embedding fails, use empty array
      embeddings.push([]);
    }
  }
  
  for (let i = 1; i < sentences.length; i++) {
    const prevEmb = embeddings[i - 1];
    const currEmb = embeddings[i];
    
    // Calculate similarity
    let similarity = 1.0; // Default to similar if embeddings unavailable
    if (prevEmb.length > 0 && currEmb.length > 0) {
      similarity = cosineSimilarity(prevEmb, currEmb);
    }
    
    // Check if we should start a new group
    const shouldSplit = 
      similarity < threshold && 
      currentGroup.length >= minSentences;
    
    const mustSplit = currentGroup.length >= maxSentences;
    
    if (shouldSplit || mustSplit) {
      groups.push([...currentGroup]);
      currentGroup = [sentences[i]];
    } else {
      currentGroup.push(sentences[i]);
    }
  }
  
  // Add remaining sentences
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
};

/**
 * Create chunks with entity-aware boundaries
 * Tries to keep entities (especially multi-word ones) together
 */
const chunkWithEntityAwareness = (
  text: string,
  opts: Required<Omit<SemanticChunkOptions, 'getEmbedding'>>
): EnhancedKnowledgeChunk[] => {
  const chunks: EnhancedKnowledgeChunk[] = [];
  const sentences = splitIntoSentences(text);
  
  // Extract all entities from the text
  const allEntities = extractEntities(text);
  
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLength = sentence.length;
    
    // Check if adding this sentence would exceed chunk size
    if (currentLength + sentenceLength > opts.chunkSize && currentChunk.length > 0) {
      // Create chunk
      const chunkContent = currentChunk.join(' ');
      const extraction = opts.extractEntities ? extractEntities(chunkContent) : { entities: [] };
      
      chunks.push({
        id: `chunk-${chunkIndex}`,
        content: chunkContent,
        index: chunkIndex++,
        entities: extraction.entities.slice(0, 15).map(e => ({ type: e.type, value: e.value })),
        keywords: opts.extractEntities ? extractKeywords(chunkContent, 8) : [],
        chunkStrategy: 'entity-aware'
      });
      
      // Start new chunk with overlap - include last sentence if it contains an entity
      const lastSentence = currentChunk[currentChunk.length - 1];
      const hasEntity = allEntities.entities.some(e => lastSentence.includes(e.value));
      currentChunk = hasEntity ? [lastSentence, sentence] : [sentence];
      currentLength = currentChunk.join(' ').length;
    } else {
      currentChunk.push(sentence);
      currentLength += sentenceLength + 1; // +1 for space
    }
  }
  
  // Handle remaining text
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join(' ');
    if (chunkContent.length >= opts.minChunkSize) {
      const extraction = opts.extractEntities ? extractEntities(chunkContent) : { entities: [] };
      chunks.push({
        id: `chunk-${chunkIndex}`,
        content: chunkContent,
        index: chunkIndex,
        entities: extraction.entities.slice(0, 15).map(e => ({ type: e.type, value: e.value })),
        keywords: opts.extractEntities ? extractKeywords(chunkContent, 8) : [],
        chunkStrategy: 'entity-aware'
      });
    } else if (chunks.length > 0) {
      // Append to previous chunk if too small
      chunks[chunks.length - 1].content += ' ' + chunkContent;
    }
  }
  
  return chunks;
};

/**
 * Hierarchical chunking that preserves document structure
 * Keeps sections together and respects heading boundaries
 */
const chunkHierarchically = (
  text: string,
  opts: Required<Omit<SemanticChunkOptions, 'getEmbedding'>>
): EnhancedKnowledgeChunk[] => {
  const chunks: EnhancedKnowledgeChunk[] = [];
  let chunkIndex = 0;
  
  // Handle code blocks if needed
  let processedText = text;
  let codeBlocks: CodeBlock[] = [];
  
  if (opts.preserveCodeBlocks) {
    const result = extractCodeBlocks(text);
    processedText = result.text;
    codeBlocks = result.blocks;
  }
  
  // Parse into sections
  const sections = parseDocumentSections(processedText);
  
  for (const section of sections) {
    let sectionContent = section.content;
    
    // Restore code blocks in this section
    if (opts.preserveCodeBlocks) {
      sectionContent = restoreCodeBlocks(sectionContent, codeBlocks);
    }
    
    // If section is small enough, keep it as one chunk
    if (sectionContent.length <= opts.chunkSize) {
      if (sectionContent.length >= opts.minChunkSize) {
        const extraction = opts.extractEntities ? extractEntities(sectionContent) : { entities: [] };
        chunks.push({
          id: `chunk-${chunkIndex}`,
          content: section.heading ? `## ${section.heading}\n\n${sectionContent}` : sectionContent,
          index: chunkIndex++,
          entities: extraction.entities.slice(0, 15).map(e => ({ type: e.type, value: e.value })),
          keywords: opts.extractEntities ? extractKeywords(sectionContent, 8) : [],
          sectionHeading: section.heading || undefined,
          sectionLevel: section.level || undefined,
          chunkStrategy: 'hierarchical'
        });
      }
    } else {
      // Section too large, split by paragraphs/sentences while preserving heading context
      const subChunks = chunkText(sectionContent, {
        chunkSize: opts.chunkSize - (section.heading ? section.heading.length + 10 : 0),
        chunkOverlap: opts.chunkOverlap,
        minChunkSize: opts.minChunkSize,
        extractEntities: opts.extractEntities
      });
      
      for (const subChunk of subChunks) {
        chunks.push({
          ...subChunk,
          id: `chunk-${chunkIndex}`,
          content: section.heading ? `## ${section.heading}\n\n${subChunk.content}` : subChunk.content,
          index: chunkIndex++,
          sectionHeading: section.heading || undefined,
          sectionLevel: section.level || undefined,
          chunkStrategy: 'hierarchical'
        });
      }
    }
  }
  
  return chunks;
};

/**
 * Semantic chunking with embedding-based boundary detection
 * Uses similarity between consecutive sentences to find natural breaks
 */
export const semanticChunk = async (
  text: string,
  options: SemanticChunkOptions = {}
): Promise<EnhancedKnowledgeChunk[]> => {
  const opts = { ...defaultSemanticOptions, ...options };
  
  // Handle different strategies
  switch (opts.strategy) {
    case 'fixed':
      // Simple fixed-size chunking
      return chunkText(text, opts).map(c => ({ ...c, chunkStrategy: 'fixed' as ChunkingStrategy }));
    
    case 'sentence':
      // Sentence-aware chunking (default behavior)
      return chunkText(text, opts).map(c => ({ ...c, chunkStrategy: 'sentence' as ChunkingStrategy }));
    
    case 'entity-aware':
      return chunkWithEntityAwareness(text, opts);
    
    case 'hierarchical':
      return chunkHierarchically(text, opts);
    
    case 'semantic':
      // Requires embedding function
      if (!options.getEmbedding) {
        console.warn('Semantic chunking requires getEmbedding function, falling back to sentence strategy');
        return chunkText(text, opts).map(c => ({ ...c, chunkStrategy: 'sentence' as ChunkingStrategy }));
      }
      
      // Handle code blocks
      let processedText = text;
      let codeBlocks: CodeBlock[] = [];
      
      if (opts.preserveCodeBlocks) {
        const result = extractCodeBlocks(text);
        processedText = result.text;
        codeBlocks = result.blocks;
      }
      
      // Split into sentences
      const sentences = splitIntoSentences(processedText);
      
      // Group by semantic similarity
      const groups = await groupSentencesBySimilarity(
        sentences,
        options.getEmbedding,
        opts.semanticSimilarityThreshold,
        opts.minSentencesPerChunk,
        opts.maxSentencesPerChunk
      );
      
      // Convert groups to chunks
      const chunks: EnhancedKnowledgeChunk[] = [];
      let chunkIndex = 0;
      
      for (const group of groups) {
        let chunkContent = group.join(' ');
        
        // Restore code blocks
        if (opts.preserveCodeBlocks) {
          chunkContent = restoreCodeBlocks(chunkContent, codeBlocks);
        }
        
        // Skip if too small
        if (chunkContent.length < opts.minChunkSize) {
          if (chunks.length > 0) {
            chunks[chunks.length - 1].content += ' ' + chunkContent;
          }
          continue;
        }
        
        // Extract entities if enabled
        const extraction = opts.extractEntities ? extractEntities(chunkContent) : { entities: [] };
        
        chunks.push({
          id: `chunk-${chunkIndex}`,
          content: chunkContent,
          index: chunkIndex++,
          entities: extraction.entities.slice(0, 15).map(e => ({ type: e.type, value: e.value })),
          keywords: opts.extractEntities ? extractKeywords(chunkContent, 8) : [],
          chunkStrategy: 'semantic'
        });
      }
      
      return chunks;
    
    default:
      return chunkText(text, opts).map(c => ({ ...c, chunkStrategy: 'sentence' as ChunkingStrategy }));
  }
};

/**
 * Convenience function to chunk with best strategy based on content
 * Automatically detects document type and chooses appropriate strategy
 */
export const autoChunk = async (
  text: string,
  options: SemanticChunkOptions = {}
): Promise<EnhancedKnowledgeChunk[]> => {
  // Detect content characteristics
  const hasHeadings = HEADING_PATTERNS.some(p => p.test(text));
  const hasCodeBlocks = CODE_BLOCK_REGEX.test(text);
  const sentenceCount = splitIntoSentences(text).length;
  
  // Choose strategy based on content
  let strategy: ChunkingStrategy = 'sentence';
  
  if (hasHeadings && text.length > 2000) {
    // Document with clear structure - use hierarchical
    strategy = 'hierarchical';
  } else if (hasCodeBlocks) {
    // Technical document - use hierarchical to preserve code
    strategy = 'hierarchical';
  } else if (options.getEmbedding && sentenceCount > 20) {
    // Long document with embeddings available - use semantic
    strategy = 'semantic';
  } else if (sentenceCount > 10) {
    // Regular document - use entity-aware for better context
    strategy = 'entity-aware';
  }
  
  return semanticChunk(text, { ...options, strategy });
};

// ============================================
// URL Content Fetching
// ============================================

/**
 * Fetch and extract text content from a URL
 */
export const fetchUrlContent = async (url: string): Promise<DocumentResult> => {
  // Use a CORS proxy for browser compatibility
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(proxyUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse HTML and extract text
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove script, style, and other non-content elements
    const elementsToRemove = doc.querySelectorAll('script, style, nav, footer, header, aside, noscript, iframe');
    elementsToRemove.forEach(el => el.remove());
    
    // Try to find main content area
    const mainContent = doc.querySelector('main, article, .content, .post, #content, #main') || doc.body;
    
    // Get text content
    let text = mainContent?.textContent || '';
    
    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    // Get title
    const title = doc.querySelector('title')?.textContent?.trim() || 
                  doc.querySelector('h1')?.textContent?.trim() || 
                  new URL(url).hostname;
    
    return {
      text,
      type: 'url',
      title,
      url
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

// ============================================
// Plain Text File Reading
// ============================================

/**
 * Read plain text files (.txt, .md, .json, etc.)
 */
export const extractTextFile = async (file: File): Promise<DocumentResult> => {
  const text = await file.text();
  return {
    text,
    type: 'text'
  };
};

// Extract text from PDF
export const extractPdfText = async (file: File): Promise<DocumentResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ 
    data: arrayBuffer,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/standard_fonts/',
    useSystemFonts: true
  }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }
  
  return {
    text: fullText.trim(),
    pageCount: pdf.numPages,
    type: 'pdf'
  };
};

// Extract text from Word document (.docx)
export const extractWordText = async (file: File): Promise<DocumentResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return {
    text: result.value,
    type: 'word',
    messages: result.messages
  };
};

// Extract data from Excel files
export const extractExcelText = async (file: File): Promise<DocumentResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let fullText = '';
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    fullText += `\n--- Sheet: ${sheetName} ---\n${csv}`;
  });
  
  return {
    text: fullText.trim(),
    sheetCount: workbook.SheetNames.length,
    sheetNames: workbook.SheetNames,
    type: 'excel'
  };
};

// Get file extension helper
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.slice(lastDot).toLowerCase();
};

// Text file extensions
const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.json', '.csv', '.xml', '.html', '.htm', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.css', '.yaml', '.yml', '.ini', '.cfg', '.log'];

// Process document based on type
export const processDocument = async (file: File): Promise<DocumentResult> => {
  const ext = getFileExtension(file.name);
  
  try {
    if (ext === '.pdf') {
      return await extractPdfText(file);
    } else if (ext === '.docx' || ext === '.doc') {
      return await extractWordText(file);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return await extractExcelText(file);
    } else if (TEXT_EXTENSIONS.includes(ext)) {
      return await extractTextFile(file);
    }
    
    // Try to read as text for unknown types
    try {
      const result = await extractTextFile(file);
      // Check if it looks like binary (has many non-printable characters)
      const nonPrintable = (result.text.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
      if (nonPrintable > result.text.length * 0.1) {
        throw new Error('Binary file detected');
      }
      return result;
    } catch {
      throw new Error(`Unsupported document type: ${ext}`);
    }
  } catch (error) {
    console.error(`Error processing ${file.name}:`, error);
    throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
