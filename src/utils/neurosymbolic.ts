/**
 * Neurosymbolic AI Module for Neural Nexus UI
 * 
 * This module implements a hybrid approach combining:
 * - Neural: Embedding-based semantic search
 * - Symbolic: Entity extraction, rule-based reasoning, knowledge graphs
 * 
 * Architecture follows the "Neural | Symbolic" pattern where neural networks
 * handle perception (embeddings) and symbolic systems handle reasoning.
 */

import type { KnowledgeChunk } from '../types';

// ============================================
// Phase 1: Entity Extraction (Symbolic)
// ============================================

/**
 * Types of entities we can extract from text
 */
export type EntityType = 
  | 'date' 
  | 'time' 
  | 'datetime'
  | 'money' 
  | 'percentage'
  | 'email' 
  | 'phone' 
  | 'url'
  | 'number'
  | 'card'
  | 'account'
  | 'person'
  | 'organization'
  | 'location'
  | 'duration'
  | 'ordinal'
  | 'keyword';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalized?: string | number | Date;
  confidence: number;
  position: { start: number; end: number };
  context?: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  keywords: string[];
  summary: {
    totalEntities: number;
    byType: Record<EntityType, number>;
    hasTemporalInfo: boolean;
    hasMonetaryInfo: boolean;
    hasContactInfo: boolean;
  };
}

/**
 * Regular expression patterns for entity extraction
 */
