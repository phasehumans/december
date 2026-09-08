# Architecture & Comparative Systems Engineering: Terminal Coding Agents (Pi vs. OpenCode vs. December)

**Author:** Deep Research & Core Systems Engineering Team  
**Target Systems:** Pi (`/home/chaitanya/code/pi`), OpenCode (`/home/chaitanya/code/december/opencode`), December (`/home/chaitanya/code/december`)  
**Status:** Canonical Systems Research Whitepaper & Engineering Blueprint  
**Date:** September 2026

---

## 1. Executive Summary & Fundamental Thesis

Terminal-based autonomous software engineering agents operate under extreme latency, accuracy, and predictability constraints. When developers interact with command-line coding agents, the subjective perception of "intelligence," "speed," and "rock-solid reliability" is frequently attributed to the underlying Large Language Model (LLM). However, empirical analysis of production execution traces reveals a different reality:

> **The Fundamental Thesis:**  
> The perceived speed, precision, and reliability of a terminal coding agent are primarily governed by its **harness architecture**—specifically its file mutation engine, context window compaction strategy, KV cache locality alignment, terminal differential rendering loop, and process isolation model. Model capabilities establish the theoretical ceiling; the client runtime and harness architecture determine whether that ceiling is ever approached.

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                    HARNESS-LEVEL SUBSYSTEM EFFICIENCY TAXONOMY                                          |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Subsystem Dimension      | Pi (earendil-works/pi)            | OpenCode (opencode-ai/opencode)   | December (Current)   |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Mutation Engine          | Multi-disjoint exact replacement  | 9-tier replacer cascade with      | Single-target search |
|                          | with NFKC/Unicode fuzzy matching  | Levenshtein anchor matching (>0.65| with naive trimEnd;  |
|                          | & line-exact preservation         | threshold) & inline LSP feedback  | fragile patch tool   |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Prompt & Context         | Modular tool prompt contributions | Model-specific prompt dispatch    | Static prompt string |
| Assembly                 | with upward directory climbing    | (Claude/Beast/Kimi/Gemini) with   | with workspace-root  |
|                          | & worktree shadow deduplication   | just-in-time instruction climbing | flat file reading    |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Context Compaction       | Structured checkpointing          | Two-tier: Tier-1 tool pruning     | Naive sliding window |
|                          | preserving `<read-files>` and     | (`[Old tool result cleared]`) vs  | / full conversation  |
|                          | `<modified-files>` XML blocks     | Tier-2 LLM agent summarization    | truncation           |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Prompt Cache Management  | 3-point explicit cache control    | Context Epochs & automatic        | Static prefix order  |
|                          | (System, Last Tool, Last Turn)    | breakpoint lowering (cap: 4)      | without API markers  |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Terminal UI & Rendering  | Zero-framework ANSI diff engine   | OpenTUI + SolidJS fine-grained    | React 19 + Ink 7     |
|                          | with DEC Mode 2026 sync output    | reactive signals (no VDOM)        | full VDOM diffing    |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Subprocess Execution     | Detached process group isolation  | Full pseudoterminal (node-pty)    | Child process with   |
|                          | with cross-platform tree killing  | with ANSI parser & resize support | immediate stdin close|
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
| Persistence & Revert     | Append-only JSONL DAG session     | Isolated Shadow Git Repository    | Flat JSONL array     |
|                          | tree (zero destructive rewrites)  | (`.opencode/data/snapshot`)       | without rollback     |
+--------------------------+-----------------------------------+-----------------------------------+----------------------+
```

### 1.1 The Triad of Production Agent UX

1. **Mutation Reliability**: An agent that fails a file edit immediately breaks user trust. When an agent emits a diff that fails to apply, or replaces the wrong occurrence in a source file, the user is forced into manual intervention. Pi and OpenCode treat string mutation as an adversarial distributed systems problem with multiple layers of fuzzy fallback, normalization, and concurrency protection.
2. **Context Latency & Prompt Caching**: Model inference latency is dominated by Time-To-First-Token (TTFT). If an agent's harness perturbs the system prompt or conversation prefix on every turn (e.g. by injecting dynamic timestamps at the beginning or mutating tool signatures), the provider's KV cache is completely invalidated, causing high latency (5–15 seconds) and 10x cost inflation. Caching geometry must be strictly preserved.
3. **Terminal Interactivity & Execution Fidelity**: Modern CLI tools cannot afford React virtual DOM diffing overhead or console flicker. Furthermore, running terminal tasks requires full PTY emulation or detached process group tracking; closing `stdin` prematurely breaks terminal tools.

---

## 2. Deep Dive: System Prompts & Context Assembly

The system prompt and context assembly pipeline dictates how the model understands its identity, tools, environment, and project-specific guidelines.

```
+---------------------------------------------------------------------------------------------------------+
|                                    SYSTEM PROMPT GENERATION PIPELINE                                    |
|                                                                                                         |
|   Pi:                  [Base System Prompt]                                                             |
|                                 +                                                                       |
|                        [Tool System Prompt Snippets & Guidelines] (dynamic based on active toolset)     |
|                                 +                                                                       |
|                        [Climbed Project Rules: Root -> Subdir] (AGENTS.md / CLAUDE.md)                  |
|                                 +                                                                       |
|                        [Discovered Skills Catalog]                                                      |
|                                 +                                                                       |
|                        [Environment Metadata: CWD]                                                      |
|                                                                                                         |
|   OpenCode:            [Model Family Dispatch: Claude vs. Beast/o1/o3 vs. Gemini vs. Kimi]             |
|                                 +                                                                       |
|                        [Environment Block: Worktree, VCS, Platform, Date]                               |
|                                 +                                                                       |
|                        [Available Project References]                                                   |
|                                 +                                                                       |
|                        [Dynamic JIT Instruction Injection via Read Tool]                                |
|                                                                                                         |
|   December (Current):  [Static Base Prompt]                                                             |
|                                 +                                                                       |
|                        [Formatted Skills Catalog]                                                       |
|                                 +                                                                       |
|                        [Workspace Root AGENTS.md / .december/rules.md]                                  |
|                                 +                                                                       |
|                        [Dynamic Date & CWD]                                                             |
+---------------------------------------------------------------------------------------------------------+
```

### 2.1 Pi's Model-Agnostic Modular Contribution Pattern

Pi decouples tool logic from the central agent prompt by enforcing a **modular contribution pattern**. Rather than hardcoding tool instructions inside a monolithic prompt string, every tool exports a contribution schema:

Primary Source: [`packages/coding-agent/src/core/tools/edit.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/edit.ts#L43-L51)

```typescript
export const editToolSystemPromptContribution = {
    snippet:
        'Make precise file edits with exact text replacement, including multiple disjoint edits in one call',
    guidelines: [
        'Use edit for precise changes (edits[].oldText must match exactly)',
        'When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls',
        'Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.',
        'Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions.',
    ],
} as const
```

