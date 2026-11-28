// account rules and agent memory (the Rules and Memory tabs of Connections). the server
// checks every save with these limits, the web checks a form before it sends it, and the
// worker builds the system prompt parts of a cloud run with the builders below.

/** a rule name: lowercase letters, digits and dashes, like a skill name */
export const RULE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
/** the largest rule, in bytes (utf-8) */
export const RULE_MAX_BYTES = 16 * 1024
/** all rules of an account together, in bytes. every rule that is on goes into each run */
export const RULES_TOTAL_MAX_BYTES = 32 * 1024
/** the most rules an account keeps */
export const RULES_PER_USER_MAX = 20

/** the longest memory, in characters */
export const MEMORY_MAX_CHARS = 500
/** the most memories an account keeps */
export const MEMORIES_PER_USER_MAX = 100
/** the memory part of the system prompt stops at this many characters */
export const MEMORY_PROMPT_LIMIT = 8000
/** the most memories one run may save, update or delete */
export const MEMORY_WRITES_PER_RUN = 20

/** the size of a text in bytes, as it is saved */
export const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length

export type RuleForPrompt = { name: string; body: string; enabled: boolean }

const RULES_HEADING = [
    '# Account rules',
    'The user saved these rules on their December account. Follow them in every task.',
].join('\n')

/**
 * The account rules part of the system prompt: every rule that is on, as a section of an
 * AGENTS.md file (`## name` and the rule). The cli reads the global ~/.december/AGENTS.md
 * the same way. Stops at the total limit, so an old row over the limit cannot grow it.
 */
export const buildRulesSection = (rules: RuleForPrompt[]): string => {
    const blocks: string[] = []
    let used = 0
    for (const rule of rules) {
        const body = rule.body.trim()
        if (!rule.enabled || !body) continue
        const block = `## ${rule.name}\n${body}`
        const size = utf8Bytes(block)
        if (used + size > RULES_TOTAL_MAX_BYTES) break
        blocks.push(block)
        used += size
    }
    return blocks.length > 0 ? [RULES_HEADING, ...blocks].join('\n\n') : ''
}

export type MemoryForPrompt = { handle: string; content: string }

const MEMORY_HEADING = [
    '# Memory',
    'What you remember about the user from earlier sessions. Use it when it helps with the task.',
    'Keep it current with the memory tool: save a lasting fact or preference the user tells you, update one that changed, delete one that is wrong.',
].join('\n')

/**
 * The memory part of the system prompt: the memories the run reads, newest first, each with
 * the handle the memory tool uses. Stops at `MEMORY_PROMPT_LIMIT` characters.
 */
export const buildMemorySection = (memories: MemoryForPrompt[]): string => {
    if (memories.length === 0) return ''
    const lines: string[] = []
    let used = MEMORY_HEADING.length
    for (const memory of memories) {
        const line = `- [${memory.handle}] ${memory.content.replace(/\s+/g, ' ').trim()}`
        if (used + line.length + 1 > MEMORY_PROMPT_LIMIT) break
        lines.push(line)
        used += line.length + 1
    }
    const left = memories.length - lines.length
    return [
        MEMORY_HEADING,
        '',
        ...lines,
        ...(left > 0 ? [`(${left} older memories did not fit here.)`] : []),
    ].join('\n')
}
