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
  
  // Money comparison thresholds for filtering (no logging in production)
  
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
    
    // Entity density boost for data-rich queries
    // When query asks for data listing but has no specific entities to match,
    // boost chunks that have high entity density (any type of entities)
    const queryLower = query.toLowerCase();
    const isDataQuery = 
      (queryLower.includes('list') || queryLower.includes('show') || 
       queryLower.includes('find') || queryLower.includes('get') ||
       queryLower.includes('all') || queryLower.includes('detail') ||
       queryLower.includes('transaction') || queryLower.includes('payment') || 
       queryLower.includes('contact') || queryLower.includes('email') ||
       queryLower.includes('date') || queryLower.includes('schedule') ||
       queryLower.includes('meeting') || queryLower.includes('event') ||
       queryLower.includes('report') || queryLower.includes('summary')) &&
      queryExtraction.entities.length === 0;
    
    if (isDataQuery) {
      // Count all entity types for general document support
      const entityCounts: Record<string, number> = {};
      for (const e of node.entities) {
        entityCounts[e.type] = (entityCounts[e.type] || 0) + 1;
      }
      const totalEntities = node.entities.length;
      
      if (totalEntities >= 2) {
        // Boost proportional to entity density (max boost at 10+ entities)
        const densityBoost = Math.min(1.0, totalEntities / 10) * 1.5;
        entityScore += densityBoost;
        
        // Create summary of entity types found
        const typeSummary = Object.entries(entityCounts)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ');
        explanation.entityMatches.push({
          type: 'date', // Use 'date' as generic marker for density boost
          value: `entity-dense (${typeSummary})`,
          boost: densityBoost
        });
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
    
    // Normalize entity score
    const normalizer = isDataQuery ? 1 : Math.max(queryExtraction.entities.length, 
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
export const cosineSimilarity = (a: number[], b: number[]): number => {
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
// BM25 Sparse Retrieval
// ============================================

export interface BM25Config {
  k1: number;      // Term frequency saturation parameter (1.2-2.0 typical)
  b: number;       // Length normalization parameter (0.75 typical)
}

const DEFAULT_BM25_CONFIG: BM25Config = {
  k1: 1.5,
  b: 0.75
};

/**
 * BM25 (Best Match 25) implementation for sparse keyword retrieval
 * 
 * BM25 is a ranking function used for keyword-based information retrieval.
 * It considers term frequency, document length, and inverse document frequency.
 */
export class BM25 {
  private documents: Array<{ id: string; tokens: string[]; content: string }> = [];
  private avgDocLength = 0;
  private docFreq: Map<string, number> = new Map(); // How many docs contain each term
  private config: BM25Config;

  constructor(config: Partial<BM25Config> = {}) {
    this.config = { ...DEFAULT_BM25_CONFIG, ...config };
  }

  /**
   * Tokenize text into lowercase terms, filtering stopwords
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !STOPWORDS.has(word) && 
        !/^\d+$/.test(word)
      );
  }

  /**
   * Build index from documents
   */
  index(documents: Array<{ id: string; content: string }>): void {
    this.documents = [];
    this.docFreq.clear();
    
    let totalLength = 0;
    const termSeen = new Set<string>();

    for (const doc of documents) {
      const tokens = this.tokenize(doc.content);
      this.documents.push({ id: doc.id, tokens, content: doc.content });
      totalLength += tokens.length;

      // Track document frequency (how many docs contain each term)
      termSeen.clear();
      for (const token of tokens) {
        if (!termSeen.has(token)) {
          termSeen.add(token);
          this.docFreq.set(token, (this.docFreq.get(token) || 0) + 1);
        }
      }
    }

    this.avgDocLength = this.documents.length > 0 ? totalLength / this.documents.length : 0;
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for a term
   */
  private idf(term: string): number {
    const n = this.documents.length;
    const df = this.docFreq.get(term) || 0;
    // Standard IDF with smoothing to avoid division by zero
    return Math.log((n - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * Calculate BM25 score for a query against all indexed documents
   */
  search(query: string, limit = 10): Array<{ id: string; score: number; content: string }> {
    const queryTokens = this.tokenize(query);
    const scores: Array<{ id: string; score: number; content: string }> = [];

    for (const doc of this.documents) {
      let score = 0;
      
      // Count term frequencies in document
      const termFreq: Map<string, number> = new Map();
      for (const token of doc.tokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }

      // Calculate BM25 score for each query term
      for (const term of queryTokens) {
        const tf = termFreq.get(term) || 0;
        if (tf === 0) continue;

        const idf = this.idf(term);
        const docLen = doc.tokens.length;
        const { k1, b } = this.config;

        // BM25 formula
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLen / this.avgDocLength));
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({ id: doc.id, score, content: doc.content });
      }
    }

    // Sort by score descending and return top results
    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get BM25 score for a specific document
   */
  scoreDocument(query: string, docId: string): number {
    const queryTokens = this.tokenize(query);
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return 0;

    // Count term frequencies
    const termFreq: Map<string, number> = new Map();
    for (const token of doc.tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    let score = 0;
    for (const term of queryTokens) {
      const tf = termFreq.get(term) || 0;
      if (tf === 0) continue;

      const idf = this.idf(term);
      const docLen = doc.tokens.length;
      const { k1, b } = this.config;

      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLen / this.avgDocLength));
      score += idf * (numerator / denominator);
    }

    return score;
  }
}

// ============================================
// Reciprocal Rank Fusion (RRF)
// ============================================

export interface RRFOptions {
  k: number;  // RRF constant (60 is standard, higher = more weight to lower ranks)
}

const DEFAULT_RRF_OPTIONS: RRFOptions = {
  k: 60
};

export interface RankedItem {
  id: string;
  score: number;
  [key: string]: unknown;
}

/**
 * Reciprocal Rank Fusion (RRF) combines multiple ranking lists into a single ranking.
 * 
 * RRF is more robust than simple weighted sum because it uses ranks instead of raw scores,
 * making it less sensitive to score distribution differences between ranking methods.
 * 
 * Formula: RRF(d) = Σ (1 / (k + rank_i(d))) for each ranking list i
 * 
 * Scores are normalized to 0-1 range for compatibility with threshold filtering.
 */
export const reciprocalRankFusion = <T extends RankedItem>(
  rankingLists: T[][],
  options: Partial<RRFOptions> = {}
): T[] => {
  const opts = { ...DEFAULT_RRF_OPTIONS, ...options };
  const { k } = opts;

  // Map to accumulate RRF scores per document
  const rrfScores: Map<string, { item: T; score: number }> = new Map();

  for (const rankedList of rankingLists) {
    for (let rank = 0; rank < rankedList.length; rank++) {
      const item = rankedList[rank];
      const rrfContribution = 1 / (k + rank + 1); // +1 because ranks are 1-indexed in RRF formula

      const existing = rrfScores.get(item.id);
      if (existing) {
        existing.score += rrfContribution;
      } else {
        rrfScores.set(item.id, { item: { ...item }, score: rrfContribution });
      }
    }
  }

  // Convert to array, sort by RRF score
  const results = Array.from(rrfScores.values())
    .map(({ item, score }) => ({ ...item, score }))
    .sort((a, b) => b.score - a.score);

  // Normalize scores to 0-1 range for threshold compatibility
  if (results.length > 0) {
    const maxScore = results[0].score;
    const minScore = results[results.length - 1].score;
    const range = maxScore - minScore;
    
    if (range > 0) {
      // Normalize to 0.2-1.0 range (so even lowest still passes typical thresholds)
      for (const result of results) {
        result.score = 0.2 + 0.8 * ((result.score - minScore) / range);
      }
    } else {
      // All same score, set to 0.5
      for (const result of results) {
        result.score = 0.5;
      }
    }
  }

  return results;
};

/**
 * Fuse hybrid search signals using RRF instead of weighted sum
 * 
 * @param signals - Object with arrays of results from different ranking methods
 * @param options - RRF configuration options
 */
export const fuseWithRRF = (
  signals: {
    semantic: Array<{ id: string; score: number }>;
    bm25: Array<{ id: string; score: number }>;
    entity: Array<{ id: string; score: number }>;
    graph: Array<{ id: string; score: number }>;
  },
  options: Partial<RRFOptions> = {}
): Array<{ id: string; score: number }> => {
  const rankingLists: Array<Array<{ id: string; score: number }>> = [];

  // Only include non-empty ranking lists
  if (signals.semantic.length > 0) rankingLists.push(signals.semantic);
  if (signals.bm25.length > 0) rankingLists.push(signals.bm25);
  if (signals.entity.length > 0) rankingLists.push(signals.entity);
  if (signals.graph.length > 0) rankingLists.push(signals.graph);

  if (rankingLists.length === 0) return [];

  return reciprocalRankFusion(rankingLists, options);
};

// ============================================
// Maximal Marginal Relevance (MMR)
// ============================================

export interface MMROptions {
  lambda: number;           // Trade-off: 0 = diversity, 1 = relevance (0.5-0.7 typical)
  diversityThreshold: number; // Minimum similarity to consider as duplicate
}

const DEFAULT_MMR_OPTIONS: MMROptions = {
  lambda: 0.7,
  diversityThreshold: 0.85
};

export interface MMRItem {
  id: string;
  score: number;
  embedding?: number[];
  content: string;
}

/**
 * Maximal Marginal Relevance (MMR) reranking for result diversification.
 * 
 * MMR balances relevance (similarity to query) with diversity (dissimilarity 
 * to already selected documents). This reduces redundancy in search results.
 * 
 * Formula: MMR = λ * sim(doc, query) - (1-λ) * max(sim(doc, selected_docs))
 * 
 * @param results - Initial ranked results (sorted by relevance)
 * @param _queryEmbedding - The query embedding (unused - relevance from results.score)
 * @param embeddings - Map of document ID to embedding vectors
 * @param k - Number of results to return
 * @param options - MMR configuration
 */
export const mmrRerank = (
  results: MMRItem[],
  _queryEmbedding: number[],
  embeddings: Map<string, number[]>,
  k: number,
  options: Partial<MMROptions> = {}
): MMRItem[] => {
  const opts = { ...DEFAULT_MMR_OPTIONS, ...options };
  const { lambda } = opts;

  if (results.length === 0) return [];
  if (results.length <= k) return results;

  const selected: MMRItem[] = [];
  const remaining = [...results];

  // Select first result (highest relevance)
  selected.push(remaining.shift()!);

  // Iteratively select remaining results using MMR criterion
  while (selected.length < k && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const candidateEmb = embeddings.get(candidate.id) || candidate.embedding;

      if (!candidateEmb) {
        // If no embedding, fall back to content-based similarity using Jaccard
        const mmrScore = computeMMRWithoutEmbedding(
          candidate, 
          selected, 
          lambda
        );
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
        continue;
      }

      // Relevance: similarity to query (normalized score from results)
      const relevance = candidate.score;

      // Diversity: max similarity to any already selected document
      let maxSimToSelected = 0;
      for (const sel of selected) {
        const selEmb = embeddings.get(sel.id) || sel.embedding;
        if (selEmb) {
          const sim = cosineSimilarity(candidateEmb, selEmb);
          maxSimToSelected = Math.max(maxSimToSelected, sim);
        }
      }

      // MMR score
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      selected.push(remaining.splice(bestIndex, 1)[0]);
    } else {
      break;
    }
  }

  return selected;
};

/**
 * Compute MMR score without embeddings using content-based Jaccard similarity
 */
const computeMMRWithoutEmbedding = (
  candidate: MMRItem,
  selected: MMRItem[],
  lambda: number
): number => {
  const relevance = candidate.score;
  
  // Calculate content-based similarity using word overlap
  const candidateWords = new Set(
    candidate.content.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  );

  let maxSimToSelected = 0;
  for (const sel of selected) {
    const selWords = new Set(
      sel.content.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    );
    const sim = jaccardSimilarity(candidateWords, selWords);
    maxSimToSelected = Math.max(maxSimToSelected, sim);
  }

  return lambda * relevance - (1 - lambda) * maxSimToSelected;
};

/**
 * Quick diversity filter - removes near-duplicate results
 */
export const diversityFilter = (
  results: MMRItem[],
  embeddings: Map<string, number[]>,
  threshold: number = 0.9
): MMRItem[] => {
  const filtered: MMRItem[] = [];

  for (const result of results) {
    const resultEmb = embeddings.get(result.id) || result.embedding;
    let isDuplicate = false;

    for (const kept of filtered) {
      const keptEmb = embeddings.get(kept.id) || kept.embedding;
      
      if (resultEmb && keptEmb) {
        const sim = cosineSimilarity(resultEmb, keptEmb);
        if (sim > threshold) {
          isDuplicate = true;
          break;
        }
      } else {
        // Fallback to content-based similarity
        const resultWords = new Set(result.content.toLowerCase().split(/\s+/));
        const keptWords = new Set(kept.content.toLowerCase().split(/\s+/));
        const sim = jaccardSimilarity(resultWords, keptWords);
        if (sim > threshold) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      filtered.push(result);
    }
  }

  return filtered;
};

// ============================================
// Enhanced Hybrid Search with BM25, RRF & MMR
// ============================================

export interface EnhancedHybridSearchOptions extends HybridSearchOptions {
  useBM25?: boolean;
  useRRF?: boolean;
  useMMR?: boolean;
  bm25Config?: Partial<BM25Config>;
  rrfK?: number;
  mmrLambda?: number;
  diversityThreshold?: number;
}

const DEFAULT_ENHANCED_OPTIONS: Required<Omit<EnhancedHybridSearchOptions, keyof HybridSearchOptions>> = {
  useBM25: true,
  useRRF: true,
  useMMR: true,
  bm25Config: {},
  rrfK: 60,
  mmrLambda: 0.7,
  diversityThreshold: 0.85
};

/**
 * Enhanced hybrid search combining:
 * - Semantic search (neural embeddings)
 * - BM25 sparse retrieval (keyword matching)
 * - Entity matching (symbolic)
 * - Knowledge graph scoring
 * - Reciprocal Rank Fusion (combining signals)
 * - MMR reranking (diversity)
 */
export const enhancedHybridSearch = async (
  query: string,
  graph: KnowledgeGraph,
  getQueryEmbedding: (text: string) => Promise<number[]>,
  nodeEmbeddings: Map<string, number[]>,
  options: EnhancedHybridSearchOptions = {}
): Promise<HybridSearchResult[]> => {
  const searchOpts = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  const enhancedOpts = { ...DEFAULT_ENHANCED_OPTIONS, ...options };

  // Extract entities and keywords from query
  const queryExtraction = extractEntities(query);
  
  // Detect comparison operators for money queries
  const lowerQuery = query.toLowerCase();
  const overMatch = lowerQuery.match(/(?:over|above|greater than|more than|>)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  const underMatch = lowerQuery.match(/(?:under|below|less than|<)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  const moneyGreaterThan = overMatch ? parseFloat(overMatch[1].replace(/,/g, '')) : null;
  const moneyLessThan = underMatch ? parseFloat(underMatch[1].replace(/,/g, '')) : null;

  // Get query embedding
  const queryEmbedding = await getQueryEmbedding(query);

  // Build separate ranking lists for RRF
  const semanticRanking: Array<{ id: string; score: number; node: KnowledgeNode }> = [];
  const bm25Ranking: Array<{ id: string; score: number; node: KnowledgeNode }> = [];
  const entityRanking: Array<{ id: string; score: number; node: KnowledgeNode }> = [];
  const graphRanking: Array<{ id: string; score: number; node: KnowledgeNode }> = [];

  // Build BM25 index if enabled
  let bm25: BM25 | null = null;
  if (enhancedOpts.useBM25) {
    bm25 = new BM25(enhancedOpts.bm25Config);
    const docs = Array.from(graph.nodes.entries()).map(([id, node]) => ({
      id,
      content: node.content
    }));
    bm25.index(docs);
  }

  // Score each node
  for (const [nodeId, node] of graph.nodes) {
    // 1. Semantic similarity (neural)
    const nodeEmbedding = nodeEmbeddings.get(nodeId);
    const semanticScore = nodeEmbedding ? cosineSimilarity(queryEmbedding, nodeEmbedding) : 0;
    if (semanticScore > 0) {
      semanticRanking.push({ id: nodeId, score: semanticScore, node });
    }

    // 2. BM25 scoring (sparse retrieval)
    if (bm25) {
      const bm25Score = bm25.scoreDocument(query, nodeId);
      if (bm25Score > 0) {
        bm25Ranking.push({ id: nodeId, score: bm25Score, node });
      }
    }

    // 3. Entity matching (symbolic)
    let entityScore = 0;
    const entityMatches: Array<{ type: EntityType; value: string; boost: number }> = [];

    // Handle money comparison operators
    if (moneyGreaterThan !== null || moneyLessThan !== null) {
      const moneyEntities = node.entities.filter(e => e.type === 'money' && typeof e.normalized === 'number');
      for (const mEntity of moneyEntities) {
        const amount = mEntity.normalized as number;
        if (moneyGreaterThan !== null && amount > moneyGreaterThan) {
          const boost = (searchOpts.entityBoost['money'] || 1.0) * 2.5;
          entityScore += boost;
          entityMatches.push({ type: 'money', value: `${mEntity.value} (>${moneyGreaterThan})`, boost });
        } else if (moneyLessThan !== null && amount < moneyLessThan) {
          const boost = (searchOpts.entityBoost['money'] || 1.0) * 2.5;
          entityScore += boost;
          entityMatches.push({ type: 'money', value: `${mEntity.value} (<${moneyLessThan})`, boost });
        }
      }
    }

    // Entity density boost for data-rich queries
    // When query asks for data listing but has no specific entities to match,
    // boost chunks that have high entity density (any type of entities)
    const queryLower = query.toLowerCase();
    const isDataQuery = 
      (queryLower.includes('list') || queryLower.includes('show') || 
       queryLower.includes('find') || queryLower.includes('get') ||
       queryLower.includes('all') || queryLower.includes('detail') ||
       queryLower.includes('transaction') || queryLower.includes('payment') || 
       queryLower.includes('contact') || queryLower.includes('email') ||
       queryLower.includes('date') || queryLower.includes('schedule') ||
       queryLower.includes('meeting') || queryLower.includes('event') ||
       queryLower.includes('report') || queryLower.includes('summary')) &&
      queryExtraction.entities.length === 0; // Query has no specific entities
    
    if (isDataQuery) {
      // Count all entity types for general document support
      const entityCounts: Record<string, number> = {};
      for (const e of node.entities) {
        entityCounts[e.type] = (entityCounts[e.type] || 0) + 1;
      }
      const totalEntities = node.entities.length;
      
      if (totalEntities >= 2) { // At least 2 entities of any type
        // Boost proportional to entity density (max boost at 10+ entities)
        const densityBoost = Math.min(1.0, totalEntities / 10) * 1.5;
        entityScore += densityBoost;
        
        // Create summary of entity types found
        const typeSummary = Object.entries(entityCounts)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ');
        entityMatches.push({ 
          type: 'date', // Use 'date' as generic marker for density boost 
          value: `entity-dense (${typeSummary})`, 
          boost: densityBoost 
        });
      }
    }

    // Standard entity matching
    for (const qEntity of queryExtraction.entities) {
      for (const nEntity of node.entities) {
        if (qEntity.type === nEntity.type) {
          if (qEntity.type === 'money' && (moneyGreaterThan !== null || moneyLessThan !== null)) {
            continue;
          }
          const qVal = (qEntity.normalized || qEntity.value).toString().toLowerCase();
          const nVal = (nEntity.normalized || nEntity.value).toString().toLowerCase();
          if (qVal === nVal || nVal.includes(qVal) || qVal.includes(nVal)) {
            const boost = searchOpts.entityBoost[qEntity.type] || 1.0;
            entityScore += boost;
            entityMatches.push({ type: qEntity.type, value: nEntity.value, boost });
          }
        }
      }
    }

    if (entityScore > 0) {
      // For data queries, normalize by a fixed value since we're measuring density, not matching
      const normalizer = isDataQuery ? 1 : Math.max(queryExtraction.entities.length, (moneyGreaterThan !== null || moneyLessThan !== null) ? 1 : 0);
      entityRanking.push({ id: nodeId, score: Math.min(1, entityScore / (normalizer || 1)), node });
    }

    // 4. Graph-based scoring
    let graphScore = 0;
    for (const relation of node.relations) {
      const connectedNodeId = relation.sourceId === nodeId ? relation.targetId : relation.sourceId;
      const connectedNode = graph.nodes.get(connectedNodeId);
      if (connectedNode) {
        const hasRelevantEntities = connectedNode.entities.some(e =>
          queryExtraction.entities.some(qe =>
            qe.type === e.type &&
            (qe.normalized || qe.value).toString().toLowerCase() ===
            (e.normalized || e.value).toString().toLowerCase()
          )
        );
        if (hasRelevantEntities) {
          graphScore += relation.weight * 0.5;
        }
      }
    }
    if (graphScore > 0) {
      graphRanking.push({ id: nodeId, score: Math.min(1, graphScore), node });
    }
  }

  // Sort each ranking by score
  semanticRanking.sort((a, b) => b.score - a.score);
  bm25Ranking.sort((a, b) => b.score - a.score);
  entityRanking.sort((a, b) => b.score - a.score);
  graphRanking.sort((a, b) => b.score - a.score);

  console.log('📊 Ranking list sizes:', {
    semantic: semanticRanking.length,
    bm25: bm25Ranking.length,
    entity: entityRanking.length,
    graph: graphRanking.length
  });

  // Combine rankings
  let combinedResults: Array<{ id: string; score: number; node: KnowledgeNode }>;

  if (enhancedOpts.useRRF) {
    // Use Reciprocal Rank Fusion
    const fusedRanking = fuseWithRRF({
      semantic: semanticRanking.map(r => ({ id: r.id, score: r.score })),
      bm25: bm25Ranking.map(r => ({ id: r.id, score: r.score })),
      entity: entityRanking.map(r => ({ id: r.id, score: r.score })),
      graph: graphRanking.map(r => ({ id: r.id, score: r.score }))
    }, { k: enhancedOpts.rrfK });

    // Map back to full results with nodes
    const nodeMap = new Map<string, KnowledgeNode>();
    for (const [nodeId, node] of graph.nodes) {
      nodeMap.set(nodeId, node);
    }

    combinedResults = fusedRanking.map(r => ({
      id: r.id,
      score: r.score,
      node: nodeMap.get(r.id)!
    })).filter(r => r.node);

    console.log('🔗 RRF fusion completed:', combinedResults.length, 'results');
  } else {
    // Fall back to weighted sum (original behavior)
    const scoreMap = new Map<string, { score: number; node: KnowledgeNode }>();

    for (const r of semanticRanking) {
      scoreMap.set(r.id, { score: searchOpts.semanticWeight * r.score, node: r.node });
    }
    for (const r of bm25Ranking) {
      const existing = scoreMap.get(r.id);
      const bm25Weight = searchOpts.keywordWeight; // Use keyword weight for BM25
      if (existing) {
        existing.score += bm25Weight * r.score;
      } else {
        scoreMap.set(r.id, { score: bm25Weight * r.score, node: r.node });
      }
    }
    for (const r of entityRanking) {
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.score += searchOpts.entityWeight * r.score;
      } else {
        scoreMap.set(r.id, { score: searchOpts.entityWeight * r.score, node: r.node });
      }
    }
    for (const r of graphRanking) {
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.score += searchOpts.graphWeight * r.score;
      } else {
        scoreMap.set(r.id, { score: searchOpts.graphWeight * r.score, node: r.node });
      }
    }

    combinedResults = Array.from(scoreMap.entries())
      .map(([id, { score, node }]) => ({ id, score, node }))
      .sort((a, b) => b.score - a.score);
  }

  // Apply MMR reranking for diversity
  if (enhancedOpts.useMMR && combinedResults.length > 0) {
    const mmrInput: MMRItem[] = combinedResults.map(r => ({
      id: r.id,
      score: r.score,
      content: r.node.content,
      embedding: nodeEmbeddings.get(r.id)
    }));

    const diverseResults = mmrRerank(
      mmrInput,
      queryEmbedding,
      nodeEmbeddings,
      searchOpts.topK * 2, // Get more than needed, then filter
      { lambda: enhancedOpts.mmrLambda, diversityThreshold: enhancedOpts.diversityThreshold }
    );

    combinedResults = diverseResults.map(r => ({
      id: r.id,
      score: r.score,
      node: graph.nodes.get(r.id)!
    })).filter(r => r.node);

    console.log('🎯 MMR reranking applied:', combinedResults.length, 'diverse results');
  }

  // Build final results with explanations
  const finalResults: HybridSearchResult[] = [];

  for (const result of combinedResults.slice(0, searchOpts.topK)) {
    const node = result.node;
    const nodeEmbedding = nodeEmbeddings.get(result.id);

    const explanation: SearchResultExplanation = {
      semanticScore: nodeEmbedding ? cosineSimilarity(queryEmbedding, nodeEmbedding) : 0,
      entityMatches: [],
      keywordMatches: [],
      graphConnections: []
    };

    // Rebuild entity matches for explanation
    for (const qEntity of queryExtraction.entities) {
      for (const nEntity of node.entities) {
        if (qEntity.type === nEntity.type) {
          const qVal = (qEntity.normalized || qEntity.value).toString().toLowerCase();
          const nVal = (nEntity.normalized || nEntity.value).toString().toLowerCase();
          if (qVal === nVal || nVal.includes(qVal) || qVal.includes(nVal)) {
            explanation.entityMatches.push({
              type: qEntity.type,
              value: nEntity.value,
              boost: searchOpts.entityBoost[qEntity.type] || 1.0
            });
          }
        }
      }
    }

    // Keyword matches
    const queryKeywords = new Set(queryExtraction.keywords);
    explanation.keywordMatches = [...queryKeywords].filter(k => 
      new Set(node.keywords).has(k)
    );

    // Graph connections
    for (const relation of node.relations) {
      const connectedNodeId = relation.sourceId === result.id ? relation.targetId : relation.sourceId;
      const connectedNode = graph.nodes.get(connectedNodeId);
      if (connectedNode) {
        const hasRelevantEntities = connectedNode.entities.some(e =>
          queryExtraction.entities.some(qe =>
            qe.type === e.type &&
            (qe.normalized || qe.value).toString().toLowerCase() ===
            (e.normalized || e.value).toString().toLowerCase()
          )
        );
        if (hasRelevantEntities) {
          explanation.graphConnections.push({
            nodeId: connectedNodeId,
            relationType: relation.type,
            weight: relation.weight
          });
        }
      }
    }

    if (result.score >= searchOpts.minScore) {
      finalResults.push({
        nodeId: result.id,
        content: node.content,
        title: node.title,
        score: result.score,
        explanation
      });
    }
  }
  
  return finalResults;
};

// ============================================
// Query Expansion
// ============================================

/**
 * Common synonyms for query expansion
 * Maps common terms to their synonyms and related terms
 */
const SYNONYM_MAP: Map<string, string[]> = new Map([
  // Technical terms
  ['api', ['interface', 'endpoint', 'service', 'rest', 'graphql']],
  ['auth', ['authentication', 'authorization', 'login', 'signin', 'credential']],
  ['authenticate', ['login', 'signin', 'authorize', 'verify']],
  ['config', ['configuration', 'settings', 'options', 'preferences', 'setup']],
  ['db', ['database', 'storage', 'datastore', 'repository']],
  ['database', ['db', 'storage', 'datastore', 'repository', 'sql', 'nosql']],
  ['error', ['exception', 'fault', 'failure', 'bug', 'issue', 'problem']],
  ['function', ['method', 'procedure', 'routine', 'subroutine', 'handler']],
  ['method', ['function', 'procedure', 'routine', 'operation']],
  ['test', ['testing', 'spec', 'unit', 'integration', 'e2e', 'qa']],
  ['user', ['account', 'member', 'customer', 'client', 'person']],
  
  // Common verbs
  ['create', ['make', 'add', 'generate', 'build', 'construct', 'new']],
  ['delete', ['remove', 'drop', 'erase', 'destroy', 'clear']],
  ['update', ['modify', 'change', 'edit', 'alter', 'revise', 'patch']],
  ['get', ['fetch', 'retrieve', 'obtain', 'read', 'load', 'find']],
  ['find', ['search', 'locate', 'discover', 'lookup', 'query']],
  ['send', ['transmit', 'dispatch', 'deliver', 'post', 'submit']],
  
  // Document/file terms
  ['file', ['document', 'attachment', 'asset', 'resource']],
  ['document', ['file', 'doc', 'paper', 'record', 'report']],
  ['image', ['picture', 'photo', 'graphic', 'img', 'visual']],
  ['pdf', ['document', 'file', 'report', 'paper']],
  
  // Financial terms
  ['payment', ['transaction', 'purchase', 'charge', 'fee', 'cost', 'debit']],
  ['invoice', ['bill', 'receipt', 'statement', 'charge']],
  ['expense', ['cost', 'spending', 'expenditure', 'payment', 'charge']],
  ['revenue', ['income', 'earnings', 'sales', 'profit']],
  ['transaction', ['payment', 'purchase', 'charge', 'transfer', 'debit', 'credit', 'activity']],
  ['credit', ['card', 'balance', 'limit', 'payment', 'statement']],
  ['statement', ['bill', 'summary', 'account', 'balance', 'transactions']],
  ['balance', ['amount', 'total', 'due', 'owed', 'outstanding']],
  ['purchase', ['buy', 'transaction', 'charge', 'payment', 'merchant']],
  ['merchant', ['store', 'vendor', 'retailer', 'seller', 'business']],
  ['amount', ['total', 'sum', 'price', 'cost', 'balance', 'charge']],
  ['charge', ['fee', 'cost', 'payment', 'transaction', 'purchase', 'debit']],
  ['fee', ['charge', 'cost', 'interest', 'penalty']],
  ['interest', ['apr', 'rate', 'finance charge', 'fee']],
  
  // Time-related
  ['recent', ['latest', 'new', 'current', 'last', 'today']],
  ['old', ['previous', 'past', 'former', 'earlier', 'historic']],
]);

/**
 * Common acronyms and their expansions
 */
const ACRONYM_MAP: Map<string, string> = new Map([
  ['api', 'application programming interface'],
  ['ui', 'user interface'],
  ['ux', 'user experience'],
  ['db', 'database'],
  ['sql', 'structured query language'],
  ['html', 'hypertext markup language'],
  ['css', 'cascading style sheets'],
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['pdf', 'portable document format'],
  ['json', 'javascript object notation'],
  ['xml', 'extensible markup language'],
  ['url', 'uniform resource locator'],
  ['http', 'hypertext transfer protocol'],
  ['https', 'secure hypertext transfer protocol'],
  ['ai', 'artificial intelligence'],
  ['ml', 'machine learning'],
  ['llm', 'large language model'],
  ['rag', 'retrieval augmented generation'],
  ['nlp', 'natural language processing'],
  ['crud', 'create read update delete'],
  ['rest', 'representational state transfer'],
  ['jwt', 'json web token'],
  ['oauth', 'open authorization'],
  ['sso', 'single sign on'],
  ['2fa', 'two factor authentication'],
  ['mfa', 'multi factor authentication'],
  ['etl', 'extract transform load'],
  ['roi', 'return on investment'],
  ['kpi', 'key performance indicator'],
  ['q1', 'first quarter'],
  ['q2', 'second quarter'],
  ['q3', 'third quarter'],
  ['q4', 'fourth quarter'],
  ['ytd', 'year to date'],
  ['mtd', 'month to date'],
  ['eod', 'end of day'],
  ['eom', 'end of month'],
  ['eoy', 'end of year'],
]);

export interface QueryExpansionOptions {
  maxExpansions?: number;      // Maximum number of expanded queries
  includeSynonyms?: boolean;   // Include synonym variations
  includeAcronyms?: boolean;   // Expand/contract acronyms
  includeTypos?: boolean;      // Include common typo variations
  includePartial?: boolean;    // Include partial term matches
  synonymWeight?: number;      // Weight for synonym matches (0-1)
}

export interface ExpandedQuery {
  query: string;
  type: 'original' | 'synonym' | 'acronym' | 'partial' | 'combined';
  weight: number;  // Relevance weight (1.0 = original)
  source?: string; // What triggered this expansion
}

const DEFAULT_EXPANSION_OPTIONS: Required<QueryExpansionOptions> = {
  maxExpansions: 5,
  includeSynonyms: true,
  includeAcronyms: true,
  includeTypos: false,
  includePartial: true,
  synonymWeight: 0.8
};

/**
 * Expand a query into multiple variations for broader search coverage
 * 
 * Query expansion improves recall by:
 * 1. Adding synonyms (auth -> authentication, login)
 * 2. Expanding acronyms (API -> application programming interface)
 * 3. Generating partial matches (user auth -> user, authentication)
 */
export const expandQuery = (
  query: string,
  options: QueryExpansionOptions = {}
): ExpandedQuery[] => {
  const opts = { ...DEFAULT_EXPANSION_OPTIONS, ...options };
  const expansions: ExpandedQuery[] = [];
  const seen = new Set<string>();
  
  // Always include original query with highest weight
  const normalizedOriginal = query.toLowerCase().trim();
  expansions.push({
    query: normalizedOriginal,
    type: 'original',
    weight: 1.0
  });
  seen.add(normalizedOriginal);
  
  // Tokenize query
  const tokens = normalizedOriginal
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
  
  // 1. Synonym expansion
  if (opts.includeSynonyms) {
    for (const token of tokens) {
      const synonyms = SYNONYM_MAP.get(token);
      if (synonyms) {
        for (const syn of synonyms.slice(0, 3)) { // Limit synonyms per term
          const expanded = normalizedOriginal.replace(
            new RegExp(`\\b${token}\\b`, 'gi'),
            syn
          );
          if (!seen.has(expanded) && expansions.length < opts.maxExpansions) {
            seen.add(expanded);
            expansions.push({
              query: expanded,
              type: 'synonym',
              weight: opts.synonymWeight,
              source: `${token} → ${syn}`
            });
          }
        }
      }
    }
  }
  
  // 2. Acronym expansion/contraction
  if (opts.includeAcronyms) {
    for (const token of tokens) {
      // Try expanding acronym
      const expansion = ACRONYM_MAP.get(token);
      if (expansion) {
        const expanded = normalizedOriginal.replace(
          new RegExp(`\\b${token}\\b`, 'gi'),
          expansion
        );
        if (!seen.has(expanded) && expansions.length < opts.maxExpansions) {
          seen.add(expanded);
          expansions.push({
            query: expanded,
            type: 'acronym',
            weight: 0.9,
            source: `${token} → ${expansion}`
          });
        }
      }
      
      // Try contracting to acronym
      for (const [acronym, full] of ACRONYM_MAP) {
        if (normalizedOriginal.includes(full)) {
          const contracted = normalizedOriginal.replace(full, acronym);
          if (!seen.has(contracted) && expansions.length < opts.maxExpansions) {
            seen.add(contracted);
            expansions.push({
              query: contracted,
              type: 'acronym',
              weight: 0.85,
              source: `${full} → ${acronym}`
            });
          }
        }
      }
    }
  }
  
  // 3. Partial/component queries
  if (opts.includePartial && tokens.length > 2) {
    // Create query from most important tokens (non-stopwords)
    const importantTokens = tokens.filter(t => !STOPWORDS.has(t));
    if (importantTokens.length >= 2 && importantTokens.length < tokens.length) {
      const partial = importantTokens.join(' ');
      if (!seen.has(partial) && expansions.length < opts.maxExpansions) {
        seen.add(partial);
        expansions.push({
          query: partial,
          type: 'partial',
          weight: 0.7,
          source: 'key terms only'
        });
      }
    }
  }
  
  // 4. Combined expansion (synonym + acronym for single token queries)
  if (tokens.length === 1 && opts.includeSynonyms && opts.includeAcronyms) {
    const token = tokens[0];
    const synonyms = SYNONYM_MAP.get(token) || [];
    const acronymExpansion = ACRONYM_MAP.get(token);
    
    // Combine: "api" -> "rest interface" (acronym word + synonym)
    if (acronymExpansion && synonyms.length > 0) {
      const combined = `${synonyms[0]} ${acronymExpansion.split(' ')[0]}`;
      if (!seen.has(combined) && expansions.length < opts.maxExpansions) {
        seen.add(combined);
        expansions.push({
          query: combined,
          type: 'combined',
          weight: 0.6,
          source: 'combined expansion'
        });
      }
    }
  }
  
  return expansions.slice(0, opts.maxExpansions);
};

/**
 * Get all synonyms for a term
 */
export const getSynonyms = (term: string): string[] => {
  const normalized = term.toLowerCase().trim();
  return SYNONYM_MAP.get(normalized) || [];
};

/**
 * Expand an acronym to its full form
 */
export const expandAcronym = (acronym: string): string | undefined => {
  return ACRONYM_MAP.get(acronym.toLowerCase().trim());
};

/**
 * Add custom synonyms (useful for domain-specific terms)
 */
export const addSynonyms = (term: string, synonyms: string[]): void => {
  const normalized = term.toLowerCase().trim();
  const existing = SYNONYM_MAP.get(normalized) || [];
  SYNONYM_MAP.set(normalized, [...new Set([...existing, ...synonyms])]);
};

/**
 * Add custom acronym (useful for domain-specific abbreviations)
 */
export const addAcronym = (acronym: string, expansion: string): void => {
  ACRONYM_MAP.set(acronym.toLowerCase().trim(), expansion.toLowerCase().trim());
};

// Note: BM25, reciprocalRankFusion, fuseWithRRF, mmrRerank, diversityFilter, 
// enhancedHybridSearch, expandQuery, getSynonyms, expandAcronym, addSynonyms, 
// addAcronym are exported at their declarations above.