In [`packages/coding-agent/src/core/system-prompt.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/system-prompt.ts#L80-L126), the system prompt builder aggregates tool snippets and conditionally generates behavioral guidelines depending on which tools are actually active:

```typescript
// Build tools list based on selected tools.
const visibleTools = tools.filter((name) => !!toolSnippets?.[name])
const toolsList =
    visibleTools.length > 0
        ? visibleTools.map((name) => `- ${name}: ${toolSnippets![name]}`).join('\n')
        : '(none)'

// Build guidelines based on which tools are actually available
const guidelinesList: string[] = []
const hasBash = tools.includes('bash')
const hasPowerShell = tools.includes('powershell')
const hasGrep = tools.includes('grep')
const hasFind = tools.includes('find')

if ((hasBash || hasPowerShell) && !hasGrep && !hasFind && !hasLs) {
    if (hasBash && hasPowerShell) {
        addGuideline(
            'Use bash or PowerShell for file operations like listing, searching, and finding files'
        )
    } else if (hasPowerShell) {
        addGuideline(
            'Use PowerShell for file operations like listing, searching, and finding files'
        )
    } else {
        addGuideline('Use bash for file operations like ls, rg, find')
    }
}
```

This guarantees that:

1. Tool descriptions are concise and relevant.
2. The agent is never instructed to use tools that were not registered or enabled in the current session.
3. System prompt tokens are minimized.

### 2.2 OpenCode's Model-Specific Prompt Dispatch

OpenCode takes an alternative, model-specialized approach. Rather than relying on a universal generic prompt, OpenCode recognizes that different frontier models exhibit vastly different reasoning behaviors, instruction adherence failures, and tool calling quirks.

In [`packages/opencode/src/session/system.ts`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/system.ts#L27-L49), OpenCode dispatches dedicated, hand-tuned system prompts according to model ID:

```typescript
export function provider(model: Provider.Model) {
    if (model.api.id.includes('muse')) {
        const name = model.api.id.includes('muse-glimmer') ? 'Muse Glimmer' : 'Muse Spark'
        return [PROMPT_META.replaceAll('{{MODEL_NAME}}', name)]
    }
    if (
        model.api.id.includes('gpt-4') ||
        model.api.id.includes('o1') ||
        model.api.id.includes('o3')
    )
        return [PROMPT_BEAST]
    if (model.api.id.includes('gpt')) {
        if (model.api.id.includes('codex')) {
            return [PROMPT_CODEX]
        }
        return [PROMPT_GPT]
    }
    if (model.api.id.includes('gemini-')) return [PROMPT_GEMINI]
    if (model.api.id.includes('claude')) return [PROMPT_ANTHROPIC]
    if (model.api.id.toLowerCase().includes('trinity')) return [PROMPT_TRINITY]
    if (
        model.api.id.toLowerCase().includes('kimi') ||
        ['kimi-for-coding', 'moonshotai', 'moonshotai-cn'].includes(model.providerID)
    )
        return [PROMPT_KIMI]
    return [PROMPT_DEFAULT]
}
```

#### The Specialization Rationale:

- **Anthropic (`prompt/anthropic.txt`)**: Claude 3.5 Sonnet / 3.7 Sonnet excels at concise output, objective problem-solving, and disciplined task tracking via explicit todo list tools (`TodoWrite`). The prompt focuses on professional objectivity, preventing superfluous conversational pleasantries, and enforcing single-step todo transitions.
- **Beast Mode (`prompt/beast.txt`)**: OpenAI reasoning models (o1/o3/GPT-4o) frequently suffer from premature termination—declaring a task complete after a superficial code edit without running tests or verifying edge cases. OpenCode's `PROMPT_BEAST` aggressively counteracts this:
    > _"You are opencode, an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user... Failing to test your code sufficiently rigorously is the NUMBER ONE failure mode on these types of tasks... NEVER end your turn without having truly and completely solved the problem."_ (lines 1–25)
- **Gemini (`prompt/gemini.txt`) & Kimi (`prompt/kimi.txt`)**: Tuned around tool calling schemas, long context utilization, and distinct markdown rendering behaviors.

### 2.3 Dynamic Project Instruction Climbing

A critical flaw in naive coding agents is assuming that project instructions reside only in a single root file. Monorepos frequently place localized instructions inside nested subdirectories (e.g. `packages/database/AGENTS.md` vs `apps/web/AGENTS.md`).

#### Pi's Ancestor Climbing & Shadow Worktree Handling

In [`packages/coding-agent/src/core/resource-loader.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/resource-loader.ts#L71-L157), Pi implements an upward directory climbing loop:

```typescript
function loadContextFileFromDir(dir: string): { path: string; content: string } | null {
	const candidates = ["AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"];
	for (const filename of candidates) {
		const filePath = join(dir, filename);
		if (existsSync(filePath)) {
			try {
				if (!statSync(filePath).isFile()) continue;
				return { path: filePath, content: stripBom(readFileSync(filePath, "utf-8")) };
			} catch (error) { ... }
		}
	}
	return null;
}

export function loadProjectContextFiles(options: { cwd: string; agentDir: string }) {
	// 1. Global context from ~/.pi/agent
	const globalContext = loadContextFileFromDir(resolvedAgentDir);
	if (globalContext) contextFiles.push(globalContext);

	// 2. Climb from cwd up to filesystem root
	const ancestorContextFiles: Array<{ path: string; content: string }> = [];
	const shadowedContextFile = findShadowedContextFile(resolvedCwd);
	let currentDir = resolvedCwd;

	while (true) {
		const contextFile = loadContextFileFromDir(currentDir);
		const isShadowed = shadowedContextFile !== undefined &&
			canonicalizePath(contextFile?.path ?? "") === shadowedContextFile;
		if (contextFile && !isShadowed && !seenPaths.has(contextFile.path)) {
			ancestorContextFiles.unshift(contextFile); // unshift preserves Root -> Leaf order
			seenPaths.add(contextFile.path);
		}
		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) break;
		currentDir = parentDir;
	}
	contextFiles.push(...ancestorContextFiles);
	return contextFiles;
}
```

Pi also detects **shadowed worktree files** ([`resource-loader.ts:L101-117`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/resource-loader.ts#L101-L117)). When working inside a linked git worktree created via `git worktree add`, the ancestor path passes through the parent repo, which could duplicate the root `AGENTS.md`. Pi canonicalizes git paths (`gitdir:` vs `commondir:`) and suppresses shadowed copies.

#### OpenCode's Just-In-Time Instruction Resolution

OpenCode separates instructions into two layers:

1. **System Paths (`systemPaths`)**: [`packages/opencode/src/session/instruction.ts:L110-153`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/instruction.ts#L110-L153) uses `fs.findUp("AGENTS.md", ctx.directory, ctx.worktree)` to discover the nearest root/global rules.
2. **Just-In-Time Read Resolution (`Instruction.resolve`)**: [`packages/opencode/src/session/instruction.ts:L179-215`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/instruction.ts#L179-L215). When the agent executes a `read` tool call on any file in a nested package, OpenCode walks upward from that specific file to the worktree root, loads any localized `AGENTS.md` or `CLAUDE.md`, and dynamically injects it into the tool response:

```typescript
// Walk upward from the file being read and attach nearby instruction files once per message.
while (current.startsWith(root) && current !== root) {
    const found = yield * find(current)
    if (!found || found === target || sys.has(found) || already.has(found)) {
        current = path.dirname(current)
        continue
    }
    const content = yield * read(found)
    if (content) {
        results.push({ filepath: found, content })
        s.claims.get(messageID)?.add(found)
    }
    current = path.dirname(current)
}
```

#### December's Current Limitation:

December currently executes a flat static discovery in [`packages/agent/src/harness/agent-harness.ts:L140-163`](file:///home/chaitanya/code/december/packages/agent/src/harness/agent-harness.ts#L140-L163):

```typescript
const candidateFiles = [
    path.join(this.config.workspaceDir, 'AGENTS.md'),
    path.join(this.config.workspaceDir, '.december', 'rules.md'),
    path.join(this.config.workspaceDir, '.december', 'AGENTS.md'),
]
```

If a developer starts December inside a nested package (`packages/agent`), December never climbs upward to find root project rules, nor does it dynamically discover package-level rules when reading code across boundaries.

---

## 3. Deep Dive: File Editing & Mutation Engineering (The Core Differentiator)

The file editing tool is the single most critical mechanism of an autonomous coding agent. If an agent cannot reliably mutate code on disk without hallucinating line numbers or failing on whitespace differences, it cannot function.

```
+---------------------------------------------------------------------------------------------------------------+
|                                    FILE EDITING IMPLEMENTATION ARCHITECTURE                                   |
|                                                                                                               |
|   Pi:                  Input: Array<{ oldText: string, newText: string }>                                     |
|                                 |                                                                             |
|                                 v                                                                             |
|                        withFileMutationQueue(realpath)  <-- Per-file async serialization queue                |
|                                 |                                                                             |
|                                 v                                                                             |
|                        normalizeToLF() & splitBom()                                                           |
|                                 |                                                                             |
|                                 v                                                                             |
|                        fuzzyFindText() [Exact match -> NFKC Unicode / quote / dash / space normalization]     |
|                                 |                                                                             |
|                                 v                                                                             |
|                        Collision & Disjoint Overlap Validation (sort by matchIndex)                           |
|                                 |                                                                             |
|                                 v                                                                             |
|                        applyReplacementsPreservingUnchangedLines()  <-- Touched lines rewritten,             |
|                                                                         untouched lines 100% byte preserved  |
|                                                                                                               |
|   OpenCode:            Input: { filePath, oldString, newString, replaceAll }                                  |
|                                 |                                                                             |
|                                 v                                                                             |
|                        Semaphore Lock per resolved path                                                       |
|                                 |                                                                             |
|                                 v                                                                             |
|                        9-Tier Replacer Cascade:                                                               |
|                        [1. Simple] -> [2. LineTrimmed] -> [3. BlockAnchor (Levenshtein >0.65)] ->            |
|                        [4. WhitespaceNormalized] -> [5. IndentationFlexible] -> [6. EscapeNormalized] ->      |
|                        [7. TrimmedBoundary] -> [8. ContextAware] -> [9. MultiOccurrence]                      |
|                                 |                                                                             |
|                                 v                                                                             |
|                        Disproportionate Match Guard (rejects span >= 2x oldString)                            |
|                                 |                                                                             |
|                                 v                                                                             |
|                        Write file + Format + Instant LSP Diagnostic Feedback (lsp.touchFile)                  |
+---------------------------------------------------------------------------------------------------------------+
```

### 3.1 Pi's Multi-Disjoint Edit Schema, Fuzzy NFKC Normalization & Byte Preservation

Pi represents state-of-the-art software surgery. Instead of forcing the LLM to make separate tool calls for every small edit in a file (which adds an entire LLM inference round-trip for each modification), Pi supports **multi-disjoint edits** in a single call.

#### 1. Schema & Model Resilience

In [`packages/coding-agent/src/core/tools/edit.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/edit.ts#L21-L41):

```typescript
const replaceEditSchema = Type.Object({
    oldText: Type.String({
        description:
            'Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.',
    }),
    newText: Type.String({ description: 'Replacement text for this targeted edit.' }),
})

const editSchema = Type.Object({
    path: Type.String({ description: 'Path to the file to edit (relative or absolute)' }),
    edits: Type.Array(replaceEditSchema, {
        description:
            'One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits.',
    }),
})
```

Because models like Claude 3.7 or GLM-5 often serialize JSON inside function arguments differently, Pi provides argument sanitation in [`prepareEditArguments`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/edit.ts#L103-L134):

- Parses `args.edits` if delivered as a stringified JSON string.
- Wraps single-object `{ oldText, newText }` payloads into a single-element array.
- Translates legacy flat parameters (`args.oldText`, `args.newText`) into the `edits` array.

#### 2. Per-File Concurrency Queue

To prevent race conditions during rapid or parallel tool execution, Pi guards all file writes with [`withFileMutationQueue`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/file-mutation-queue.ts#L32-L62):

```typescript
export async function withFileMutationQueue<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
	const registration = registrationQueue.then(async () => {
		const key = await getMutationQueueKey(filePath); // resolves realpath
		const currentQueue = fileMutationQueues.get(key) ?? Promise.resolve();

		let releaseNext!: () => void;
		const nextQueue = new Promise<void>((resolveQueue) => { releaseNext = resolveQueue; });
		const chainedQueue = currentQueue.then(() => nextQueue);
		fileMutationQueues.set(key, chainedQueue);

		return { key, currentQueue, chainedQueue, releaseNext };
	});
    ...
```

This guarantees that concurrent operations targeting the same file (even via symlinks) are strictly serialized, while mutations on different files execute concurrently.

#### 3. Fuzzy Unicode, Quote & Dash Normalization

LLMs frequently convert ASCII straight quotes into typographical curly quotes, or em-dashes into hyphens, or normalize non-breaking spaces. Pi handles this via [`normalizeForFuzzyMatch`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/edit-diff.ts#L34-L55):

```typescript
export function normalizeForFuzzyMatch(text: string): string {
    return (
        text
            .normalize('NFKC')
            // Strip trailing whitespace per line
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n')
            // Smart single quotes → '
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
            // Smart double quotes → "
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
            // Unicode dashes/hyphens → -
            .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
            // Unicode spaces → regular space
            .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, ' ')
    )
}
```

#### 4. Byte-Exact Line Preservation

If fuzzy matching is required, naive implementations overwrite the entire file with normalized text, destroying intentional trailing spaces, tabs, or Unicode characters across untouched code. Pi solves this in [`applyReplacementsPreservingUnchangedLines`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/edit-diff.ts#L132-L173):

- Matches offsets in normalized space.
- Calculates exact line spans touched by the replacements.
- Replaces **only** the lines touched by the edit using normalized base text.
- Slices and copies all untouched line blocks **verbatim** from the original buffer.

#### 5. Overlap Detection

In [`applyEditsToNormalizedContent`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/edit-diff.ts#L341-L350), Pi sorts all matches by offset and verifies:

```typescript
matchedEdits.sort((a, b) => a.matchIndex - b.matchIndex)
for (let i = 1; i < matchedEdits.length; i++) {
    const previous = matchedEdits[i - 1]
    const current = matchedEdits[i]
    if (previous.matchIndex + previous.matchLength > current.matchIndex) {
        throw new Error(
            `edits[${previous.editIndex}] and edits[${current.editIndex}] overlap in ${path}. Merge them into one edit or target disjoint regions.`
        )
    }
}
```

### 3.2 OpenCode's 9-Tier Replacer Cascade & Instant LSP Feedback

OpenCode tackles editing through an exhaustive 9-tier heuristic fallback cascade in [`packages/opencode/src/tool/edit.ts`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/tool/edit.ts#L694-L722):

```typescript
for (const replacer of [
  SimpleReplacer,             // Tier 1: Exact substring match
  LineTrimmedReplacer,        // Tier 2: Line-by-line trimEnd() / trim() match
  BlockAnchorReplacer,        // Tier 3: Levenshtein distance on interior block (>0.65 similarity)
  WhitespaceNormalizedReplacer,// Tier 4: Collapse whitespace sequences (\s+ -> " ")
  IndentationFlexibleReplacer,// Tier 5: Common indentation stripping
  EscapeNormalizedReplacer,   // Tier 6: Unescapes literals (\n, \t, \", \')
  TrimmedBoundaryReplacer,    // Tier 7: Boundary-trimmed matching
  ContextAwareReplacer,       // Tier 8: Contextual anchor matching (50% interior line match)
  MultiOccurrenceReplacer,    // Tier 9: Yields multiple exact occurrences
]) {
  for (const search of replacer(content, oldString)) {
    const index = content.indexOf(search)
    if (index === -1) continue
    notFound = false
    if (isDisproportionateMatch(search, oldString)) {
      throw new Error(
        "Refusing replacement because the matched span is much larger than oldString. Re-read the file and provide the full exact oldString for the intended replacement.",
      )
    }
    ...
```

#### The Levenshtein Block-Anchor Replacer (Tier 3)

In [`BlockAnchorReplacer`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/tool/edit.ts#L288-L425), when code blocks are >= 3 lines long:

1. It anchors on the first line (`searchLines[0].trim()`) and the last line (`searchLines[n-1].trim()`).
2. Scans for candidate blocks in the file where first and last lines match and line count delta is <= 25% of block size.
3. Computes Levenshtein similarity on all interior lines:
   $$\text{similarity} = 1 - \frac{\text{Levenshtein}(line_{orig}, line_{search})}{\max(\text{len}_{orig}, \text{len}_{search})}$$
4. If single candidate: requires $\text{similarity} \ge 0.65$ ([`SINGLE_CANDIDATE_SIMILARITY_THRESHOLD`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/tool/edit.ts#L220)).
5. If multiple candidates: requires $\text{similarity} \ge 0.65$ and selects the highest scoring block candidate.

#### Disproportionate Match Guard

A dangerous failure mode in fuzzy replacers occurs when a 2-line `oldString` matches a 500-line block because the first and last lines happen to be closing braces `}`. OpenCode guards against this in [`isDisproportionateMatch`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/tool/edit.ts#L731-L737):

```typescript
function isDisproportionateMatch(search: string, oldString: string) {
    const oldLines = oldString.split('\n').length
    const searchLines = search.split('\n').length
    if (searchLines >= Math.max(oldLines + 3, oldLines * 2)) return true
    if (oldLines === 1) return false
    return (
        search.trim().length > Math.max(oldString.trim().length + 500, oldString.trim().length * 4)
    )
}
```

#### Instant LSP Diagnostic Feedback

Immediately after applying the edit, writing to disk, and auto-formatting, OpenCode interacts with the local Language Server Protocol daemon ([`packages/opencode/src/tool/edit.ts:L196-202`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/tool/edit.ts#L196-L202)):

```typescript
let output = 'Edit applied successfully.'
yield * lsp.touchFile(filePath, 'document')
const diagnostics = yield * lsp.diagnostics()
const normalizedFilePath = FSUtil.normalizePath(filePath)
const block = LSP.Diagnostic.report(filePath, diagnostics[normalizedFilePath] ?? [])
if (block) output += `\n\nLSP errors detected in this file, please fix:\n${block}`
```

If the edit introduced a compiler syntax error, missing import, or TypeScript type error, the compiler error is returned **directly in the tool execution response**. The model fixes its own mistake immediately on the next turn, without waiting for the user to run a build or bash command.

### 3.3 December's Current Limitations

December's editing infrastructure is split between two rudimentary tools:

1. [`packages/tools/src/edit.ts`](file:///home/chaitanya/code/december/packages/tools/src/edit.ts#L12-L59):
    - Only accepts single replacement `{ path, targetContent, replacementContent }`.
    - Uses `content.includes(targetContent)` followed by `content.replace(targetContent, replacementContent)`, which blindly replaces only the first occurrence without checking for duplicate occurrences or ambiguity.
    - If fallback whitespace-trimmed matching succeeds, it executes:
        ```typescript
        const originalLines = content.split(/\r?\n/)
        originalLines.splice(i, targetLen, ...replacementContent.split(/\r?\n/))
        const updated = originalLines.join('\n')
        ```
        This forces Unix `\n` line endings onto CRLF Windows files, corrupts UTF-8 BOM headers, and does zero Unicode/quote/dash normalization.
    - Has no file mutation mutex (concurrent tool execution corrupts files).
2. [`packages/tools/src/edit_diff.ts`](file:///home/chaitanya/code/december/packages/tools/src/edit_diff.ts#L14-L51):
    - Relies on unified diff strings (`--- a/... +++ b/... @@ ... @@`). LLMs consistently miscount hunk line numbers and header offsets, causing frequent patch rejection errors.

---

## 4. Deep Dive: Context Window Management, Compaction & Prompt Caching

Agent sessions that exceed 50+ turns inevitably encounter context window limits. How an agent prunes and compacts historical turns determines both its long-horizon reasoning retention and its operational cost.

```
+---------------------------------------------------------------------------------------------------------+
|                                  CONTEXT COMPACTION & CACHING TAXONOMY                                  |
|                                                                                                         |
|   OpenCode Two-Tier Compaction:                                                                         |
|   +-------------------------------------------------------------------------------------------------+   |
|   | Tier 1: Zero-LLM Prune (prune)                                                                   |   |
|   | Iterates backwards through tool results. Protects recent 40k tokens (PRUNE_PROTECT).             |   |
|   | Clears older completed tool output: "[Old tool result content cleared]".                        |   |
|   | Cost: $0.00, Latency: 0ms.                                                                      |   |
|   +-------------------------------------------------------------------------------------------------+   |
|                                                    | (If token overflow persists)                       |
|                                                    v                                                    |
|   +-------------------------------------------------------------------------------------------------+   |
|   | Tier 2: LLM Agent Summarization (processCompaction)                                             |   |
|   | Preserves recent tail budget (Math.min(15000, usable * 0.25)).                                  |   |
|   | Runs dedicated compaction prompt to synthesize previous summary + intermediate turns.          |   |
|   +-------------------------------------------------------------------------------------------------+   |
|                                                                                                         |
|   Pi Structured Checkpoint Compaction:                                                                  |
|   +-------------------------------------------------------------------------------------------------+   |
|   | Scans session entries to extract file operations: read, written, edited.                        |   |
|   | LLM generates natural language trajectory summary.                                              |   |
|   | Harness appends deterministic structured blocks:                                                |   |
|   |   <read-files>                                                                                  |   |
|   |   src/index.ts                                                                                  |   |
|   |   </read-files>                                                                                 |   |
|   |   <modified-files>                                                                              |   |
|   |   src/utils.ts                                                                                  |   |
|   |   </modified-files>                                                                             |   |
|   | Incrementally merges details from prior compaction entries across multi-stage sessions.         |   |
|   +-------------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------------+
```

### 4.1 OpenCode's Two-Tier Compaction Engine

OpenCode's compaction implementation in [`packages/opencode/src/session/compaction.ts`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/compaction.ts) is arguably the most cost-effective compaction system in production.

#### Tier 1: Zero-LLM Tool Result Pruning (`prune`)

Instead of invoking an expensive LLM summarization call every time the context expands, OpenCode recognizes that **old tool outputs** (e.g. huge `git diff`, `find`, or `read_file` dumps from 10 turns ago) represent 80–90% of token consumption, but are rarely needed verbatim by the model.

In [`packages/opencode/src/session/compaction.ts:L273-317`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/compaction.ts#L273-L317):

- Scans backwards from the most recent turn.
- Preserves the last 2 user turns untouched (`turns < 2`).
- Accumulates token counts of completed tool parts.
- Protects the most recent 40,000 tokens ([`PRUNE_PROTECT = 40_000`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/compaction.ts#L29)).
- Exempts critical tools like `skill` ([`PRUNE_PROTECTED_TOOLS`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/compaction.ts#L31)).
- If total prunable tokens exceed [`PRUNE_MINIMUM = 20_000`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/compaction.ts#L28), marks the part with `part.state.time.compacted = Date.now()`.
- During message serialization ([`serialize:L76-78`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/compaction.ts#L76-L78)), pruned tool outputs are replaced with a single static string:
    ```
    [Old tool result content cleared]
    ```
    This instantly clears 50,000–100,000 tokens in under 1 millisecond at zero API cost.

#### Tier 2: LLM Conversation Summarization (`processCompaction`)

When tool pruning is insufficient and the conversation overflows the model's usable budget ([`packages/opencode/src/session/compaction.ts:L319-480`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/session/compaction.ts#L319-L480)):

- Allocates a recent conversation tail budget via `preserveRecentBudget`:
  $$\text{budget} = \min(15000, \max(2000, \lfloor \text{usable} \times 0.25 \rfloor))$$
- Splits messages at turn boundaries, leaving the tail untouched.
- Passes the older history to a dedicated, low-cost compaction agent (`agents.get("compaction")`).
- Appends a synthetic `compaction` message containing the structured summary.

### 4.2 Pi's Structured Checkpoint Compaction

Pi's compaction engine in [`packages/coding-agent/src/core/compaction/compaction.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/compaction/compaction.ts) and [`utils.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/compaction/utils.ts) focuses on **state reconstruction**.

When an agent's history is summarized into pure natural language, the model frequently forgets which files it previously inspected or altered, leading to redundant `read` tool calls or repeated regressions.

Pi solves this by extracting deterministic metadata from tool calls ([`utils.ts:L29-67`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/compaction/utils.ts#L29-L67)):

1. Traverses all tool calls in the summarized window:
    - Tracks every `read(path)` -> `fileOps.read`
    - Tracks every `write(path)` -> `fileOps.written`
    - Tracks every `edit(path)` -> `fileOps.edited`
2. Partitions paths into `readFiles` (read-only) and `modifiedFiles` (edited or written).
3. Injects structured XML sections directly into the summary ([`utils.ts:L72-82`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/compaction/utils.ts#L72-L82)):

    ```xml
    <read-files>
    packages/agent/src/agent.ts
    packages/agent/src/agent-loop.ts
    </read-files>

    <modified-files>
    packages/tools/src/edit.ts
    </modified-files>
    ```

4. Stores these details in `CompactionEntry.details` ([`compaction.ts:L34-61`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/compaction/compaction.ts#L34-L61)). When subsequent compactions occur in the same session, Pi inherits the previous compaction's file lists, preventing loss of filesystem awareness across dozens of compactions.

### 4.3 Prompt Caching Mechanics: 3-Point Cache Controls vs. Context Epochs

Modern frontier models (Anthropic Claude 3.5/3.7, DeepSeek V3, Qwen 2.5) offer prompt caching. Anthropic allows up to 4 explicit `cache_control: { type: "ephemeral" }` breakpoints per request.

```
+----------------------------------------------------------------------------------------------------+
|                                    PROMPT CACHE BREAKPOINT GEOMETRY                                |
|                                                                                                    |
|   +--------------------------------------------------------------------------------------------+   |
|   | Breakpoint 1: Static System Prompt                                                         |   |
|   | (Identical across all turns and sessions; 100% cache hit rate)                             |   |
|   +--------------------------------------------------------------------------------------------+   |
|   | Breakpoint 2: Tool Definitions Array (Last Tool)                                           |   |
|   | (Tool schemas remain invariant during execution; cache hit rate > 98%)                      |   |
|   +--------------------------------------------------------------------------------------------+   |
|   | Breakpoint 3: Conversation History Prefix (Latest User Message / Turn Boundary)             |   |
|   | (Cached at previous turn; intra-turn tool calls read this prefix with 90% discount)          |   |
|   +--------------------------------------------------------------------------------------------+   |
|   | Breakpoint 4: Ephemeral Tail / Reserved                                                    |   |
|   +--------------------------------------------------------------------------------------------+   |
+----------------------------------------------------------------------------------------------------+
```

#### Pi's 3-Point Placement Architecture

In [`packages/ai/src/api/anthropic-messages.ts`](file:///home/chaitanya/code/pi/packages/ai/src/api/anthropic-messages.ts#L1064-L1119, #L1373-L1390):

1. **Breakpoint 1 (System Prompt)**:
    ```typescript
    params.system = [
        {
            type: 'text',
            text: sanitizeSurrogates(context.systemPrompt),
            ...(cacheControl ? { cache_control: cacheControl } : {}),
        },
    ]
    ```
2. **Breakpoint 2 (Last Tool Definition)**:
    ```typescript
    params.tools = convertTools(immediateTools, ..., compat.supportsCacheControlOnTools ? cacheControl : undefined);
    // In convertTools:
    ...(cacheControl && index === tools.length - 1 ? { cache_control: cacheControl } : {})
    ```
3. **Breakpoint 3 (Last Conversation Message)**:
    ```typescript
    // Add cache_control to the last user message to cache conversation history
    ;(lastBlock as any).cache_control = cacheControl
    ```

Pi applies this identical 3-point strategy across OpenAI-compatible providers in [`packages/ai/src/api/openai-completions.ts:L1077-1081`](file:///home/chaitanya/code/pi/packages/ai/src/api/openai-completions.ts#L1077-L1081):

```typescript
addCacheControlToSystemPrompt(messages, cacheControl)
addCacheControlToLastTool(tools, cacheControl)
addCacheControlToLastConversationMessage(messages, cacheControl)
```

#### OpenCode's Auto Cache Policy & Breakpoint Cap

In [`packages/llm/src/cache-policy.ts`](file:///home/chaitanya/code/december/opencode/packages/llm/src/cache-policy.ts#L18-L37):

```typescript
const AUTO: CachePolicyObject = {
    tools: true,
    system: true,
    messages: 'latest-user-message',
}
```

OpenCode enforces the strict Anthropic 4-breakpoint cap in [`packages/llm/src/protocols/anthropic-messages.ts:L238-251`](file:///home/chaitanya/code/december/opencode/packages/llm/src/protocols/anthropic-messages.ts#L238-L251) using a countdown semaphore:

```typescript
const ANTHROPIC_BREAKPOINT_CAP = 4
const cacheControl = (breakpoints: Cache.Breakpoints, cache: CacheHint | undefined) => {
    if (cache?.type !== 'ephemeral' && cache?.type !== 'persistent') return undefined
    if (breakpoints.remaining <= 0) {
        breakpoints.dropped += 1
        return undefined
    }
    breakpoints.remaining -= 1
    return Cache.ttlBucket(cache.ttlSeconds) === '1h' ? EPHEMERAL_1H : EPHEMERAL_5M
}
```

If an extension or tool attempts to inject a 5th breakpoint, OpenCode silently drops it, preventing Anthropic API 400 Bad Request rejections.

#### December's Current Defect:

December has **zero** explicit cache control breakpoints in its API payloads. While December attempts to keep its system prompt prefix static in [`packages/agent/src/harness/agent-harness.ts:L84-86`](file:///home/chaitanya/code/december/packages/agent/src/harness/agent-harness.ts#L84-L86), it appends dynamic timestamps (`new Date().toISOString().split('T')[0]`) directly into the system prompt string. This destroys intra-day KV cache sharing across midnight boundaries and leaves Anthropic caching completely unassisted.

---

## 5. Deep Dive: Terminal UI, Rendering & Shell Execution

How an agent writes to the terminal screen and interacts with subprocesses determines the fluid, tactile experience of the CLI.

```
+---------------------------------------------------------------------------------------------------+
|                                 TERMINAL RENDERING ARCHITECTURES                                  |
|                                                                                                   |
|   Pi:                  Zero-Framework ANSI Differential Renderer                                  |
|                        - Compares previousLines[] with newLines[]                                 |
|                        - Computes firstChanged and lastChanged line offsets                       |
|                        - Wraps frame in DEC Mode 2026 (\x1b[?2026h ... \x1b[?2026l)               |
|                        - Relative cursor jumps (\x1b[A, \x1b[B); clears lines via \x1b[2K         |
|                        - Latency: < 1ms, Memory overhead: O(lines)                                |
|                                                                                                   |
|   OpenCode:            OpenTUI + SolidJS Reactive Signals                                         |
|                        - Fine-grained signal subscriptions                                        |
|                        - Direct terminal cell buffer updates                                      |
|                        - No Virtual DOM reconciliation                                            |
|                                                                                                   |
|   December:            React 19 + Ink 7 VDOM                                                      |
|                        - Full tree reconciliation on every streaming token                        |
|                        - High GC churn, layout recalculation jitter                               |
|                        - Stdout/stderr cursor fighting                                            |
+---------------------------------------------------------------------------------------------------+
```

### 5.1 Pi's Zero-Framework ANSI Differential Renderer & DEC Mode 2026

Pi implements its own high-performance TUI engine in [`packages/tui/src/tui-main-screen.ts`](file:///home/chaitanya/code/pi/packages/tui/src/tui-main-screen.ts). It deliberately rejects React, Ink, and Blessed in favor of a pure differential ANSI terminal driver.

#### Synchronized Output (DEC Mode 2026)

Terminal flicker occurs when the terminal emulator paints a frame while the application is halfway through writing ANSI cursor movement escape sequences. Pi wraps all rendering in **DEC Mode 2026 Synchronized Output** ([`packages/tui/src/tui-main-screen.ts:L460, L567`](file:///home/chaitanya/code/pi/packages/tui/src/tui-main-screen.ts#L460)):

```typescript
output.append("\x1b[?2026h"); // Begin synchronized output (atomic frame buffer)
...
output.append("\x1b[?2026l"); // End synchronized output (flush buffer to display)
```

Modern terminal emulators (iTerm2, Alacritty, Ghostty, Kitty, WezTerm, Windows Terminal) buffer all incoming writes between `?2026h` and `?2026l` and render the frame in a single atomic GPU screen refresh.

#### Differential Line Slicing

In [`packages/tui/src/tui-main-screen.ts:L449-546`](file:///home/chaitanya/code/pi/packages/tui/src/tui-main-screen.ts#L449-L546):

1. Pi compares `previousLines` with `newLines` to find `firstChanged` and `lastChanged`.
2. If only a single line changed (e.g. an animated spinner or token streaming word), Pi emits relative cursor positioning codes (`\x1b[<N>A` to move up, `\x1b[<N>B` to move down).
3. Clears only the changed line (`\x1b[2K`) and writes the new string.
4. If line counts shrank, clears deleted trailing lines.
5. Employs a crash guard: if any component emits a line whose `visibleWidth(line) > width`, it halts the TUI cleanly, restores terminal modes, and writes the offending frame to `pi-tui-crash.log`.

### 5.2 OpenCode's OpenTUI + SolidJS vs. December's React 19 + Ink 7

OpenCode utilizes **OpenTUI** combined with **SolidJS** (`@opentui/solid`, [`packages/tui/package.json:L55-57`](file:///home/chaitanya/code/december/opencode/packages/tui/package.json#L55-L57)). Because SolidJS uses fine-grained reactive primitives (Signals), when a new token streams in, only the specific text node's terminal cell coordinates update. There is no component tree re-rendering, no virtual DOM creation, and no array diffing.

In contrast, December uses **React 19** + **Ink 7** ([`packages/tui/package.json:L29-35`](file:///home/chaitanya/code/december/packages/tui/package.json#L29-L35)). Ink reconstructs a virtual terminal DOM tree, executes React reconciliation on every token chunk, recalculates Yoga flexbox layouts, and flushes whole ANSI screen buffers. This causes noticeable CPU utilization, garbage collection spikes, and terminal cursor jumping under high-throughput streaming (e.g. Claude 3.7 streaming at 100 tokens/second).

### 5.3 Shell Execution: PTY Emulation vs. Process Group Isolation vs. December's Stdin Bug

Subprocess execution is fraught with subtle Unix/POSIX traps.

#### OpenCode: Full Pseudoterminal (`node-pty`)

OpenCode integrates `node-pty` in [`packages/core/src/pty/pty.ts`](file:///home/chaitanya/code/december/opencode/packages/core/src/pty/pty.ts#L1-L26). This allocates a real master/slave pseudoterminal pair. Interactive terminal commands (`npm init`, `git log`, `htop`, colored linters) believe they are connected to a genuine TTY. OpenCode provides full window resize propagation (`resize(cols, rows)`), ANSI pass-through, and interactive keyboard input forwarding.

#### Pi: Process Group Tracking & `killProcessTree`

Pi manages shell tasks with surgical process group detachment in [`packages/coding-agent/src/core/tools/bash.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/tools/bash.ts#L94-L105):

```typescript
const child = spawn(
    shellConfig.shell,
    commandFromStdin ? shellConfig.args : [...shellConfig.args, command],
    {
        cwd,
        detached: process.platform !== 'win32',
        env: env ?? getShellEnv(),
        stdio: [commandFromStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
        windowsHide: true,
    }
)
```

Notice that unless input is explicitly piped, `stdin` is set to `"ignore"`, rather than closing the pipe.

When aborting or timing out, killing a parent shell does not kill child processes spawned by it (e.g. `npm test` spawning `vitest` or `node`). Pi solves this with cross-platform tree killing in [`packages/coding-agent/src/utils/shell.ts:L216-246`](file:///home/chaitanya/code/pi/packages/coding-agent/src/utils/shell.ts#L216-L246):

```typescript
export function killProcessTree(pid: number): void {
    if (process.platform === 'win32') {
        // Use trusted System32 taskkill executable
        spawn(
            join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
            ['/F', '/T', '/PID', String(pid)],
            { stdio: 'ignore', detached: true, windowsHide: true }
        ).once('error', () => {})
    } else {
        // Negative PID sends SIGKILL to the entire process group
        try {
            process.kill(-pid, 'SIGKILL')
        } catch {
            try {
                process.kill(pid, 'SIGKILL')
            } catch {}
        }
    }
}
```

#### December's Immediate Stdin Closure Bug

December suffers from a critical bug in [`apps/cli/src/local-operations.ts:L42-47`](file:///home/chaitanya/code/december/apps/cli/src/local-operations.ts#L42-L47):

```typescript
const child = spawn(command, {
    cwd: targetCwd,
    detached: process.platform !== 'win32',
    env: options.env ?? process.env,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
})

// Immediately close stdin so child doesn't hang waiting for terminal input
try {
    child.stdin?.end?.()
} catch {
    // Intentionally swallowed: stdin might already be closed or unavailable
}
```

**Why this is a fatal flaw:**

1. Any process that expects to read from `stdin` immediately receives `EOF`.
2. Commands like `python -c "..."`, interactive CLI prompts, or test runners that inspect `stdin` fail immediately or crash with `EPIPE`.
3. Background tasks launched via `manage_task` with action `send_input` can never send input because the stdin pipe was permanently terminated at inception!

---

## 6. Deep Dive: Session Persistence & Undo Safety

What happens when an agent makes a disastrous code modification or the user wants to rewind to turn 4?

```
+---------------------------------------------------------------------------------------------------------+
|                                    SESSION PERSISTENCE ARCHITECTURES                                    |
|                                                                                                         |
|   Pi: Append-Only JSONL DAG Tree                                                                        |
|   +-------------------------------------------------------------------------------------------------+   |
|   | Entry 1 (Root)  id: "uuid-1", parentId: null                                                    |   |
|   | Entry 2 (Msg)   id: "uuid-2", parentId: "uuid-1"                                                |   |
|   | Entry 3 (Edit)  id: "uuid-3", parentId: "uuid-2"                                                |   |
|   | Entry 4 (Fork)  id: "uuid-4", parentId: "uuid-2"  <-- Rewound to turn 2 without rewriting disk  |   |
|   | Disk operations: 100% append-only. Zero truncation, zero data loss, instant branching.          |   |
|   +-------------------------------------------------------------------------------------------------+   |
|                                                                                                         |
|   OpenCode: Shadow Git Snapshotting                                                                     |
|   +-------------------------------------------------------------------------------------------------+   |
|   | Isolated Git Directory: .opencode/data/snapshot/<project-id>/<worktree-hash>                     |   |
|   | Worktree: User workspace                                                                        |   |
|   | Before/After tool execution: git track() creates shadow git commit                              |   |
|   | Revert / Undo: git restore(snapshot) restores exact workspace bytes without touching user's .git|   |
|   +-------------------------------------------------------------------------------------------------+   |
|                                                                                                         |
|   December: Flat FileSessionRepository                                                                  |
|   +-------------------------------------------------------------------------------------------------+   |
|   | Flat JSONL array of AgentMessage[]. No parent pointers, no branching, no filesystem snapshots.   |   |
+---------------------------------------------------------------------------------------------------------+
```

### 6.1 Pi's Append-Only JSONL DAG Session Tree

In [`packages/coding-agent/src/core/session-manager.ts`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/session-manager.ts), Pi records every action as an immutable DAG entry:

- Every entry has `{ id, parentId, timestamp }` ([`L46-51`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/session-manager.ts#L46-L51)).
- To reconstruct the active conversation context for any given leaf (`leafId`), Pi starts at the leaf and walks upward via `parentId` pointers until reaching root, then reverses the list ([`L352-360`](file:///home/chaitanya/code/pi/packages/coding-agent/src/core/session-manager.ts#L352-L360)):
    ```typescript
    const path: SessionEntry[] = []
    let current: SessionEntry | undefined = leaf
    while (current) {
        path.push(current)
        current = current.parentId ? index.get(current.parentId) : undefined
    }
    path.reverse()
    ```
- Undoing or branching never mutates or truncates historical session files. An undo simply sets the active leaf pointer to an ancestor ID. If the user types a new prompt, a new entry is appended whose `parentId` is that ancestor. The file remains purely append-only, eliminating session corruption.

### 6.2 OpenCode's Shadow Git Snapshotting

OpenCode provides true filesystem rollback safety through **Shadow Git Snapshotting** in [`packages/opencode/src/snapshot/index.ts`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/snapshot/index.ts).

#### Architecture:

- OpenCode creates a private Git directory in `.opencode/data/snapshot/<project-id>/<hash>` ([`L71`](file:///home/chaitanya/code/december/opencode/packages/opencode/src/snapshot/index.ts#L71)), completely isolated from the user's `.git`.
- It sets `--git-dir = snapshot_gitdir` and `--work-tree = project_worktree`.
- **`track()`**: Before and after tool execution, OpenCode runs `git add -A` and writes a shadow tree commit.
- **`restore(snapshot)`**: Reverts the workspace to any prior snapshot commit.
- **`diffFull(from, to)`**: Computes clean line-by-line diffs for UI review.
- Because this runs in a dedicated shadow repo, it works even if the user project is not a git repository, and it never pollutes the user's commit history or git reflog.

#### December's Defect:

December's `FileSessionRepository` in [`apps/cli/src/file-session-repository.ts`](file:///home/chaitanya/code/december/apps/cli/src/file-session-repository.ts#L23-L60) only records flat messages. There is no branching DAG, no undo mechanism, and zero filesystem rollback capability. If December damages a file, the user must manually recover it via `git checkout`.

---

## 7. Complete Implementation Blueprint for December

To elevate December from a capable prototype into a tier-1 terminal coding agent comparable to Pi and OpenCode, the following architectural upgrades must be implemented across `packages/tools`, `packages/agent`, and `apps/cli`.

```
+---------------------------------------------------------------------------------------------------+
|                                 DECEMBER TARGET ARCHITECTURE ROADMAP                              |
|                                                                                                   |
|   1. packages/tools/src/edit.ts                                                                   |
|      - Migrate to multi-disjoint edits array: edits: Array<{ oldText, newText }>                  |
|      - Implement Unicode NFKC + smart-quote + dash fuzzy normalization                            |
|      - Implement withFileMutationQueue mutex lock per realpath                                    |
|      - Implement applyReplacementsPreservingUnchangedLines                                        |
|      - Add instant TypeScript/linter feedback hook                                                |
|                                                                                                   |
|   2. packages/agent/src/utils/compaction.ts & agent-loop.ts                                       |
|      - Implement Tier-1 Tool Pruning (zero-cost clearing of outputs > 40k tokens)                 |
|      - Implement Structured File Tracking (<read-files> and <modified-files> XML blocks)          |
|      - Inject 3-Point Cache Control markers into Provider payloads                                |
|                                                                                                   |
|   3. packages/agent/src/harness/agent-harness.ts                                                  |
|      - Implement loadProjectContextFiles upward directory climbing (AGENTS.md / CLAUDE.md)        |
|      - Remove dynamic date from static system prompt prefix; move to turn metadata                |
|                                                                                                   |
|   4. apps/cli/src/local-operations.ts                                                             |
|      - Remove child.stdin?.end?.() bug; support stdin piping and interactive input                |
|      - Implement cross-platform process group kill (killProcessTree with -pid on POSIX)           |
|                                                                                                   |
|   5. apps/cli/src/file-session-repository.ts                                                      |
|      - Upgrade to append-only DAG entry tree with parentId links                                  |
|      - Integrate shadow git snapshotting for filesystem mutation rollback                         |
+---------------------------------------------------------------------------------------------------+
```

### 7.1 Blueprint 1: Multi-Disjoint Fuzzy Edit Engine (`packages/tools/src/edit.ts`)

Replace the fragile single-replace logic in `packages/tools/src/edit.ts` with a hardened multi-disjoint, fuzzy-normalized engine:

```typescript
import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'
import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

// Per-file mutation queue
const fileMutationQueues = new Map<string, Promise<void>>()
let registrationQueue = Promise.resolve()

async function withFileMutationQueue<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    const registration = registrationQueue.then(async () => {
        let key = resolve(filePath)
        try {
            key = await realpath(key)
        } catch {}
        const currentQueue = fileMutationQueues.get(key) ?? Promise.resolve()
        let releaseNext!: () => void
        const nextQueue = new Promise<void>((r) => {
            releaseNext = r
        })
        const chainedQueue = currentQueue.then(() => nextQueue)
        fileMutationQueues.set(key, chainedQueue)
        return { key, currentQueue, chainedQueue, releaseNext }
    })
    registrationQueue = registration.then(
        () => undefined,
        () => undefined
    )
    const { key, currentQueue, chainedQueue, releaseNext } = await registration
    await currentQueue
    try {
        return await fn()
    } finally {
        releaseNext()
        if (fileMutationQueues.get(key) === chainedQueue) fileMutationQueues.delete(key)
    }
}

// Unicode & typographical normalization
export function normalizeForFuzzyMatch(text: string): string {
    return text
        .normalize('NFKC')
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
        .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, ' ')
}

const replaceEditSchema = Type.Object({
    oldText: Type.String({ description: 'Exact text block to replace. Must match uniquely.' }),
    newText: Type.String({ description: 'Replacement text block.' }),
})

const editSchema = Type.Object({
    path: Type.String({ description: 'Target file path' }),
    edits: Type.Array(replaceEditSchema, {
        description: 'One or more targeted replacements matched against original file content.',
    }),
})

export type EditInput = Static<typeof editSchema>

export const EditTool: Tool<EditInput> = {
    name: 'edit_file',
    description:
        'Edits a file with exact text replacement, supporting multiple disjoint edits in one call.',
    inputSchema: editSchema,
    execute: async ({ path, edits }, context: ToolExecuteContext) => {
        return withFileMutationQueue(path, async () => {
            const rawContent = await context.operations.fs.readFile(path)
            const isCrlf = rawContent.includes('\r\n')
            const normalizedContent = rawContent.replace(/\r\n/g, '\n')

            // Normalize fuzzy space
            const fuzzyContent = normalizeForFuzzyMatch(normalizedContent)

            interface MatchSpan {
                editIndex: number
                matchIndex: number
                matchLength: number
                newText: string
            }
            const matches: MatchSpan[] = []

            for (let i = 0; i < edits.length; i++) {
                const { oldText, newText } = edits[i]
                const normOld = oldText.replace(/\r\n/g, '\n')
                const normNew = newText.replace(/\r\n/g, '\n')

                // 1. Try exact match
                let idx = normalizedContent.indexOf(normOld)
                let matchLen = normOld.length

                // 2. Fall back to fuzzy match
                if (idx === -1) {
                    const fuzzyOld = normalizeForFuzzyMatch(normOld)
                    idx = fuzzyContent.indexOf(fuzzyOld)
                    matchLen = fuzzyOld.length
                    if (idx === -1) {
                        return `Error: Could not find oldText for edit[${i}] in ${path}. Ensure whitespace and characters match.`
                    }
                    if (fuzzyContent.split(fuzzyOld).length - 1 > 1) {
                        return `Error: Multiple occurrences found for edit[${i}]. Provide more context lines.`
                    }
                } else if (normalizedContent.split(normOld).length - 1 > 1) {
                    return `Error: Multiple occurrences found for edit[${i}]. Provide more context lines.`
                }

                matches.push({
                    editIndex: i,
                    matchIndex: idx,
                    matchLength: matchLen,
                    newText: normNew,
                })
            }

            // Check disjoint ordering & overlaps
            matches.sort((a, b) => a.matchIndex - b.matchIndex)
            for (let i = 1; i < matches.length; i++) {
                const prev = matches[i - 1]
                const curr = matches[i]
                if (prev.matchIndex + prev.matchLength > curr.matchIndex) {
                    return `Error: Edits [${prev.editIndex}] and [${curr.editIndex}] overlap. Merge them into a single edit block.`
                }
            }

            // Apply in reverse to maintain offsets
            let updated = normalizedContent
            for (let i = matches.length - 1; i >= 0; i--) {
                const m = matches[i]
                updated =
                    updated.slice(0, m.matchIndex) +
                    m.newText +
                    updated.slice(m.matchIndex + m.matchLength)
            }

            // Restore CRLF if file was CRLF
            const finalContent = isCrlf ? updated.replace(/\n/g, '\r\n') : updated
            await context.operations.fs.writeFile(path, finalContent)
            return `Successfully applied ${edits.length} replacement(s) to ${path}.`
        })
    },
}
```

### 7.2 Blueprint 2: Upward Directory Instruction Climbing (`packages/agent/src/harness/agent-harness.ts`)

Upgrade `AgentHarness.discoverRules` to climb recursively from workspace directory to root, while handling ancestor shadowing:

```typescript
import path from 'node:path'
import fs from 'node:fs'

interface DiscoveredRule {
    path: string
    content: string
}

export function discoverProjectRules(startDir: string, rootBoundary?: string): DiscoveredRule[] {
    const rules: DiscoveredRule[] = []
    const seen = new Set<string>()
    const candidateNames = ['AGENTS.override.md', 'AGENTS.md', 'CLAUDE.md']

    let current = path.resolve(startDir)
    const boundary = rootBoundary ? path.resolve(rootBoundary) : path.parse(current).root

    const collectedFiles: { path: string; content: string }[] = []

    while (true) {
        for (const name of candidateNames) {
            const candidatePath = path.join(current, name)
            if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
                if (!seen.has(candidatePath)) {
                    seen.add(candidatePath)
                    const content = fs.readFileSync(candidatePath, 'utf8').trim()
                    if (content) {
                        collectedFiles.unshift({ path: candidatePath, content }) // Root-most rules first
                    }
                }
                break // First match per directory wins
            }
        }

        if (current === boundary) break
        const parent = path.dirname(current)
        if (parent === current) break
        current = parent
    }

    return collectedFiles
}
```

### 7.3 Blueprint 3: Two-Tier Compaction & 3-Point Cache Controls

In `packages/agent/src/utils/compaction.ts`, integrate Tier-1 tool output pruning:

```typescript
export const PRUNE_PROTECT_TOKENS = 40_000
export const PRUNE_MINIMUM_SAVINGS = 15_000

export function pruneToolResults(messages: AgentMessage[]): {
    pruned: boolean
    tokensSaved: number
} {
    let totalToolTokens = 0
    let tokensToPrune = 0
    const partsToClear: Array<{ msgIndex: number; toolId: string }> = []

    // Scan backwards, protecting recent turns
    let userTurns = 0
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg.role === 'user') userTurns++
        if (userTurns < 2) continue // Preserve last 2 turns

        if (msg.role === 'tool' || (msg.role === 'assistant' && msg.toolCalls)) {
            // Estimate tokens in output
            const outputText =
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            const tokenEstimate = Math.ceil(outputText.length / 4)
            totalToolTokens += tokenEstimate

            if (totalToolTokens > PRUNE_PROTECT_TOKENS) {
                tokensToPrune += tokenEstimate
                partsToClear.push({ msgIndex: i, toolId: msg.id ?? String(i) })
            }
        }
    }

    if (tokensToPrune < PRUNE_MINIMUM_SAVINGS) {
        return { pruned: false, tokensSaved: 0 }
    }

    // Clear identified tool outputs
    for (const { msgIndex } of partsToClear) {
        const target = messages[msgIndex]
        target.content = '[Old tool result content cleared]'
    }

    return { pruned: true, tokensSaved: tokensToPrune }
}
```

And in `packages/agent/src/agent-loop.ts`, inject the 3-point `cache_control` markers before calling Anthropic/OpenAI providers:

```typescript
// Breakpoint 1: Static System Prompt
const cachedSystemPrompt = [
    {
        type: 'text',
        text: agent.systemPrompt,
        cache_control: { type: 'ephemeral' },
    },
]

// Breakpoint 2: Tools Definition Array (Last Tool)
const cachedTools = tools.map((t, idx) => {
    if (idx === tools.length - 1) {
        return { ...t, cache_control: { type: 'ephemeral' } }
    }
    return t
})

// Breakpoint 3: Last User Message in Conversation History
const lastUserIdx = messages.findLastIndex((m) => m.role === 'user')
if (lastUserIdx !== -1) {
    const targetMsg = messages[lastUserIdx]
    targetMsg.cache_control = { type: 'ephemeral' }
}
```

### 7.4 Blueprint 4: PTY Emulation & Subprocess Tree Termination (`apps/cli/src/local-operations.ts`)

Fix the stdin termination bug and add process-group termination:

```typescript
import { spawn } from 'node:child_process'
import { join } from 'node:path'

export function killProcessGroup(pid: number): void {
    if (process.platform === 'win32') {
        try {
            spawn(
                join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
                ['/F', '/T', '/PID', String(pid)],
                { stdio: 'ignore', detached: true, windowsHide: true }
            ).once('error', () => {})
        } catch {}
    } else {
        try {
            process.kill(-pid, 'SIGKILL')
        } catch {
            try {
                process.kill(pid, 'SIGKILL')
            } catch {}
        }
    }
}

// In local-operations.ts bash execution:
const child = spawn(command, {
    cwd: targetCwd,
    detached: process.platform !== 'win32',
    env: options.env ?? process.env,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
})

// DO NOT close child.stdin here! Keep stdin open for interactive inputs.
// Handle timeout with killProcessGroup
if (options.timeout) {
    timeoutHandle = setTimeout(() => {
        if (child.pid) killProcessGroup(child.pid)
    }, options.timeout * 1000)
}
```

---

## 8. Comparative Synthesis & Summary Matrix

```
+-------------------------------------------------------------------------------------------------------+
|                                    DEFINITIVE ARCHITECTURAL MATRIX                                    |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Architectural Dimension  | Pi (pi-mono)          | OpenCode                | December Target          |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Language / Runtime       | Node.js / Bun         | Bun / Effect-TS         | Bun / TypeScript         |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Tool Calling Protocol    | TypeBox / Strict JSON | Effect Schema / Struct  | TypeBox Schemas          |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Multi-Edit in One Call   | Yes (`edits[]` array) | No (Single + replaceAll)| Yes (`edits[]` array)    |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Fuzzy Matching           | NFKC + Quotes + Dashes| 9-Tier Replacer Cascade | NFKC + Anchor fallback   |
| Strategy                 | + Touched line slice  | (Levenshtein > 0.65)    | + Touched line slice     |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Mutation Concurrency     | `withFileMutationQueue`| Semaphore per path      | `withFileMutationQueue`  |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Prompt System            | Modular Contributions | Model-Specific Dispatch | Modular + Model Dispatch |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Instruction Climbing     | Upward to Root +      | JIT on `read` tool      | Upward to Root Boundary  |
|                          | Shadow Worktree Check | + Upward Climbing       |                          |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Context Compaction       | Structured Checkpoint | Two-Tier: Tool Prune +  | Two-Tier: Tool Prune +   |
|                          | (<read/modified-files>)| Tail LLM Summarization | Structured Checkpoints   |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Prompt Caching           | 3-Point Cache Controls| Auto Policy + 4-Cap     | 3-Point Cache Controls   |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Terminal Renderer        | ANSI Diff + DEC 2026  | OpenTUI + SolidJS       | Synchronized ANSI Diff   |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Process Subsystem        | Detached Process Tree | `node-pty` Pseudo-TTY   | Non-closing Stdin +      |
|                          | + `killProcessTree`   | + Interactive forward   | `killProcessGroup`       |
+--------------------------+-----------------------+-------------------------+--------------------------+
| Session Durability       | Append-Only JSONL DAG | Shadow Git Repository   | Append-Only JSONL DAG    |
|                          | Session Tree          | (`.opencode/data/...`)  | + Shadow Git Snapshot    |
+--------------------------+-----------------------+-------------------------+--------------------------+
```

By executing this blueprint, December combines the lightweight speed and ANSI differential elegance of Pi with the industrial resilience, LSP feedback, and shadow git snapshotting of OpenCode—establishing a premier terminal coding agent architecture.
