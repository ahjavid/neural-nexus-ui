export { dbManager, migrateFromLocalStorage } from './storage';
export { processDocument, extractPdfText, extractWordText, extractExcelText, chunkText, fetchUrlContent } from './documents';
export { formatBytes, formatFileSize, getFileExtension, FILE_CONFIG, DEFAULT_PARAMS, getApiUrl } from './helpers';
export { toolRegistry, ToolRegistry, getLastSearchExplanation, clearEmbeddingCache } from './tools';

// Neurosymbolic AI exports
export {
  extractEntities,
  extractKeywords,
  extractPhrases,
  createKnowledgeGraph,
  hybridSearch,
  buildReasoningChain,
  formatReasoningChain,
  decomposeQuery,
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
  type ReasoningChain
} from './neurosymbolic';
