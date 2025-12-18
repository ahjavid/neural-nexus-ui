/**
 * Multi-Agent Collaboration System - CONTEXT-AWARE VERSION
 * 
 * =====================================================================
 * ADVANCED CONTEXT FLOW ARCHITECTURE
 * =====================================================================
 * 
 * Based on production patterns from:
 * - LangGraph Supervisor: output_mode="full_history", state management
 * - LangGraph Swarm: SwarmState, handoff context, task_description passing
 * - AutoGen: Session memory, structured message types, BufferedChatCompletionContext
 * 
 * KEY IMPROVEMENTS IN THIS VERSION:
 * 
 * 1. UNIFIED TASK STATE (TaskRequirements + AgentWorkState)
 *    - Original user request preserved throughout
 *    - Extracted goal, input/output types, edge cases
 *    - Example inputs generated for consistent testing
 *    - All agents work toward SAME objective
 * 
 * 2. CONTEXT-AWARE HANDOFFS
 *    - Expert gets: Task + Structured Requirements + Examples
 *    - Reviewer gets: Task + Requirements + CODE ONLY (prevents echo chamber)
 *    - Refiner gets: Task + Requirements + Code + Specific Bugs
 * 
 * 3. OBJECTIVE VERIFICATION
 *    - Reviewer explicitly checks: "Does code achieve the original goal?"
 *    - objective_met field in review JSON
 *    - Mismatch triggers BUGS_FOUND even if code "looks correct"
 * 
 * 4. STRUCTURED OUTPUT VALIDATION
 *    - JSON schema for review output
 *    - Consistency checking: trace_test, edge_tests, bugs_found must match verdict
 *    - Auto-detect inconsistencies and flag them
 * 
 * 5. EDGE CASE EXTRACTION
 *    - Auto-identify edge cases from task description
 *    - Generate dynamic edge test fields based on task
 *    - All edge tests must PASS for NO_BUGS verdict
 * 
 * BROWSER LIMITATIONS:
 * - Cannot execute Python/arbitrary code
 * - Cannot run unit tests
 * - Cannot guarantee correctness
 * - No Docker/sandbox available
 * 
 * PRODUCTION WARNING:
 * This system provides ASSISTANCE, not VERIFICATION.
 * All generated code MUST be tested by humans before use.
 */

import type { 
  AgentConfig, 
  AgentResult, 
  PeerReviewConfig, 
  PeerReviewResponse,
  ApiProvider 
} from '../types';
import { getApiUrl } from './helpers';
import { streamGroqChat, convertToGroqMessages, getGroqModelInfo } from './groq';
import { validatePythonSyntax } from './pyodide';

// ============================================
// CONTEXT STATE - Track full workflow state
// Based on LangGraph SwarmState and AutoGen session memory
// ============================================

/**
 * Task type determines which evaluation framework to apply.
 * CRITICAL: Using wrong framework = useless review (e.g., code tracing for prose)
 */
type TaskType = 
  | 'code_algorithm'      // Write a function, implement algorithm
  | 'code_script'         // Write a bash/python script
  | 'code_debug'          // Fix existing code
  | 'explanation'         // Explain a concept
  | 'instructions'        // How-to guide, procedural steps
  | 'design'              // Architecture, database design
  | 'analysis'            // Analyze data, compare options
  | 'general';            // Catch-all

/**
 * Review strategy matched to task type
 */
interface ReviewStrategy {
  type: TaskType;
  checkLogic: boolean;           // Trace execution, check operators
  checkSyntax: boolean;          // Validate code syntax
  checkCompleteness: boolean;    // Are all steps/requirements covered?
  checkAccuracy: boolean;        // Are facts/commands correct?
  checkSafety: boolean;          // Dangerous recommendations?
  exampleFormat: 'trace' | 'scenarios' | 'none';
}

const REVIEW_STRATEGIES: Record<TaskType, ReviewStrategy> = {
  code_algorithm: {
    type: 'code_algorithm',
    checkLogic: true,
    checkSyntax: true,
    checkCompleteness: true,
    checkAccuracy: false,
    checkSafety: false,
    exampleFormat: 'trace'
  },
  code_script: {
    type: 'code_script',
    checkLogic: true,
    checkSyntax: true,
    checkCompleteness: true,
    checkAccuracy: true,      // Command syntax matters
    checkSafety: true,        // Scripts can be destructive
    exampleFormat: 'scenarios'
  },
  code_debug: {
    type: 'code_debug',
    checkLogic: true,
    checkSyntax: true,
    checkCompleteness: false,
    checkAccuracy: false,
    checkSafety: false,
    exampleFormat: 'trace'
  },
  explanation: {
    type: 'explanation',
    checkLogic: false,
    checkSyntax: false,
    checkCompleteness: true,
    checkAccuracy: true,
    checkSafety: false,
    exampleFormat: 'none'
  },
  instructions: {
    type: 'instructions',
    checkLogic: false,
    checkSyntax: false,
    checkCompleteness: true,   // Missing steps?
    checkAccuracy: true,       // Commands correct?
    checkSafety: true,         // Dangerous advice?
    exampleFormat: 'scenarios'
  },
  design: {
    type: 'design',
    checkLogic: false,
    checkSyntax: false,
    checkCompleteness: true,
    checkAccuracy: true,
    checkSafety: true,
    exampleFormat: 'scenarios'
  },
  analysis: {
    type: 'analysis',
    checkLogic: false,
    checkSyntax: false,
    checkCompleteness: true,
    checkAccuracy: true,
    checkSafety: false,
    exampleFormat: 'none'
  },
  general: {
    type: 'general',
    checkLogic: false,
    checkSyntax: false,
    checkCompleteness: true,
    checkAccuracy: true,
    checkSafety: false,
    exampleFormat: 'none'
  }
};

interface TaskRequirements {
  originalRequest: string;          // What user asked for
  extractedGoal: string;            // Parsed main objective
  taskType: TaskType;               // Detected task type
  reviewStrategy: ReviewStrategy;   // How to review this task
  expectedInputType: string;        // e.g., "array of numbers"
  expectedOutputType: string;       // e.g., "single number"
  edgeCases: string[];              // Identified edge cases
  exampleInputs: string[];          // Concrete test inputs
  exampleOutputs: string[];         // Expected outputs for those inputs
}

interface AgentWorkState {
  // The full context passed between agents
  task: TaskRequirements;
  
  // Expert's work product
  expertAnalysis: {
    requirements: string;           // Expert's understanding
    handWorkedExamples: Array<{
      input: string;
      steps: string;
      output: string;
    }>;
    code: string;                   // The generated code
    selfTrace: string;              // Expert's own trace
  } | null;
  
  // Reviewer's findings
  reviewFindings: {
    traceResults: Array<{
      input: string;
      expectedOutput: string;
      actualOutput: string;
      passed: boolean;
      traceSteps: string;
    }>;
    edgeResults: Record<string, { result: string; passed: boolean }>;
    objectiveMet: boolean;          // Does code achieve the original goal?
    requirementsMet: Record<string, boolean>;
    bugs: Array<{ line?: number; issue: string; fix: string }>;
  } | null;
  
