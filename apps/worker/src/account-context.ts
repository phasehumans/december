/**
 * The account rules and the agent memory of a cloud run (the Rules and Memory tabs of
 * Connections). The rules that are on and the memories go into the system prompt, next to
 * the user rules; the memory tool lets the agent save, update and delete memories. The tool
 * runs in the worker, never in the sandbox, and only ever reads or writes the rows of the
 * user of the run.
 */
import { prisma } from '@december/database'
import {
    MEMORIES_PER_USER_MAX,
    MEMORY_MAX_CHARS,
    MEMORY_WRITES_PER_RUN,
    buildMemorySection,
    buildRulesSection,
    type RuleForPrompt,
} from '@december/shared/agent-context'

import type { Tool } from '@december/shared'

export type MemoryRow = { id: string; content: string }

export type AccountContext = {
    rules: RuleForPrompt[]
    memoryEnabled: boolean
    /** newest first */
    memories: MemoryRow[]
}

const NO_CONTEXT: AccountContext = { rules: [], memoryEnabled: false, memories: [] }

/**
 * The user's rules and, while memory is on, the memories. A run with no user, or a read that
 * fails, has none: the run goes on without them.
 */
export const loadAccountContext = async (userId: string | undefined): Promise<AccountContext> => {
    if (!userId) return NO_CONTEXT
    try {
        const [user, rules] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { memoryEnabled: true } }),
            prisma.userRule.findMany({
                where: { userId, enabled: true },
                orderBy: { name: 'asc' },
                select: { name: true, body: true, enabled: true },
            }),
        ])
        const memoryEnabled = Boolean(user?.memoryEnabled)
        const memories = memoryEnabled
            ? await prisma.userMemory.findMany({
                  where: { userId },
                  orderBy: { updatedAt: 'desc' },
                  take: MEMORIES_PER_USER_MAX,
                  select: { id: true, content: true },
              })
            : []
        return { rules, memoryEnabled, memories }
    } catch (error) {
        console.warn('[WORKER] could not load the account rules and memory:', error)
        return NO_CONTEXT
    }
}

/** the short name of the memory at this place of the list, for the prompt and the tool */
export const memoryHandle = (index: number) => `m${index + 1}`

/**
 * The account parts of the system prompt: the rules first (like the global AGENTS.md of the
 * cli, the lowest level), then what the run already has, then the memory.
 */
export const withAccountContext = (data: {
    context: AccountContext
    userRules: string | undefined
}): string => {
    const { context, userRules } = data
    const memory = context.memoryEnabled
        ? buildMemorySection(
              context.memories.map((row, index) => ({
                  handle: memoryHandle(index),
                  content: row.content,
              }))
          )
        : ''
    return [buildRulesSection(context.rules), userRules, memory]
        .map((part) => (part ?? '').trim())
        .filter(Boolean)
        .join('\n\n')
}

/** where the memory tool reads and writes; the default is the database */
export type MemoryStore = {
    isEnabled: (userId: string) => Promise<boolean>
    count: (userId: string) => Promise<number>
    create: (row: {
        userId: string
        content: string
        sessionId: string | null
        sessionTitle: string | null
    }) => Promise<MemoryRow>
    /** returns false when the row is not the user's or is gone */
    update: (userId: string, id: string, content: string) => Promise<boolean>
    remove: (userId: string, id: string) => Promise<boolean>
}

export const prismaMemoryStore: MemoryStore = {
    isEnabled: async (userId) => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { memoryEnabled: true },
        })
        return Boolean(user?.memoryEnabled)
    },
    count: (userId) => prisma.userMemory.count({ where: { userId } }),
    create: (row) =>
        prisma.userMemory.create({
            data: { ...row, source: 'agent' },
            select: { id: true, content: true },
        }),
    update: async (userId, id, content) =>
        (await prisma.userMemory.updateMany({ where: { id, userId }, data: { content } })).count >
        0,
    remove: async (userId, id) =>
        (await prisma.userMemory.deleteMany({ where: { id, userId } })).count > 0,
}

export type MemoryToolInput = {
    action: 'save' | 'update' | 'delete'
    content?: string
    id?: string
}

