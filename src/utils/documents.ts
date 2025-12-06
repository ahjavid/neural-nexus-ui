import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { DocumentResult, KnowledgeChunk } from '../types';
import { extractEntities, extractKeywords } from './neurosymbolic';

// Set up PDF.js worker using Web Worker with module type
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
    { type: 'module' }
  );
}

// ============================================
// Text Chunking for RAG (with entity extraction)
// ============================================

export interface ChunkOptions {
  chunkSize?: number;      // Target size of each chunk in characters
  chunkOverlap?: number;   // Overlap between chunks for context continuity
  minChunkSize?: number;   // Minimum chunk size to keep
  extractEntities?: boolean; // Whether to extract entities from chunks
}

export interface EnhancedKnowledgeChunk extends KnowledgeChunk {
  entities?: Array<{ type: string; value: string }>;
  keywords?: string[];
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