  // Final synthesis
  correctedCode: string | null;
  verificationPassed: boolean;
}

// Default agent configurations - HARDENED for adversarial review
export const defaultAgentConfigs: [AgentConfig, AgentConfig, AgentConfig] = [
  {
    id: 'agent-primary',
    name: 'Primary',
    model: '',
    role: 'implementer',
    systemPrompt: `You are a careful programmer who prevents bugs by working examples FIRST.

MANDATORY PROCESS:

## Step 1: UNDERSTAND
What are the inputs, outputs, and edge cases?

## Step 2: EXAMPLES FIRST (before ANY code)
Work 3 examples BY HAND with actual numbers:

Example 1 (simple): Input=[2,1,3] → sort → [1,2,3] → second element → 2
Example 2 (with duplicates): Input=[5,5,4] → ...
Example 3 (edge): Input=[1] → only one element → handle error or return what?

SHOW EVERY ARITHMETIC STEP.

## Step 3: WRITE CODE
Now write code that matches your hand-worked examples.

## Step 4: DRY RUN
Trace Example 1 through your code:
- Line 1: variable x = ...
- Line 2: loop iteration 1: ...
- Final return value: ...
Does it match Step 2? If not, FIX IT.`
  },
  {
    id: 'agent-checker',
    name: 'Adversary', 
    model: '',
    role: 'reviewer',
    systemPrompt: `You are a bug hunter. Your job is to FIND PROBLEMS, not approve code.

ACTUALLY TRACE THE CODE. Don't just say "looks correct."

For the code given, answer these with SPECIFIC EVIDENCE:

1. TRACE TEST: Pick input [3,1,2]. What does the code ACTUALLY return?
   Show each line execution. What is the final value?

2. EDGE TEST: What happens with empty input []? With single element [5]?
   Trace the code - does it crash? Return wrong value?

3. OPERATOR CHECK: For each +, -, <, >, ==, check if it's the RIGHT operator.
   If finding max, should it be > or <? Trace to verify.

4. OFF-BY-ONE: For each loop, what's the first index? Last index?
   Does it go out of bounds?

OUTPUT (JSON required):
\`\`\`json
{
  "trace_test": {
    "input": "[3,1,2]",
    "execution": "step by step trace",
    "actual_output": "what it returns",
    "expected_output": "what it should return",
    "status": "PASS|FAIL"
  },
  "edge_tests": {
    "empty": {"result": "...", "status": "PASS|FAIL"},
    "single": {"result": "...", "status": "PASS|FAIL"}
  },
  "bugs_found": [
    {"line": N, "issue": "description", "fix": "exact fix"}
  ],
  "verdict": "BUGS_FOUND|NO_BUGS_FOUND"
}
\`\`\``
  },
  {
    id: 'agent-final',
    name: 'Final',
    model: '',
    role: 'synthesizer', 
    systemPrompt: `Apply ONLY the listed bug fixes. Change nothing else. If no bugs listed, return the original code unchanged.`
  }
];

const AGENTIC_CONFIG_KEY = 'nexus_agentic_config';

// ============================================
// TASK TYPE DETECTION
// CRITICAL: Wrong type = wrong review framework = useless review
// ============================================

/**
 * Detect what type of task this is to select appropriate review strategy.
 * This prevents applying code review to prose, or vice versa.
 */