const MEMORY_TOOL_SCHEMA = {
    type: 'object',
    properties: {
        action: {
            type: 'string',
            enum: ['save', 'update', 'delete'],
            description:
                '"save": a new memory. "update": change the memory `id`. "delete": remove the memory `id`.',
        },
        content: {
            type: 'string',
            description: `For "save" and "update": one short fact, at most ${MEMORY_MAX_CHARS} characters.`,
        },
        id: {
            type: 'string',
            description: 'For "update" and "delete": the handle of the memory, like m3.',
        },
    },
    required: ['action'],
}

/**
 * The memory tool of one run. `memories` is the list the prompt shows, so the handles match
 * (m1 is the newest). A memory saved in the run gets the next handle. Secret values of the
 * run are refused, and a run can make at most `MEMORY_WRITES_PER_RUN` changes.
 */
export const createMemoryTool = (data: {
    userId: string
    sessionId: string | null
    sessionTitle: string | null
    memories: MemoryRow[]
    /** the values of the secrets in the sandbox: never saved in a memory */
    secretValues?: string[]
    store?: MemoryStore
}): Tool<MemoryToolInput> => {
    const {
        userId,
        sessionId,
        sessionTitle,
        memories,
        secretValues = [],
        store = prismaMemoryStore,
    } = data
    const ids = new Map(memories.map((row, index) => [memoryHandle(index), row.id]))
    const secrets = secretValues.filter((value) => value.length >= 6)
    let writes = 0
    // handles are never used twice in a run, also after a delete
    let nextIndex = memories.length

    const checkContent = (content: string | undefined): string | { error: string } => {
        const text = (content ?? '').replace(/\s+/g, ' ').trim()
        if (!text) return { error: 'Error: write the memory in "content".' }
        if (text.length > MEMORY_MAX_CHARS) {
            return { error: `Error: a memory is at most ${MEMORY_MAX_CHARS} characters.` }
        }
        if (secrets.some((value) => text.includes(value))) {
            return { error: 'Error: a memory must not hold a secret value.' }
        }
        return text
    }

    return {
        name: 'memory',
        description:
            'Save, update or delete what you remember about the user across sessions. Save only lasting facts and preferences the user tells you or that will help in later tasks, one short fact per memory. Never save secrets, keys, passwords or personal data the user did not ask you to keep.',
        inputSchema: MEMORY_TOOL_SCHEMA,
        executionMode: 'sequential',
        execute: async (input) => {
            const action = input?.action
            if (action !== 'save' && action !== 'update' && action !== 'delete') {
                return 'Error: action must be "save", "update" or "delete".'
            }
            if (writes >= MEMORY_WRITES_PER_RUN) {
                return `Error: this session already changed ${MEMORY_WRITES_PER_RUN} memories.`
            }
            if (!(await store.isEnabled(userId))) {
                return 'Error: the user turned memory off.'
            }

            if (action === 'save') {
                const text = checkContent(input.content)
                if (typeof text !== 'string') return text.error
                if ((await store.count(userId)) >= MEMORIES_PER_USER_MAX) {
                    return `Error: memory is full (${MEMORIES_PER_USER_MAX}). Update or delete a memory first.`
                }
                const row = await store.create({ userId, content: text, sessionId, sessionTitle })
                const handle = memoryHandle(nextIndex++)
                ids.set(handle, row.id)
                writes++
                return `Saved as ${handle}.`
            }

            const handle = (input.id ?? '').trim()
            const id = ids.get(handle)
            if (!id) return `Error: no memory ${handle || 'with that id'}.`

            if (action === 'update') {
                const text = checkContent(input.content)
                if (typeof text !== 'string') return text.error
                if (!(await store.update(userId, id, text))) {
                    return `Error: memory ${handle} is gone.`
                }
                writes++
                return `Updated ${handle}.`
            }

            if (!(await store.remove(userId, id))) return `Error: memory ${handle} is gone.`
            ids.delete(handle)
            writes++
            return `Deleted ${handle}.`
        },
    }
}

/** the title the memories saved in this session show; null when it cannot be read */
export const readSessionTitle = async (sessionId: string): Promise<string | null> => {
    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { title: true },
        })
        return session?.title?.slice(0, 200) ?? null
    } catch (error) {
        console.warn('[WORKER] could not read the session title for memory:', error)
        return null
    }
}