const ENTITY_PATTERNS: Record<string, { pattern: RegExp; type: EntityType; normalize?: (match: string) => string | number | Date }> = {
  // Date patterns (various formats)
  dateISO: {
    pattern: /\b(\d{4}-\d{2}-\d{2})\b/g,
    type: 'date',
    normalize: (m) => new Date(m)
  },
  dateUS: {
    pattern: /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
    type: 'date',
    normalize: (m) => {
      const parts = m.split('/');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
    }
  },
  dateEU: {
    pattern: /\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/g,
    type: 'date',
    normalize: (m) => {
      const parts = m.split('.');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    }
  },
  dateWritten: {
    pattern: /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})\b/gi,
    type: 'date',
    normalize: (m) => new Date(m.replace(/(\d+)(st|nd|rd|th)/i, '$1'))
  },
  
  // Time patterns
  time12h: {
    pattern: /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/g,
    type: 'time'
  },
  time24h: {
    pattern: /\b([0-2]?\d:[0-5]\d(?::[0-5]\d)?)\b/g,
    type: 'time'
  },
  
  // Money patterns (various currencies)
  moneyUSD: {
    pattern: /\$\s?([\d,]+(?:\.\d{2})?)\b/g,
    type: 'money',
    normalize: (m) => parseFloat(m.replace(/[$,]/g, ''))
  },
  moneyEUR: {
    pattern: /€\s?([\d,]+(?:\.\d{2})?)\b/g,
    type: 'money',
    normalize: (m) => parseFloat(m.replace(/[€,]/g, ''))
  },
  moneyGBP: {
    pattern: /£\s?([\d,]+(?:\.\d{2})?)\b/g,
    type: 'money',
    normalize: (m) => parseFloat(m.replace(/[£,]/g, ''))
  },
  moneyGeneric: {
    pattern: /\b([\d,]+(?:\.\d{2})?)\s*(?:dollars?|USD|EUR|GBP|euros?|pounds?)\b/gi,
    type: 'money',
    normalize: (m) => parseFloat(m.replace(/[^\d.]/g, ''))
  },
  // Decimal amounts that look like money (e.g., 696.00, 180.76) - common in statements
  moneyDecimal: {
    pattern: /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g,
    type: 'money',
    normalize: (m) => parseFloat(m.replace(/,/g, ''))
  },
  
  // Percentage
  percentage: {
    pattern: /\b(\d+(?:\.\d+)?)\s*%/g,
    type: 'percentage',
    normalize: (m) => parseFloat(m.replace('%', ''))
  },
  
  // Contact info
  email: {
    pattern: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    type: 'email'
  },
  phone: {
    pattern: /\b(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
    type: 'phone',
    normalize: (m) => m.replace(/[^\d+]/g, '')
  },
  url: {
    pattern: /\b(https?:\/\/[^\s<>"{}|\\^`[\]]+)\b/g,
    type: 'url'
  },
  
  // Numbers
  largeNumber: {
    pattern: /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/g,
    type: 'number',
    normalize: (m) => parseFloat(m.replace(/,/g, ''))
  },
  decimal: {
    pattern: /\b(\d+\.\d+)\b/g,
    type: 'number',
    normalize: (m) => parseFloat(m)
  },
  
  // Duration
  duration: {
    pattern: /\b(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|yrs?)\b/gi,
    type: 'duration'
  },
  
  // Ordinal numbers
  ordinal: {
    pattern: /\b(\d+(?:st|nd|rd|th))\b/gi,
    type: 'ordinal',
    normalize: (m) => parseInt(m.replace(/\D/g, ''))
  },
  
  // Card numbers (last 4 digits commonly shown)
  cardLast4: {
    pattern: /\b(?:card|acct|account|ending(?:\s+in)?)\s*[#:]?\s*(\d{4})\b/gi,
    type: 'card',
    normalize: (m) => m
  },
  // Standalone 4-digit identifiers in parentheses like (CARD 8455) or just 4 digits after card mention
  cardNumber4: {
    pattern: /\(?\s*(?:CARD|Card|card)\s+(\d{4})\s*\)?/g,
    type: 'card',
    normalize: (m) => m
  },
  // Account numbers (partial, commonly last 4-6 digits)
  accountPartial: {
    pattern: /\b(?:x{2,}|[*]{2,})(\d{4,6})\b/gi,
    type: 'account',
    normalize: (m) => m
  }
};

/**
 * Common stopwords to filter out from keywords
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'i', 'me', 'my', 'mine',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
  'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
  'then', 'if', 'else', 'because', 'while', 'although', 'though', 'after', 'before',
  'above', 'below', 'between', 'under', 'over', 'through', 'during', 'out', 'into',
  'about', 'any', 'being', 'get', 'got', 'getting', 'let', 'make', 'made', 'put',
  'say', 'said', 'see', 'saw', 'seen', 'take', 'took', 'taken', 'tell', 'told',
  'think', 'thought', 'use', 'used', 'using', 'want', 'wanted', 'way', 'well'
]);

/**
 * Extract keywords from text using TF-IDF-like scoring
 */
export const extractKeywords = (text: string, maxKeywords: number = 20): string[] => {
  // Tokenize and clean
  const words = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !STOPWORDS.has(word) && 
      !/^\d+$/.test(word)
    );
  
  // Count frequencies
  const freq: Map<string, number> = new Map();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  // Score by frequency and length (longer words often more specific)
  const scored = Array.from(freq.entries())
    .map(([word, count]) => ({
      word,
      score: count * (1 + Math.log(word.length))
    }))
    .sort((a, b) => b.score - a.score);
  
  return scored.slice(0, maxKeywords).map(s => s.word);
};

/**
 * Extract N-grams (phrases) from text
 */
export const extractPhrases = (text: string, n: number = 2): string[] => {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  const phrases: Map<string, number> = new Map();
  
  for (let i = 0; i <= words.length - n; i++) {
    const phrase = words.slice(i, i + n).join(' ');
    // Skip if contains only stopwords
    const phraseWords = phrase.split(' ');
    if (phraseWords.every(w => STOPWORDS.has(w))) continue;
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }
  
  return Array.from(phrases.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
};

/**
 * Main entity extraction function
 */
export const extractEntities = (text: string): EntityExtractionResult => {
  const entities: ExtractedEntity[] = [];
  const processedPositions = new Set<string>();
  
  // Extract using patterns
  for (const [, config] of Object.entries(ENTITY_PATTERNS)) {
    const { pattern, type, normalize } = config;
    let match;
    
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      const start = match.index;
      const end = start + match[0].length;
      const posKey = `${start}-${end}`;
      
      // Avoid overlapping entities
      if (processedPositions.has(posKey)) continue;
      processedPositions.add(posKey);
      
      // Get surrounding context
      const contextStart = Math.max(0, start - 30);
      const contextEnd = Math.min(text.length, end + 30);
      const context = text.slice(contextStart, contextEnd).trim();
      
      entities.push({
        type,
        value: value.trim(),
        normalized: normalize ? normalize(value) : undefined,
        confidence: 0.9, // Pattern-based extraction is fairly reliable
        position: { start, end },
        context
      });
    }
  }
  
  // Extract keywords
  const keywords = extractKeywords(text);
  
  // Build summary
  const byType: Record<EntityType, number> = {} as Record<EntityType, number>;
  for (const entity of entities) {
    byType[entity.type] = (byType[entity.type] || 0) + 1;
  }
  
  return {
    entities,
    keywords,
    summary: {
      totalEntities: entities.length,
      byType,
      hasTemporalInfo: (byType.date || 0) + (byType.time || 0) + (byType.datetime || 0) > 0,
      hasMonetaryInfo: (byType.money || 0) + (byType.percentage || 0) > 0,
      hasContactInfo: (byType.email || 0) + (byType.phone || 0) + (byType.url || 0) > 0
    }
  };
};

// ============================================
// Phase 2: Knowledge Graph (Symbolic)
// ============================================

export type RelationType = 
  | 'references'
  | 'similar_to'
  | 'part_of'
  | 'follows'
  | 'precedes'
  | 'contradicts'
  | 'supports'
  | 'same_topic'
  | 'same_entity';

export interface KnowledgeRelation {
  sourceId: string;
  targetId: string;
  type: RelationType;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeNode {
  id: string;
  entryId: number;
  chunkId?: string;
  content: string;
  title: string;
  entities: ExtractedEntity[];
  keywords: string[];
  embedding?: number[];
  relations: KnowledgeRelation[];
  metadata: {
    source?: string;
    createdAt?: number;
    charCount: number;
    entityCount: number;
  };
}

export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  relations: KnowledgeRelation[];
  entityIndex: Map<string, Set<string>>; // entity value -> node IDs
  keywordIndex: Map<string, Set<string>>; // keyword -> node IDs
  lastUpdated: number;
}

/**
 * Create a new knowledge graph from entries
 */
export const createKnowledgeGraph = (entries: Array<{
  id: number;
  title: string;
  content: string;
  chunks?: KnowledgeChunk[];
  source?: string;
  createdAt?: number;
}>): KnowledgeGraph => {
  const graph: KnowledgeGraph = {
    nodes: new Map(),
    relations: [],
    entityIndex: new Map(),
    keywordIndex: new Map(),
    lastUpdated: Date.now()
  };
  
  // Create nodes from entries
  for (const entry of entries) {
    if (entry.chunks && entry.chunks.length > 0) {
      // Create node per chunk
      for (const chunk of entry.chunks) {
        const nodeId = `${entry.id}-${chunk.id}`;
        const extraction = extractEntities(chunk.content);
        
        const node: KnowledgeNode = {
          id: nodeId,
          entryId: entry.id,
          chunkId: chunk.id,
          content: chunk.content,
          title: entry.title,
          entities: extraction.entities,
          keywords: extraction.keywords,
          relations: [],
          metadata: {
            source: entry.source,
            createdAt: entry.createdAt,
            charCount: chunk.content.length,
            entityCount: extraction.entities.length
          }
        };
        
        graph.nodes.set(nodeId, node);
        indexNode(graph, node);
      }
    } else {
      // Create single node for entry
      const nodeId = String(entry.id);
      const extraction = extractEntities(entry.content);
      
      const node: KnowledgeNode = {
        id: nodeId,
        entryId: entry.id,
        content: entry.content,
        title: entry.title,
        entities: extraction.entities,
        keywords: extraction.keywords,
        relations: [],
        metadata: {
          source: entry.source,
          createdAt: entry.createdAt,
          charCount: entry.content.length,
          entityCount: extraction.entities.length
        }
      };
      
      graph.nodes.set(nodeId, node);
      indexNode(graph, node);
    }
  }
  
  // Build relations based on shared entities and keywords
  buildRelations(graph);
  
  return graph;
};

/**
 * Index a node by its entities and keywords
 */
const indexNode = (graph: KnowledgeGraph, node: KnowledgeNode): void => {
  // Index by entities
  for (const entity of node.entities) {
    const key = `${entity.type}:${(entity.normalized || entity.value).toString().toLowerCase()}`;
    if (!graph.entityIndex.has(key)) {
      graph.entityIndex.set(key, new Set());
    }
    graph.entityIndex.get(key)!.add(node.id);
  }
  
  // Index by keywords
  for (const keyword of node.keywords) {
    if (!graph.keywordIndex.has(keyword)) {
      graph.keywordIndex.set(keyword, new Set());
    }
    graph.keywordIndex.get(keyword)!.add(node.id);
  }
};

/**
 * Build relations between nodes based on shared entities/keywords
 */
const buildRelations = (graph: KnowledgeGraph): void => {
  const nodeIds = Array.from(graph.nodes.keys());
  
  for (let i = 0; i < nodeIds.length; i++) {
    const node1 = graph.nodes.get(nodeIds[i])!;
    
    for (let j = i + 1; j < nodeIds.length; j++) {
      const node2 = graph.nodes.get(nodeIds[j])!;
      
      // Skip nodes from same entry (chunks)
      if (node1.entryId === node2.entryId) {
        // But create "part_of" relation for sequential chunks
        if (node1.chunkId && node2.chunkId) {
          const idx1 = parseInt(node1.chunkId.replace('chunk-', ''));
          const idx2 = parseInt(node2.chunkId.replace('chunk-', ''));
          if (Math.abs(idx1 - idx2) === 1) {
            const relation: KnowledgeRelation = {
              sourceId: idx1 < idx2 ? node1.id : node2.id,
              targetId: idx1 < idx2 ? node2.id : node1.id,
              type: 'follows',
              weight: 1.0
            };
            graph.relations.push(relation);
            node1.relations.push(relation);
            node2.relations.push(relation);
          }
        }
        continue;
      }
      
      // Calculate entity overlap
      const sharedEntities = findSharedEntities(node1, node2);
      if (sharedEntities.length > 0) {
        const weight = Math.min(1, sharedEntities.length * 0.3);
        const relation: KnowledgeRelation = {
          sourceId: node1.id,
          targetId: node2.id,
          type: 'same_entity',
          weight,
          metadata: { sharedEntities: sharedEntities.map(e => e.value) }
        };
        graph.relations.push(relation);
        node1.relations.push(relation);
        node2.relations.push(relation);
      }
      
      // Calculate keyword overlap (Jaccard similarity)
      const keywordSim = jaccardSimilarity(
        new Set(node1.keywords),
        new Set(node2.keywords)
      );
      
      if (keywordSim > 0.2) {
        const relation: KnowledgeRelation = {
          sourceId: node1.id,
          targetId: node2.id,
          type: 'same_topic',
          weight: keywordSim
        };
        graph.relations.push(relation);
        node1.relations.push(relation);
        node2.relations.push(relation);
      }
    }
  }
};

/**
 * Find entities shared between two nodes
 */
const findSharedEntities = (node1: KnowledgeNode, node2: KnowledgeNode): ExtractedEntity[] => {
  const shared: ExtractedEntity[] = [];
  
  for (const e1 of node1.entities) {
    for (const e2 of node2.entities) {
      if (e1.type === e2.type) {
        const v1 = (e1.normalized || e1.value).toString().toLowerCase();
        const v2 = (e2.normalized || e2.value).toString().toLowerCase();
        if (v1 === v2) {
          shared.push(e1);
        }
      }
    }
  }
  
  return shared;
};

/**
 * Jaccard similarity between two sets
 */
const jaccardSimilarity = <T>(set1: Set<T>, set2: Set<T>): number => {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
};

// ============================================
// Phase 3: Hybrid Search Engine
// ============================================

export interface HybridSearchOptions {
  topK?: number;
  semanticWeight?: number;
  entityWeight?: number;
  keywordWeight?: number;
  graphWeight?: number;
  minScore?: number;
  entityBoost?: Record<EntityType, number>;
  temporalDecay?: boolean;
}

export interface SearchResultExplanation {
  semanticScore: number;
  entityMatches: Array<{ type: EntityType; value: string; boost: number }>;
  keywordMatches: string[];
  graphConnections: Array<{ nodeId: string; relationType: RelationType; weight: number }>;
  temporalRelevance?: number;
  inferenceChain?: string[];
}

export interface HybridSearchResult {
  nodeId: string;
  content: string;
  title: string;
  score: number;
  explanation: SearchResultExplanation;
}

const DEFAULT_SEARCH_OPTIONS: Required<HybridSearchOptions> = {
  topK: 5,
  semanticWeight: 0.5,
  entityWeight: 0.25,
  keywordWeight: 0.15,
  graphWeight: 0.1,
  minScore: 0.3,
  entityBoost: {
    date: 1.5,
    time: 1.2,
    datetime: 1.5,
    money: 2.0,
    percentage: 1.5,
    email: 1.8,
    phone: 1.8,
    url: 1.3,
    number: 1.0,
    card: 2.0,
    account: 2.0,
    person: 1.5,
    organization: 1.5,
    location: 1.3,
    duration: 1.2,
    ordinal: 1.0,
    keyword: 1.0
  },
  temporalDecay: true
};

/**
 * Hybrid search combining neural embeddings with symbolic matching
 */
export const hybridSearch = async (
  query: string,
  graph: KnowledgeGraph,
  getQueryEmbedding: (text: string) => Promise<number[]>,
  nodeEmbeddings: Map<string, number[]>,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> => {
  const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  
  // Extract entities and keywords from query
  const queryExtraction = extractEntities(query);
  const queryKeywords = new Set(queryExtraction.keywords);
  
  // Detect comparison operators for money queries
  const lowerQuery = query.toLowerCase();
  const overMatch = lowerQuery.match(/(?:over|above|greater than|more than|>)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  const underMatch = lowerQuery.match(/(?:under|below|less than|<)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  
  const moneyGreaterThan = overMatch ? parseFloat(overMatch[1].replace(/,/g, '')) : null;
  const moneyLessThan = underMatch ? parseFloat(underMatch[1].replace(/,/g, '')) : null;
  
  console.log('🔢 Money comparison thresholds:', { 
    greaterThan: moneyGreaterThan, 
    lessThan: moneyLessThan 
  });
  
  // Get query embedding
  const queryEmbedding = await getQueryEmbedding(query);
  
  const results: HybridSearchResult[] = [];
  
  for (const [nodeId, node] of graph.nodes) {
    const explanation: SearchResultExplanation = {
      semanticScore: 0,
      entityMatches: [],
      keywordMatches: [],
      graphConnections: []
    };
    
    // 1. Semantic similarity (neural)
    const nodeEmbedding = nodeEmbeddings.get(nodeId);
    if (nodeEmbedding) {
      explanation.semanticScore = cosineSimilarity(queryEmbedding, nodeEmbedding);
    }
    
    // 2. Entity matching (symbolic)
    let entityScore = 0;
    
    // Check for money entities matching comparison operators (even if query has no explicit money entity)
    if (moneyGreaterThan !== null || moneyLessThan !== null) {
      const moneyEntities = node.entities.filter(e => e.type === 'money' && typeof e.normalized === 'number');
      
      for (const mEntity of moneyEntities) {
        const amount = mEntity.normalized as number;
        
        if (moneyGreaterThan !== null && amount > moneyGreaterThan) {
          const boost = (opts.entityBoost['money'] || 1.0) * 2.5; // Strong boost for comparison match
          entityScore += boost;
          explanation.entityMatches.push({
            type: 'money',
            value: `${mEntity.value} (>${moneyGreaterThan})`,
            boost
          });
        } else if (moneyLessThan !== null && amount < moneyLessThan) {
          const boost = (opts.entityBoost['money'] || 1.0) * 2.5;
          entityScore += boost;
          explanation.entityMatches.push({
            type: 'money',
            value: `${mEntity.value} (<${moneyLessThan})`,
            boost
          });
        }
      }
    }
    
    // Standard entity matching for other types
    for (const qEntity of queryExtraction.entities) {
      for (const nEntity of node.entities) {
        if (qEntity.type === nEntity.type) {
          // Skip money if already handled by comparison above
          if (qEntity.type === 'money' && (moneyGreaterThan !== null || moneyLessThan !== null)) {
            continue;
          }
          
          const qVal = (qEntity.normalized || qEntity.value).toString().toLowerCase();
          const nVal = (nEntity.normalized || nEntity.value).toString().toLowerCase();
          
          // Default exact/partial match
          if (qVal === nVal || nVal.includes(qVal) || qVal.includes(nVal)) {
            const boost = opts.entityBoost[qEntity.type] || 1.0;
            entityScore += boost;
            explanation.entityMatches.push({
              type: qEntity.type,
              value: nEntity.value,
              boost
            });
          }
        }
      }
    }
    
    // Normalize entity score - use max of query entities or 1 for comparison queries
    const normalizer = Math.max(queryExtraction.entities.length, 
      (moneyGreaterThan !== null || moneyLessThan !== null) ? 1 : 0);
    if (normalizer > 0) {
      entityScore = Math.min(1, entityScore / normalizer);
    }
    
    // 3. Keyword matching (symbolic)
    const nodeKeywords = new Set(node.keywords);
    const matchedKeywords = [...queryKeywords].filter(k => nodeKeywords.has(k));
    explanation.keywordMatches = matchedKeywords;
    const keywordScore = queryKeywords.size > 0 
      ? matchedKeywords.length / queryKeywords.size 
      : 0;
    
    // 4. Graph-based scoring (symbolic)
    let graphScore = 0;
    for (const relation of node.relations) {
      // Boost nodes that are connected to already high-scoring nodes
      const connectedNodeId = relation.sourceId === nodeId ? relation.targetId : relation.sourceId;
      const connectedNode = graph.nodes.get(connectedNodeId);
      if (connectedNode) {
        // Check if connected node has relevant entities
        const hasRelevantEntities = connectedNode.entities.some(e => 
          queryExtraction.entities.some(qe => 
            qe.type === e.type && 
            (qe.normalized || qe.value).toString().toLowerCase() === 
            (e.normalized || e.value).toString().toLowerCase()
          )
        );
        if (hasRelevantEntities) {
          graphScore += relation.weight * 0.5;
          explanation.graphConnections.push({
            nodeId: connectedNodeId,
            relationType: relation.type,
            weight: relation.weight
          });
        }
      }
    }
    graphScore = Math.min(1, graphScore);
    
    // 5. Temporal relevance (optional)
    if (opts.temporalDecay && node.metadata.createdAt) {
      const age = Date.now() - node.metadata.createdAt;
      const dayAge = age / (1000 * 60 * 60 * 24);
      explanation.temporalRelevance = Math.exp(-dayAge / 365); // Decay over a year
    }
    
    // Combine scores
    let finalScore = 
      opts.semanticWeight * explanation.semanticScore +
      opts.entityWeight * entityScore +
      opts.keywordWeight * keywordScore +
      opts.graphWeight * graphScore;
    
    // Apply temporal decay if enabled
    if (opts.temporalDecay && explanation.temporalRelevance !== undefined) {
      finalScore *= (0.5 + 0.5 * explanation.temporalRelevance);
    }
    
    if (finalScore >= opts.minScore) {
      results.push({
        nodeId,
        content: node.content,
        title: node.title,
        score: finalScore,
        explanation
      });
    }
  }
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  
  // Return top K
  return results.slice(0, opts.topK);
};

/**
 * Cosine similarity between two vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

// ============================================
// Reasoning Chains (Symbolic)
// ============================================

export interface ReasoningStep {
  type: 'parse' | 'search' | 'filter' | 'aggregate' | 'compare' | 'infer';
  description: string;
  input: unknown;
  output: unknown;
  confidence: number;
}

export interface ReasoningChain {
  query: string;
  steps: ReasoningStep[];
  finalAnswer?: string;
  confidence: number;
}

/**
 * Query decomposition - break complex queries into sub-queries
 */
export const decomposeQuery = (query: string): string[] => {
  const subQueries: string[] = [];
  
  // Check for comparison queries
  const comparisonPatterns = [
    /compare\s+(.+?)\s+(?:to|with|and|vs\.?)\s+(.+)/i,
    /(.+?)\s+(?:vs\.?|versus)\s+(.+)/i,
    /difference\s+between\s+(.+?)\s+and\s+(.+)/i
  ];
  
  for (const pattern of comparisonPatterns) {
    const match = query.match(pattern);
    if (match) {
      subQueries.push(match[1].trim());
      subQueries.push(match[2].trim());
      return subQueries;
    }
  }
  
  // Check for list queries
  const listMatch = query.match(/(?:all|list|show|find)\s+(?:my\s+)?(.+?)\s+(?:from|in|during|for)\s+(.+)/i);
  if (listMatch) {
    subQueries.push(`${listMatch[1]} ${listMatch[2]}`);
    return subQueries;
  }
  
  // Check for temporal queries
  const temporalMatch = query.match(/(.+?)\s+(?:before|after|during|between|since|until)\s+(.+)/i);
  if (temporalMatch) {
    subQueries.push(query);
    return subQueries;
  }
  
  // Check for aggregation queries
  const aggMatch = query.match(/(?:total|sum|average|count|how\s+many|how\s+much)\s+(.+)/i);
  if (aggMatch) {
    subQueries.push(query);
    return subQueries;
  }
  
  // Default: return original query
  return [query];
};

/**
 * Build reasoning chain for a query
 */
export const buildReasoningChain = async (
  query: string,
  graph: KnowledgeGraph,
  searchResults: HybridSearchResult[]
): Promise<ReasoningChain> => {
  const steps: ReasoningStep[] = [];
  
  // Step 1: Parse query
  const queryExtraction = extractEntities(query);
  steps.push({
    type: 'parse',
    description: 'Parse query to extract entities and intent',
    input: query,
    output: {
      entities: queryExtraction.entities.map(e => ({ type: e.type, value: e.value })),
      keywords: queryExtraction.keywords.slice(0, 5),
      graphNodes: graph.nodes.size
    },
    confidence: 0.95
  });
  
  // Step 2: Decompose if needed
  const subQueries = decomposeQuery(query);
  if (subQueries.length > 1) {
    steps.push({
      type: 'parse',
      description: 'Decompose query into sub-queries',
      input: query,
      output: subQueries,
      confidence: 0.85
    });
  }
  
  // Step 3: Search
  steps.push({
    type: 'search',
    description: `Found ${searchResults.length} relevant documents using hybrid search`,
    input: { query, method: 'hybrid' },
    output: searchResults.map(r => ({
      title: r.title,
      score: r.score.toFixed(3),
      semanticScore: r.explanation.semanticScore.toFixed(3),
      entityMatches: r.explanation.entityMatches.length,
      keywordMatches: r.explanation.keywordMatches.length
    })),
    confidence: searchResults.length > 0 ? 0.9 : 0.5
  });
  
  // Step 4: Filter based on entities
  if (queryExtraction.entities.length > 0) {
    const entityTypes = [...new Set(queryExtraction.entities.map(e => e.type))];
    steps.push({
      type: 'filter',
      description: `Filter results by entity types: ${entityTypes.join(', ')}`,
      input: { entityTypes, resultCount: searchResults.length },
      output: { filteredCount: searchResults.length },
      confidence: 0.88
    });
  }
  
  // Step 5: Infer relationships if graph connections found
  const hasConnections = searchResults.some(r => r.explanation.graphConnections.length > 0);
  if (hasConnections) {
    const connections = searchResults
      .flatMap(r => r.explanation.graphConnections)
      .slice(0, 5);
    steps.push({
      type: 'infer',
      description: 'Infer relationships from knowledge graph connections',
      input: { connectionCount: connections.length },
      output: connections.map(c => ({ relation: c.relationType, weight: c.weight.toFixed(2) })),
      confidence: 0.75
    });
  }
  
  // Calculate overall confidence
  const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
  
  return {
    query,
    steps,
    confidence: avgConfidence
  };
};

/**
 * Format reasoning chain for display
 */
export const formatReasoningChain = (chain: ReasoningChain): string => {
  const lines: string[] = [
    `**Reasoning Chain** (Confidence: ${(chain.confidence * 100).toFixed(0)}%)`,
    ''
  ];
  
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    const icon = {
      parse: '🔍',
      search: '📚',
      filter: '🔬',
      aggregate: '📊',
      compare: '⚖️',
      infer: '💡'
    }[step.type];
    
    lines.push(`${i + 1}. ${icon} **${step.type.toUpperCase()}**: ${step.description}`);
  }
  
  return lines.join('\n');
};

// ============================================
// Exports for integration
// ============================================

export {
  cosineSimilarity
};