function detectTaskType(task: string): TaskType {
  const lower = task.toLowerCase();
  
  // Code algorithm indicators
  if (
    lower.match(/\b(function|implement|algorithm|write\s+(a\s+)?code|coding|program)\b/) &&
    lower.match(/\b(return|input|output|array|list|number|string|sort|find|compute|calculate)\b/)
  ) {
    return 'code_algorithm';
  }
  
  // Script indicators
  if (
    lower.match(/\b(script|bash|shell|powershell|python\s+script|automate)\b/) ||
    lower.match(/\b(cron|scheduled|batch)\b/)
  ) {
    return 'code_script';
  }
  
  // Debug/fix indicators
  if (
    lower.match(/\b(fix|debug|bug|error|doesn't work|not working|broken|issue)\b/) &&
    lower.match(/\b(code|function|script|program)\b/)
  ) {
    return 'code_debug';
  }
  
  // Instructions/how-to indicators
  if (
    lower.match(/\b(how\s+(do|can|to|should)|steps|procedure|guide|instructions|migrate|move|transfer|setup|install|configure|deploy)\b/) ||
    lower.match(/\b(what\s+steps|walk\s+me\s+through)\b/)
  ) {
    return 'instructions';
  }
  
  // Design indicators
  if (
    lower.match(/\b(design|architecture|schema|structure|model|plan|database\s+design|system\s+design)\b/)
  ) {
    return 'design';
  }
  
  // Explanation indicators
  if (
    lower.match(/\b(explain|what\s+is|how\s+does|why\s+(does|is)|describe|difference\s+between)\b/)
  ) {
    return 'explanation';
  }
  
  // Analysis indicators
  if (
    lower.match(/\b(analyze|compare|evaluate|assess|review|pros\s+and\s+cons|trade-?offs)\b/)
  ) {
    return 'analysis';
  }
  
  // Default: check if it looks like code request
  if (lower.match(/\b(function|def|class|return|loop|array|variable)\b/)) {
    return 'code_algorithm';
  }
  
  return 'general';
}

// ============================================
// TASK PARSING - Extract structured requirements from user request
// Based on AutoGen's structured task decomposition
// ============================================

/**
 * Parse user's task into structured requirements.
 * This ensures ALL agents work toward the SAME objective.
 */
function parseTaskRequirements(task: string): TaskRequirements {
  // FIRST: Detect task type to select review strategy
  const taskType = detectTaskType(task);
  const reviewStrategy = REVIEW_STRATEGIES[taskType];
  
  // Extract key elements from natural language task
  const inputMatch = task.match(/(?:given|input|takes?|accepts?|receives?)\s*[:\-]?\s*([^,\.\n]+)/i);
  const outputMatch = task.match(/(?:return|output|find|compute|calculate|get)\s*[:\-]?\s*([^,\.\n]+)/i);
  
  // Identify edge cases/scenarios based on task TYPE
  const edgeCases: string[] = [];
  
  if (taskType === 'code_algorithm' || taskType === 'code_debug') {
    // Code-specific edge cases
    if (task.match(/array|list|sequence/i)) {
      edgeCases.push('empty array []');
      edgeCases.push('single element [x]');
      edgeCases.push('duplicates [x, x, x]');
    }
    if (task.match(/string/i)) {
      edgeCases.push('empty string ""');
      edgeCases.push('single char "a"');
    }
    if (task.match(/number|integer/i)) {
      edgeCases.push('zero (0)');
      edgeCases.push('negative numbers');
    }
  } else if (taskType === 'instructions' || taskType === 'code_script') {
    // Instructions/script-specific scenarios
    if (task.match(/database|db/i)) {
      edgeCases.push('live/production database with active connections');
      edgeCases.push('very large database (>100GB)');
      edgeCases.push('network interruption during transfer');
      edgeCases.push('rollback needed after failure');
    }
    if (task.match(/migrate|move|transfer/i)) {
      edgeCases.push('source unavailable mid-process');
      edgeCases.push('destination has insufficient space');
      edgeCases.push('permissions/access issues');
    }
    if (task.match(/server|deploy|install/i)) {
      edgeCases.push('existing data that must be preserved');
      edgeCases.push('service dependencies');
      edgeCases.push('rollback procedure');
    }
  } else if (taskType === 'design') {
    edgeCases.push('scalability requirements');
    edgeCases.push('failure scenarios');
    edgeCases.push('security considerations');
  }
  
  // Generate example inputs based on task type
  const exampleInputs: string[] = [];
  const exampleOutputs: string[] = [];
  
  if (taskType === 'code_algorithm' && task.match(/array|list/i)) {
    exampleInputs.push('[3, 1, 4, 1, 5]');
    exampleInputs.push('[2, 1]');
    exampleInputs.push('[7]');
  }
  
  return {
    originalRequest: task,
    extractedGoal: outputMatch?.[1]?.trim() || 'complete the task',
    taskType,
    reviewStrategy,
    expectedInputType: inputMatch?.[1]?.trim() || 'input',
    expectedOutputType: outputMatch?.[1]?.trim() || 'output',
    edgeCases,
    exampleInputs,
    exampleOutputs
  };
}

/**
 * Parse expert's response to extract structured work product
 */
function parseExpertResponse(content: string): AgentWorkState['expertAnalysis'] {
  const codeOnly = extractCodeFromResponse(content);
  
  // Extract hand-worked examples
  const examplesSection = content.match(/example\s*\d?[:\-]?\s*([^\n]*(?:\n(?!example|step|##)[^\n]*)*)/gi);
  const examples = examplesSection?.map(ex => {
    const inputMatch = ex.match(/input\s*[=:]?\s*([^\n→]+)/i);
    const outputMatch = ex.match(/(?:→|output|result|=)\s*([^\n]+)/i);
    return {
      input: inputMatch?.[1]?.trim() || '',
      steps: ex.replace(/input.*?(?=→|output)/i, '').trim(),
      output: outputMatch?.[1]?.trim() || ''
    };
  }) || [];
  
  // Extract requirements understanding
  const reqSection = content.match(/(?:requirements?|understand|step\s*1)[:\-]?\s*([^\n]*(?:\n(?!step|##)[^\n]*){0,10})/i);
  
  // Extract self-trace/verification
  const traceSection = content.match(/(?:trace|verify|dry\s*run)[:\-]?\s*([^\n]*(?:\n(?!##)[^\n]*){0,20})/i);
  
  return {
    requirements: reqSection?.[1]?.trim() || '',
    handWorkedExamples: examples,
    code: codeOnly,
    selfTrace: traceSection?.[1]?.trim() || ''
  };
}

/**
 * Parse reviewer's response to extract structured findings
 */
function parseReviewerResponse(content: string, taskReqs: TaskRequirements): NonNullable<AgentWorkState['reviewFindings']> {
  const parsed = parseReviewJSON(content);
  
  // Extract trace results
  const traceResults: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    traceSteps: string;
  }> = [];
  if (parsed?.trace_test) {
    traceResults.push({
      input: parsed.trace_test.input,
      expectedOutput: parsed.trace_test.expected_output,
      actualOutput: parsed.trace_test.actual_output,
      passed: parsed.trace_test.status === 'PASS',
      traceSteps: parsed.trace_test.execution
    });
  }
  
  // Extract edge test results
  const edgeResults: Record<string, { result: string; passed: boolean }> = {};
  if (parsed?.edge_tests) {
    if (parsed.edge_tests.empty) {
      edgeResults['empty'] = {
        result: parsed.edge_tests.empty.result,
        passed: parsed.edge_tests.empty.status === 'PASS'
      };
    }
    if (parsed.edge_tests.single) {
      edgeResults['single'] = {
        result: parsed.edge_tests.single.result,
        passed: parsed.edge_tests.single.status === 'PASS'
      };
    }
  }
  
  // Check if objective is met (look for explicit statement)
  const objectiveMet = !(
    content.toLowerCase().includes('does not') && content.toLowerCase().includes(taskReqs.extractedGoal.toLowerCase())
  ) && parsed?.verdict !== 'BUGS_FOUND';
  
  return {
    traceResults,
    edgeResults,
    objectiveMet,
    requirementsMet: {},
    bugs: parsed?.bugs_found || []
  };
}

// ============================================
// SYNTAX VALIDATION (What we CAN actually verify)
// ============================================

/**
 * Validate JavaScript/TypeScript syntax using Function constructor.
 * This is one of the FEW things we can actually verify in browser.
 */
function validateJavaScriptSyntax(code: string): { valid: boolean; error?: string } {
  try {
    // Try to parse as function body
    new Function(code);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * Detect language from code block markers or content
 * Enhanced detection with more patterns for accuracy
 */
function detectLanguage(code: string): 'javascript' | 'typescript' | 'python' | 'unknown' {
  // Python indicators (stronger detection)
  const pythonPatterns = [
    /^def\s+\w+\s*\(/m,           // def function(
    /^class\s+\w+.*:/m,          // class Name:
    /^import\s+\w+/m,            // import module
    /^from\s+\w+\s+import/m,     // from module import
    /:\s*$/m,                     // lines ending with :
    /^\s*elif\s+/m,               // elif (Python-specific)
    /print\s*\(/,                 // print(
    /__init__/,                   // __init__
    /self\./,                     // self.
  ];
  
  // TypeScript indicators
  const tsPatterns = [
    /:\s*(string|number|boolean|any|void|never)/,  // type annotations
    /interface\s+\w+/,            // interface
    /<[A-Z]\w*>/,                 // generics like <T>
    /as\s+(string|number|boolean|any)/, // type assertions
  ];
  
  // JavaScript indicators
  const jsPatterns = [
    /^function\s+\w+\s*\(/m,      // function name(
    /^const\s+\w+\s*=/m,          // const x =
    /^let\s+\w+\s*=/m,            // let x =
    /=>\s*[{(]/,                  // arrow functions
    /console\.log\(/,             // console.log(
  ];
  
  const pythonScore = pythonPatterns.filter(r => r.test(code)).length;
  const tsScore = tsPatterns.filter(r => r.test(code)).length;
  const jsScore = jsPatterns.filter(r => r.test(code)).length;
  
  // Python is distinctive - if it has Python patterns, it's likely Python
  if (pythonScore >= 2) return 'python';
  if (tsScore >= 2) return 'typescript';
  if (jsScore >= 1 || pythonScore === 0) return 'javascript';
  
  return 'unknown';
}

/**
 * Parse structured JSON from review output
 * Returns null if parsing fails - this is critical for validation
 */
function parseReviewJSON(content: string): { 
  objective_met?: { task_asks_for: string; code_returns: string; match: boolean };
  trace_test?: { input: string; execution: string; actual_output: string; expected_output: string; status: string };
  edge_tests?: Record<string, { result: string; status: string }>;
  checks?: Record<string, { status: string; evidence?: string }>;
  bugs_found?: Array<{ line?: number; issue: string; fix: string }>;
  verdict?: string;
} | null {
  // Find JSON block in content
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    // Try to find raw JSON object
    const rawMatch = content.match(/\{[\s\S]*"(?:verdict|bugs_found|trace_test|objective_met|issues_found|content_quality)"[\s\S]*\}/);
    if (!rawMatch) return null;
    try {
      return JSON.parse(rawMatch[0]);
    } catch {
      return null;
    }
  }
  
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    return null;
  }
}

// ============================================
// TASK-TYPE-SPECIFIC REVIEW PROMPT GENERATION
// CRITICAL: This prevents applying code review to prose
// ============================================

/**
 * Generate review prompt based on task type.
 * Code tasks get trace-based review.
 * Instructions/guides get content quality review.
 */
function generateReviewPrompt(
  task: string,
  content: string,
  taskReqs: TaskRequirements
): string {
  const { taskType } = taskReqs;
  
  // CODE-BASED TASKS: Use trace/logic review
  if (taskType === 'code_algorithm' || taskType === 'code_debug') {
    return generateCodeReviewPrompt(task, content, taskReqs);
  }
  
  // SCRIPT TASKS: Hybrid - check both logic and command accuracy
  if (taskType === 'code_script') {
    return generateScriptReviewPrompt(task, content, taskReqs);
  }
  
  // INSTRUCTIONS/GUIDES: Check completeness, accuracy, safety
  if (taskType === 'instructions') {
    return generateInstructionsReviewPrompt(task, content, taskReqs);
  }
  
  // DESIGN: Check completeness and edge cases
  if (taskType === 'design') {
    return generateDesignReviewPrompt(task, content, taskReqs);
  }
  
  // EXPLANATION/ANALYSIS/GENERAL: Check accuracy and completeness
  return generateContentReviewPrompt(task, content, taskReqs);
}

function generateCodeReviewPrompt(task: string, code: string, taskReqs: TaskRequirements): string {
  const { edgeCases, exampleInputs } = taskReqs;
  
  return `# Code Review

## ORIGINAL TASK
${task}

## CODE TO REVIEW
\`\`\`
${code}
\`\`\`

## YOUR JOB: Find bugs through ACTUAL TRACING

### Step 1: TRACE TEST
Pick input ${exampleInputs[0] || '[3, 1, 2]'} and trace line by line:
\`\`\`
Line 1: [variable] = [value]
Line 2: [what happens]
...
Return: [final value]
\`\`\`
Expected: [calculate by hand]
Actual: [from trace]

### Step 2: EDGE CASES
${edgeCases.map(ec => `- ${ec}: trace what happens`).join('\n')}

### Step 3: OPERATOR/LOGIC CHECK
- Off-by-one errors?
- Wrong operators (+/-, </>, &&/||)?
- Index bounds?

## OUTPUT (JSON required)
\`\`\`json
{
  "trace_test": {
    "input": "${exampleInputs[0] || '[3, 1, 2]'}",
    "execution": "[line by line]",
    "actual_output": "[from trace]",
    "expected_output": "[by hand]",
    "status": "PASS|FAIL"
  },
  "edge_tests": {
    ${edgeCases.slice(0, 2).map(ec => `"${ec.replace(/[^a-zA-Z0-9]/g, '_')}": {"result": "...", "status": "PASS|FAIL"}`).join(',\n    ') || '"empty": {"result": "...", "status": "PASS|FAIL"}'}
  },
  "bugs_found": [{"line": N, "issue": "...", "fix": "..."}],
  "verdict": "BUGS_FOUND|NO_BUGS_FOUND"
}
\`\`\`

RULE: If ANY test FAILs, verdict MUST be BUGS_FOUND.`;
}

function generateScriptReviewPrompt(task: string, script: string, taskReqs: TaskRequirements): string {
  return `# Script Review

## ORIGINAL TASK
${task}

## SCRIPT TO REVIEW
\`\`\`
${script}
\`\`\`

## YOUR JOB: Check BOTH logic AND command accuracy

### Step 1: COMMAND SYNTAX CHECK
For EACH command in the script:
- Is the command name correct?
- Are the flags/options valid? (e.g., --bytes not --additional)
- Is the syntax correct for the target shell?

### Step 2: SAFETY CHECK
- Could this damage data? (rm -rf, overwrite without backup)
- Race conditions with live systems?
- Missing error handling?
- Dangerous on production?

### Step 3: COMPLETENESS
- Does it handle errors?
- Does it validate inputs?
- Are there missing steps?

### Step 4: SCENARIOS
${taskReqs.edgeCases.map(ec => `- ${ec}: what happens?`).join('\n')}

## OUTPUT (JSON required)
\`\`\`json
{
  "command_checks": [
    {"command": "...", "valid": true/false, "issue": "if invalid, what's wrong"}
  ],
  "safety_issues": [
    {"line": "...", "risk": "...", "mitigation": "..."}
  ],
  "completeness": {
    "missing_steps": ["..."],
    "missing_error_handling": ["..."]
  },
  "issues_found": [{"location": "...", "issue": "...", "fix": "..."}],
  "verdict": "ISSUES_FOUND|NO_ISSUES_FOUND"
}
\`\`\``;
}

function generateInstructionsReviewPrompt(task: string, content: string, taskReqs: TaskRequirements): string {
  return `# Instructions/Guide Review

## ORIGINAL QUESTION
${task}

## RESPONSE TO REVIEW
${content}

## YOUR JOB: Review as TECHNICAL DOCUMENTATION, not code

⚠️ THIS IS NOT CODE - Do NOT ask for "traces" or "loop bounds"

### Step 1: TECHNICAL ACCURACY
For each technical claim or command:
- Is the information factually correct?
- Are command syntaxes valid? (check flags, options)
- Are tool recommendations appropriate?

### Step 2: SAFETY CHECK
- Any dangerous recommendations? (e.g., rsync on live database)
- Missing warnings for destructive operations?
- Production-unsafe practices?

### Step 3: COMPLETENESS
Does the guide cover:
- Prerequisites/requirements?
- All necessary steps in order?
- Verification/testing steps?
- Rollback/recovery procedures?
- Error handling?

### Step 4: SCENARIOS
${taskReqs.edgeCases.map(ec => `- ${ec}: is this addressed?`).join('\n')}

## OUTPUT (JSON required)
\`\`\`json
{
  "accuracy_checks": [
    {"claim": "...", "valid": true/false, "correction": "if wrong, what's correct"}
  ],
  "safety_issues": [
    {"recommendation": "...", "risk": "...", "better_approach": "..."}
  ],
  "completeness": {
    "covered": ["list of covered topics"],
    "missing": ["list of missing critical steps"],
    "status": "COMPLETE|INCOMPLETE"
  },
  "issues_found": [
    {"location": "quote the problematic text", "issue": "what's wrong", "fix": "correct version"}
  ],
  "verdict": "ISSUES_FOUND|NO_ISSUES_FOUND"
}
\`\`\`

RULES:
1. Do NOT apply code review criteria (no trace tests, no loop bounds)
2. Focus on technical accuracy and completeness
3. Flag dangerous recommendations
4. If ANY accuracy/safety issue found, verdict = ISSUES_FOUND`;
}

function generateDesignReviewPrompt(task: string, content: string, taskReqs: TaskRequirements): string {
  return `# Design Review

## ORIGINAL QUESTION
${task}

## DESIGN TO REVIEW
${content}

## YOUR JOB: Review architecture/design quality

### Step 1: REQUIREMENTS COVERAGE
- Does the design address all stated requirements?
- Are there unstated requirements it should address?

### Step 2: SCALABILITY & PERFORMANCE
- Will this scale to expected load?
- Any obvious performance bottlenecks?

### Step 3: FAILURE MODES
${taskReqs.edgeCases.map(ec => `- ${ec}: how does design handle this?`).join('\n')}

### Step 4: SECURITY
- Any security vulnerabilities?
- Data protection considerations?

## OUTPUT (JSON required)
\`\`\`json
{
  "requirements_coverage": {"covered": [...], "missing": [...]},
  "scalability": {"status": "ADEQUATE|CONCERN", "notes": "..."},
  "failure_handling": {"addressed": [...], "missing": [...]},
  "security": {"issues": [...], "recommendations": [...]},
  "issues_found": [{"aspect": "...", "issue": "...", "recommendation": "..."}],
  "verdict": "ISSUES_FOUND|NO_ISSUES_FOUND"
}
\`\`\``;
}

function generateContentReviewPrompt(task: string, content: string, _taskReqs: TaskRequirements): string {
  return `# Content Review

## ORIGINAL QUESTION
${task}

## RESPONSE TO REVIEW
${content}

## YOUR JOB: Review for accuracy and completeness

⚠️ THIS IS NOT CODE - Do NOT ask for "traces" or "loop bounds"

### Step 1: ACCURACY
- Are the facts correct?
- Are any claims misleading or outdated?

### Step 2: COMPLETENESS
- Does it fully answer the question?
- Are there important aspects not covered?

### Step 3: CLARITY
- Is the explanation clear?
- Are there confusing parts?

## OUTPUT (JSON required)
\`\`\`json
{
  "accuracy": {"issues": [{"claim": "...", "problem": "...", "correction": "..."}]},
  "completeness": {"covered": [...], "missing": [...]},
  "clarity": {"issues": [...]},
  "issues_found": [{"location": "...", "issue": "...", "fix": "..."}],
  "verdict": "ISSUES_FOUND|NO_ISSUES_FOUND"
}
\`\`\`

Focus on whether the response is helpful and correct, NOT on code metrics.`;
}

/**
 * Validate review consistency - check if verdict matches actual findings
 */
function validateReviewConsistency(parsed: ReturnType<typeof parseReviewJSON>): {
  isConsistent: boolean;
  issues: string[];
} {
  if (!parsed) return { isConsistent: false, issues: ['Could not parse review JSON'] };
  
  const issues: string[] = [];
  
  // Check if objective_met is false but verdict says no bugs
  if (parsed.objective_met?.match === false && parsed.verdict === 'NO_BUGS_FOUND') {
    issues.push(`Objective NOT met (code returns "${parsed.objective_met.code_returns}" but task asks for "${parsed.objective_met.task_asks_for}") but verdict says NO_BUGS_FOUND`);
  }
  
  // Check if trace_test failed but verdict says no bugs
  if (parsed.trace_test?.status === 'FAIL' && parsed.verdict === 'NO_BUGS_FOUND') {
    issues.push('Trace test FAILED but verdict says NO_BUGS_FOUND');
  }
  
  // Check if ANY edge tests failed but verdict says no bugs
  if (parsed.edge_tests) {
    const failedEdge = Object.entries(parsed.edge_tests)
      .filter(([, v]) => v.status === 'FAIL')
      .map(([k]) => k);
    if (failedEdge.length > 0 && parsed.verdict === 'NO_BUGS_FOUND') {
      issues.push(`Edge tests FAILED (${failedEdge.join(', ')}) but verdict says NO_BUGS_FOUND`);
    }
  }
  
  // Check if bugs_found is non-empty but verdict says no bugs
  if (parsed.bugs_found && parsed.bugs_found.length > 0 && parsed.verdict === 'NO_BUGS_FOUND') {
    issues.push(`Found ${parsed.bugs_found.length} bugs but verdict says NO_BUGS_FOUND`);
  }
  
  // Check if verdict says bugs found but bugs_found is empty
  if (parsed.verdict === 'BUGS_FOUND' && (!parsed.bugs_found || parsed.bugs_found.length === 0)) {
    issues.push('Verdict says BUGS_FOUND but no bugs listed');
  }
  
  // Check old format consistency
  if (parsed.checks) {
    const failedChecks = Object.entries(parsed.checks)
      .filter(([, c]) => c.status === 'FAIL')
      .map(([name]) => name);
    if (failedChecks.length > 0 && parsed.verdict === 'NO_BUGS_FOUND') {
      issues.push(`Checks failed (${failedChecks.join(', ')}) but verdict says NO_BUGS_FOUND`);
    }
  }
  
  return { isConsistent: issues.length === 0, issues };
}

// ============================================
// HELPER: Extract code blocks from LLM output
// ============================================
function extractCodeFromResponse(content: string): string {
  // Try to find code blocks (```python or ```js or just ```)
  const codeBlockRegex = /```(?:python|javascript|typescript|js|ts|py)?\s*\n([\s\S]*?)```/g;
  const matches: string[] = [];
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  
  if (matches.length > 0) {
    // Return the longest code block (likely the main implementation)
    return matches.reduce((a, b) => a.length > b.length ? a : b);
  }
  
  // No code blocks found - try to find code after "Step 4: Implement" or similar
  const implementSection = content.match(/(?:step\s*4|implement|solution)[\s\S]*?(?:def |function |class |const |let |var )([\s\S]*?)(?=(?:step\s*5|verify|---|\n\n\n|$))/i);
  if (implementSection) {
    return implementSection[0];
  }
  
  // Fallback: return everything (may include reasoning)
  return content;
}

// Extract bugs from structured review or fallback to text parsing
function extractBugsFromReview(reviewContent: string): Array<{ line?: number; issue: string; fix: string }> {
  const bugs: Array<{ line?: number; issue: string; fix: string }> = [];
  
  // First try structured JSON
  const parsed = parseReviewJSON(reviewContent);
  
  // Check objective_met - if false, that's a fundamental bug
  if (parsed?.objective_met?.match === false) {
    bugs.push({
      issue: `Code does not meet objective: Task asks for "${parsed.objective_met.task_asks_for}" but code returns "${parsed.objective_met.code_returns}"`,
      fix: 'Rewrite code to correctly implement the task objective'
    });
  }
  
  // Check trace test for failures
  if (parsed?.trace_test?.status === 'FAIL') {
    bugs.push({
      issue: `Trace test failed: Expected ${parsed.trace_test.expected_output} but got ${parsed.trace_test.actual_output}`,
      fix: 'Fix the logic error - actual execution does not match expected result'
    });
  }
  
  // Check ALL edge tests for failures (dynamic keys)
  if (parsed?.edge_tests) {
    for (const [testName, result] of Object.entries(parsed.edge_tests)) {
      if (result.status === 'FAIL') {
        bugs.push({
          issue: `Edge test "${testName}" failed: ${result.result}`,
          fix: `Add handling for ${testName} case`
        });
      }
    }
  }
  
  // Add explicit bugs from bugs_found array
  if (parsed?.bugs_found && parsed.bugs_found.length > 0) {
    bugs.push(...parsed.bugs_found);
  }
  
  // If we got structured data, return what we found
  if (parsed && (parsed.objective_met || parsed.trace_test || parsed.bugs_found)) {
    return bugs;
  }
  
  // Check verdict for "no bugs"
  if (parsed?.verdict === 'NO_BUGS_FOUND') {
    return [];
  }
  
  // Fallback to text parsing
  // Look for numbered bug listings
  const bugPatterns = [
    /(?:bug|error|issue|fix)\s*(?:#?\d+)?[:\s]+([^\n]+)/gi,
    /line\s*(\d+)[:\s]+([^\n]+)/gi,
    /- \[?(?:FAIL|BUG|ERROR)\]?[:\s]*([^\n]+)/gi
  ];
  
  for (const pattern of bugPatterns) {
    let match;
    while ((match = pattern.exec(reviewContent)) !== null) {
      const issue = match[1] || match[2] || '';
      if (issue.toLowerCase().includes('none') || issue.trim() === '-') continue;
      bugs.push({ issue: issue.trim(), fix: '' });
    }
  }
  
  return bugs;
}

// Check if review indicates no issues
function reviewFoundNoBugs(reviewContent: string): boolean {
  const parsed = parseReviewJSON(reviewContent);
  
  // If we have structured data, check for failures first
  if (parsed) {
    // Objective not met = bugs found
    if (parsed.objective_met?.match === false) return false;
    
    // Trace test failure = bugs found
    if (parsed.trace_test?.status === 'FAIL') return false;
    
    // Any edge test failure = bugs found
    if (parsed.edge_tests) {
      for (const [, result] of Object.entries(parsed.edge_tests)) {
        if (result.status === 'FAIL') return false;
      }
    }
    
    // Explicit verdict
    if (parsed.verdict === 'NO_BUGS_FOUND') return true;
    if (parsed.verdict === 'BUGS_FOUND') return false;
    
    // Check bugs_found array
    if (parsed.bugs_found && parsed.bugs_found.length === 0) return true;
    if (parsed.bugs_found && parsed.bugs_found.length > 0) return false;
  }
  
  const lower = reviewContent.toLowerCase();
  // Must have explicit "no bugs found" - not just absence of "fail"
  return (
    lower.includes('no_bugs_found') || 
    lower.includes('"verdict": "no bugs found"') ||
    (lower.includes('bugs_found": []') && !lower.includes('fail'))
  );
}

export function loadAgenticConfig(): PeerReviewConfig {
  try {
    const saved = localStorage.getItem(AGENTIC_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure showIntermediateSteps exists (migration for existing configs)
      if (typeof parsed.showIntermediateSteps === 'undefined') {
        parsed.showIntermediateSteps = true;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load agentic config:', e);
  }
  return { enabled: false, agents: defaultAgentConfigs, showIntermediateSteps: true };
}

export function saveAgenticConfig(config: PeerReviewConfig): void {
  try {
    localStorage.setItem(AGENTIC_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save agentic config:', e);
  }
}

// ============================================
// API COMMUNICATION
// ============================================

async function streamOllamaChat(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<{ content: string; timing: string; tokenSpeed: string }> {
  const startTime = Date.now();
  
  const response = await fetch(getApiUrl(endpoint, '/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      options: { temperature: 0.7, num_predict: 4096, num_ctx: 8192 }
    }),
    signal
  });

  if (!response.body) throw new Error('No response body');
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let tokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) {
          content += json.message.content;
          tokens++;
        }
      } catch { /* ignore parse errors */ }
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  return { 
    content, 
    timing: elapsed.toFixed(1), 
    tokenSpeed: (tokens / elapsed).toFixed(1) 
  };
}

async function streamGroqChatSimple(
  model: string,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<{ content: string; timing: string; tokenSpeed: string }> {
  const startTime = Date.now();
  
  const messages = convertToGroqMessages([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]);

  const modelInfo = getGroqModelInfo(model);
  const maxTokens = Math.min(4096, modelInfo?.contextWindow ? modelInfo.contextWindow / 4 : 4096);

  let content = '';
  let tokens = 0;

  const stream = streamGroqChat(messages, model, { temperature: 0.7, maxTokens, signal });

  for await (const chunk of stream) {
    if (chunk.type === 'error') throw new Error(chunk.error || 'Unknown Groq error');
    if (chunk.type === 'content' && chunk.content) {
      content += chunk.content;
      tokens++;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  return { 
    content, 
    timing: elapsed.toFixed(1), 
    tokenSpeed: (tokens / elapsed).toFixed(1) 
  };
}

async function callAgent(
  agent: AgentConfig,
  userMessage: string,
  apiProvider: ApiProvider,
  endpoint: string,
  signal?: AbortSignal
): Promise<{ content: string; timing: string; tokenSpeed: string }> {
  const systemPrompt = agent.systemPrompt || `You are ${agent.name}.`;
  
  if (apiProvider === 'groq') {
    return streamGroqChatSimple(agent.model, systemPrompt, userMessage, signal);
  } else {
    return streamOllamaChat(endpoint, agent.model, systemPrompt, userMessage, signal);
  }
}

// ============================================
// MAIN PEER REVIEW FLOW - HARDENED VERSION
// ============================================

export interface PeerReviewCallbacks {
  onPhaseStart?: (phase: 'initial' | 'review' | 'revision', agentResults: AgentResult[]) => void;
  onAgentComplete?: (result: AgentResult) => void;
  onPhaseComplete?: (phase: 'initial' | 'review' | 'revision', results: AgentResult[]) => void;
}

/**
 * ADVERSARIAL MULTI-AGENT REVIEW
 * 
 * Key changes from naive implementation:
 * 1. Expert must show hand-computed examples BEFORE coding
 * 2. Reviewer is ADVERSARIAL - told to find bugs, not confirm
 * 3. Reviewer uses DIFFERENT strategy (doesn't see expert's reasoning)
 * 4. Structured JSON output for reliable parsing
 * 5. Syntax validation for JS/TS (only thing we CAN verify)
 * 6. Clear UNVERIFIED warnings
 */
export async function runPeerReview(
  task: string,
  config: PeerReviewConfig,
  apiProvider: ApiProvider,
  endpoint: string,
  callbacks?: PeerReviewCallbacks,
  signal?: AbortSignal
): Promise<PeerReviewResponse> {
  const startTime = Date.now();
  const agents = config.agents;
  
  const response: PeerReviewResponse = {
    phases: { initial: [], review: [], revision: [] },
    totalTime: 0
  };

  // Validate first agent has model
  const expert = agents[0];
  if (!expert.model) throw new Error(`Agent ${expert.name} has no model configured`);

  // ============================================
  // INITIALIZE WORKFLOW STATE
  // This state is passed between all agents to ensure context consistency
  // Based on LangGraph SwarmState and AutoGen session memory patterns
  // ============================================
  
  const taskReqs = parseTaskRequirements(task);
  const workState: AgentWorkState = {
    task: taskReqs,
    expertAnalysis: null,
    reviewFindings: null,
    correctedCode: null,
    verificationPassed: false
  };

  // ============================================
  // PHASE 1: EXPERT IMPLEMENTATION
  // Expert receives: Task + Structured Requirements + Expected Behaviors
  // ============================================
  callbacks?.onPhaseStart?.('initial', []);
  
  // Build rich context for expert - include ALL relevant task info
  const expertPrompt = `# Task
${task}

# Structured Requirements (extracted from task)
- **Goal**: ${taskReqs.extractedGoal}
- **Input type**: ${taskReqs.expectedInputType}
- **Output type**: ${taskReqs.expectedOutputType}
- **Edge cases to handle**: ${taskReqs.edgeCases.join(', ') || 'none identified'}
${taskReqs.exampleInputs.length > 0 ? `- **Example inputs**: ${taskReqs.exampleInputs.join(', ')}` : ''}

# Your Process
## Step 1: VERIFY UNDERSTANDING
State in your own words: What input do I receive? What output must I return?

## Step 2: HAND-WORK EXAMPLES (MANDATORY)
Before writing ANY code, solve 3 examples by hand:

Example 1 (simple case):
- Input: [pick a concrete value]
- Step-by-step computation: [show EVERY step]
- Output: [the result]

Example 2 (different case):
[same format]

Example 3 (edge case from list above):
[same format]

## Step 3: WRITE CODE
Now write code that implements your hand-worked logic.

## Step 4: SELF-CHECK
Trace Example 1 through your code line by line.
Do you get the same output as Step 2?`;

  const expertResult = await callAgent(expert, expertPrompt, apiProvider, endpoint, signal);
  
  // Parse expert's work into structured state
  workState.expertAnalysis = parseExpertResponse(expertResult.content);
  
  // Attempt syntax validation for the detected language
  const codeOnly = workState.expertAnalysis?.code || extractCodeFromResponse(expertResult.content);
  const lang = detectLanguage(codeOnly);
  let syntaxNote = '';
  
  if (lang === 'javascript' || lang === 'typescript') {
    const syntaxCheck = validateJavaScriptSyntax(codeOnly);
    if (!syntaxCheck.valid) {
      syntaxNote = `\n\n⚠️ **Syntax Error Detected**: ${syntaxCheck.error}`;
    }
  } else if (lang === 'python') {
    // Use Pyodide for Python syntax validation (WebAssembly)
    try {
      const pythonCheck = await validatePythonSyntax(codeOnly);
      if (!pythonCheck.isValid) {
        const errMsg = pythonCheck.syntaxError 
          ? `Line ${pythonCheck.syntaxError.line}: ${pythonCheck.syntaxError.message}`
          : pythonCheck.runtimeError?.message || 'Unknown syntax error';
        syntaxNote = `\n\n⚠️ **Python Syntax Error Detected**: ${errMsg}`;
      }
    } catch (e) {
      // Pyodide not loaded yet, skip validation
      console.log('[Agentic] Pyodide not ready for Python validation, skipping');
    }
  }
  
  const initialResult: AgentResult = {
    agentId: expert.id,
    agentName: expert.name,
    role: expert.role,
    phase: 'initial_work',
    content: expertResult.content + syntaxNote,
    timing: expertResult.timing,
    tokenSpeed: expertResult.tokenSpeed
  };
  
  callbacks?.onAgentComplete?.(initialResult);
  response.phases.initial = [initialResult];
  callbacks?.onPhaseComplete?.('initial', [initialResult]);

  if (signal?.aborted) {
    response.totalTime = (Date.now() - startTime) / 1000;
    return response;
  }

  // ============================================
  // PHASE 2: ADVERSARIAL REVIEW
  // Reviewer receives: Original Task + Requirements + Content ONLY (not expert reasoning)
  // This prevents echo chamber effect while ensuring reviewer validates against original goal
  // Review type is determined by task type (code gets trace tests, instructions get accuracy checks)
  // ============================================
  const reviewer = agents[1];
  if (reviewer?.model) {
    callbacks?.onPhaseStart?.('review', response.phases.initial);
    
    // Determine what content to review based on task type
    // For code tasks: review extracted code only
    // For non-code tasks: review the full response content
    const contentToReview = taskReqs.reviewStrategy.checkSyntax ? codeOnly : expertResult.content;
    
    // Generate task-type-appropriate review prompt
    // This ensures database migration guides get accuracy/safety checks,
    // not trace tests on [3, 1, 2]
    const reviewPrompt = generateReviewPrompt(task, contentToReview, taskReqs);

    const reviewerResult = await callAgent(reviewer, reviewPrompt, apiProvider, endpoint, signal);
    
    // Parse reviewer's findings into structured state
    workState.reviewFindings = parseReviewerResponse(reviewerResult.content, taskReqs);
    
    // Validate review consistency
    const parsedReview = parseReviewJSON(reviewerResult.content);
    const consistency = validateReviewConsistency(parsedReview);
    
    // Also check objective match
    let reviewNote = '';
    const objectiveMatch = reviewerResult.content.match(/"objective_met"[\s\S]*?"match"\s*:\s*(true|false)/i);
    if (objectiveMatch && objectiveMatch[1] === 'false' && parsedReview?.verdict === 'NO_BUGS_FOUND') {
      consistency.isConsistent = false;
      consistency.issues.push('Objective NOT met but verdict says NO_BUGS_FOUND');
    }
    
    if (!consistency.isConsistent) {
      reviewNote = `\n\n⚠️ **Review Inconsistency**: ${consistency.issues.join('; ')}`;
    }
    
    const reviewResult: AgentResult = {
      agentId: reviewer.id,
      agentName: reviewer.name,
      role: 'reviewer',
      phase: 'peer_review',
      content: reviewerResult.content + reviewNote,
      timing: reviewerResult.timing,
      tokenSpeed: reviewerResult.tokenSpeed
    };
    
    callbacks?.onAgentComplete?.(reviewResult);
    response.phases.review = [reviewResult];
    callbacks?.onPhaseComplete?.('review', [reviewResult]);
  }

  if (signal?.aborted) {
    response.totalTime = (Date.now() - startTime) / 1000;
    return response;
  }

  // ============================================
  // PHASE 3: TARGETED BUG FIXES
  // Refiner receives: Original Task + Code + Specific Bug List
  // Must re-verify against original requirements after fix
  // ============================================
  const refiner = agents[2];
  const reviewContent = response.phases.review[0]?.content || '';
  
  // Use structured extraction
  const bugsFound = extractBugsFromReview(reviewContent);
  const noBugs = reviewFoundNoBugs(reviewContent);
  
  if (refiner?.model && bugsFound.length > 0 && !noBugs) {
    callbacks?.onPhaseStart?.('revision', response.phases.review);
    
    // Format bugs as explicit list
    const bugsList = bugsFound.map((b, i) => 
      `${i + 1}. ${b.line ? `Line ${b.line}: ` : ''}${b.issue}${b.fix ? ` → Fix: ${b.fix}` : ''}`
    ).join('\n');
    
    // Refiner gets full context: task, requirements, code, bugs
    const refinePrompt = `# Fix Bugs

## ORIGINAL TASK
${task}

## REQUIREMENTS (code must satisfy these)
- Goal: ${taskReqs.extractedGoal}
- Must handle: ${taskReqs.edgeCases.join(', ') || 'standard cases'}

## CURRENT CODE (with bugs):
\`\`\`
${codeOnly}
\`\`\`

## BUGS IDENTIFIED:
${bugsList}

## YOUR JOB
1. Apply ONLY the fixes listed above
2. Do NOT change anything else
3. Verify the fix actually addresses the bug
4. Return the corrected code

## SELF-CHECK (after fixing)
Trace input ${taskReqs.exampleInputs[0] || '[3, 1, 2]'} through corrected code.
Does it now produce the correct output?`;

    const refinerResult = await callAgent(refiner, refinePrompt, apiProvider, endpoint, signal);
    
    // Update work state
    workState.correctedCode = extractCodeFromResponse(refinerResult.content);
    
    // Validate corrected syntax for the detected language
    const correctedCode = workState.correctedCode;
    let correctionNote = '';
    
    if (lang === 'javascript' || lang === 'typescript') {
      const syntaxCheck = validateJavaScriptSyntax(correctedCode);
      if (!syntaxCheck.valid) {
        correctionNote = `\n\n❌ **Correction introduced syntax error**: ${syntaxCheck.error}`;
      }
    } else if (lang === 'python') {
      // Use Pyodide for Python syntax validation
      try {
        const pythonCheck = await validatePythonSyntax(correctedCode);
        if (!pythonCheck.isValid) {
          const errMsg = pythonCheck.syntaxError 
            ? `Line ${pythonCheck.syntaxError.line}: ${pythonCheck.syntaxError.message}`
            : pythonCheck.runtimeError?.message || 'Unknown syntax error';
          correctionNote = `\n\n❌ **Correction introduced Python syntax error**: ${errMsg}`;
        }
      } catch (e) {
        // Pyodide not ready
        console.log('[Agentic] Pyodide not ready for corrected code validation');
      }
    }
    
    const finalResult: AgentResult = {
      agentId: refiner.id,
      agentName: 'Corrected',
      role: 'synthesizer',
      phase: 'revision',
      content: refinerResult.content + correctionNote,
      timing: refinerResult.timing,
      tokenSpeed: refinerResult.tokenSpeed
    };
    
    callbacks?.onAgentComplete?.(finalResult);
    response.phases.revision = [finalResult];
    callbacks?.onPhaseComplete?.('revision', [finalResult]);
    response.finalSynthesis = refinerResult.content;
  } else {
    // No bugs found or no refiner configured
    response.finalSynthesis = initialResult.content;
  }

  response.totalTime = (Date.now() - startTime) / 1000;
  return response;
}

// ============================================
// FORMATTING HELPERS
// ============================================

export function formatPeerReviewAsMessage(response: PeerReviewResponse, showIntermediateSteps = true): string {
  const { phases, totalTime } = response;
  
  // If user only wants final result, show a condensed version
  if (!showIntermediateSteps) {
    return formatFinalResultOnly(response);
  }
  
  let output = '# Multi-Agent Review\n\n';
  output += `*${totalTime.toFixed(1)}s total*\n\n`;
  
  // Phase 1: Solution
  output += '## Solution\n\n';
  for (const result of phases.initial) {
    output += `**${result.agentName}** *(${result.timing}s)*\n\n`;
    output += result.content + '\n\n';
  }
  
  // Phase 2: Review (if any)
  if (phases.review.length > 0) {
    output += '---\n\n## Review\n\n';
    for (const result of phases.review) {
      output += `**${result.agentName}** *(${result.timing}s)*\n\n`;
      output += result.content + '\n\n';
    }
  }
  
  // Phase 3: Corrections (if any)
  if (phases.revision.length > 0) {
    output += '---\n\n## Corrected Code\n\n';
    for (const result of phases.revision) {
      output += `**${result.agentName}** *(${result.timing}s)*\n\n`;
      output += result.content + '\n\n';
    }
  }
  
  return output;
}

/**
 * Format only the final result from peer review (hides intermediate agent chats)
 * Used when showIntermediateSteps is false
 */
function formatFinalResultOnly(response: PeerReviewResponse): string {
  const { phases, totalTime } = response;
  
  let output = '';
  
  // If there are corrections, show only the corrected version
  if (phases.revision.length > 0) {
    const lastRevision = phases.revision[phases.revision.length - 1];
    output = lastRevision.content;
    output += `\n\n---\n*Multi-Agent Review completed in ${totalTime.toFixed(1)}s*`;
  }
  // If there's only review feedback but no corrections, show the initial solution
  else if (phases.review.length > 0) {
    const initialSolution = phases.initial[0];
    output = initialSolution.content;
    output += `\n\n---\n*Multi-Agent Review: No corrections needed (${totalTime.toFixed(1)}s)*`;
  }
  // If only initial phase, show that
  else if (phases.initial.length > 0) {
    const initialSolution = phases.initial[0];
    output = initialSolution.content;
    output += `\n\n---\n*Generated in ${totalTime.toFixed(1)}s*`;
  }
  
  return output;
}

export function getPeerReviewSummary(response: PeerReviewResponse): string {
  const hasReview = response.phases.review.length > 0;
  const hasRevision = response.phases.revision.length > 0;
  
  if (hasRevision) {
    return `Solution → Review → Corrected (${response.totalTime.toFixed(1)}s)`;
  } else if (hasReview) {
    return `Solution → Review (${response.totalTime.toFixed(1)}s)`;
  }
  return `Solution (${response.totalTime.toFixed(1)}s)`;
}
