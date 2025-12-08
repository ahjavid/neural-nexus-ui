export { dbManager, migrateFromLocalStorage } from './storage';
export { 
  processDocument, 
  extractPdfText, 
  extractWordText, 
  extractExcelText, 
  chunkText, 
  fetchUrlContent,
  // Semantic chunking
  semanticChunk,
  autoChunk,
  getDocumentSummary,
  // Types
  type ChunkingStrategy,
  type ChunkOptions,
  type SemanticChunkOptions,
  type EnhancedKnowledgeChunk
} from './documents';
export { 
  formatBytes, 
  formatFileSize, 
  getFileExtension, 
  FILE_CONFIG, 
  DEFAULT_PARAMS, 
  getApiUrl,
  // Context management
  estimateTokens,
  estimateMessagesTokens,
  manageContext,
  formatTokenCount,
  getContextUsage,
  // Dynamic repetition penalty
  calculateDynamicRepeatPenalty,
  getPersonaRepeatConfig,
  DEFAULT_DYNAMIC_REPEAT_CONFIG,
  type ContextConfig,
  type ContextResult,
  type DynamicRepeatPenaltyConfig
} from './helpers';
export { toolRegistry, ToolRegistry, getLastSearchExplanation, clearEmbeddingCache, setConversationContext } from './tools';

// Neurosymbolic AI exports
export {
  // Core functions
  extractEntities,
  extractKeywords,
  createKnowledgeGraph,
  hybridSearch,
  buildReasoningChain,
  formatReasoningChain,
  decomposeQuery,
  cosineSimilarity,
  // Enhanced search with BM25, RRF, MMR
  BM25,
  reciprocalRankFusion,
  fuseWithRRF,
  mmrRerank,
  enhancedHybridSearch,
  // Query expansion
  expandQuery,
  getSynonyms,
  expandAcronym,
  addSynonyms,
  addAcronym,
  // Query rewriting with context
  rewriteQueryWithContext,
  queryNeedsContext,
  // Types
  type EntityType,
  type ExtractedEntity,
  type EntityExtractionResult,
  type KnowledgeNode,
  type KnowledgeGraph,
  type KnowledgeRelation,
  type RelationType,
  type HybridSearchResult,
  type HybridSearchOptions,
  type SearchResultExplanation,
  type ReasoningStep,
  type ReasoningChain,
  type BM25Config,
  type RRFOptions,
  type RankedItem,
  type MMROptions,
  type MMRItem,
  type EnhancedHybridSearchOptions,
  type ExpandedQuery,
  type QueryExpansionOptions,
  type QueryRewriteConfig,
  type ContextMessage,
  type RewrittenQuery
} from './neurosymbolic';

