import type { CodeSearchMatch, SandboxTask } from './sessioncommand.types'

/** the model behind the commands that need one on the server (/btw, /compact, titles) */
export const COMMAND_MODEL = 'gemini-3.5-flash-lite'

/** a rough count: about 4 characters per token */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

/** the tokens a cloud agent spends before the conversation: system prompt and tools */
export const AGENT_OVERHEAD_TOKENS = 8000

type StoredMessage = { role: string; content: string; blocks?: unknown; status?: string | null }

/** the text of a message as the agent sees it, tool output included */
export const messageText = (message: StoredMessage): string => {
    const blocks = Array.isArray(message.blocks) ? (message.blocks as any[]) : []
    const toolText = blocks
        .filter((block) => block && block.type === 'command')
        .map((block) => `${block.toolName ?? 'tool'}: ${String(block.output ?? '').slice(0, 4000)}`)
        .join('\n')
    return [message.content, toolText].filter(Boolean).join('\n')
}

/** a plain transcript for a summary or a side question, newest text kept when too long */
export const buildTranscript = (messages: StoredMessage[], maxChars = 60_000): string => {
    const lines = messages
        .map((message) => {
            const who = message.role === 'USER' ? 'User' : 'Assistant'
            return `${who}: ${messageText(message).trim()}`
        })
        .filter((line) => !line.endsWith(':'))
    const text = lines.join('\n\n')
    return text.length > maxChars ? `[earlier messages cut]\n${text.slice(-maxChars)}` : text
}

export const COMPACT_SYSTEM_PROMPT = `You summarize a coding session between a user and an AI coding agent, so the agent can continue the work with this summary in place of the conversation.
Write plain text with these parts:
- Goal: what the user wants.
- Done: what was changed, with file paths.
- Decisions: choices made and why.
- Open: what is left, and any error that is not fixed.
Keep names, paths, commands and numbers exact. Leave out greetings and tool output that no longer matters. At most 400 words.`

export const SIDE_QUESTION_SYSTEM_PROMPT = `You answer a quick side question about a coding session between a user and an AI coding agent. The transcript of the session is below the question. Answer in a few sentences, from the transcript. If the transcript does not have the answer, say so. Do not suggest that you will do any work.`

export const TITLE_SYSTEM_PROMPT = `You name coding sessions. Reply with a title of 3 to 7 words that says what the work is, in sentence case, with no quotes and no period.`

/** a model's title, cleaned: one line, no quotes, at most 80 characters */
export const cleanTitle = (raw: string): string =>
    raw
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean)
        ?.replace(/^title:\s*/i, '')
        .replace(/^["'`*]+|["'`*.]+$/g, '')
        .trim()
        .slice(0, 80) ?? ''

/** a value for a single-quoted shell argument */
export const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`

export const CODE_SEARCH_LIMIT = 200

/** a fixed-text search in /workspace: ripgrep when the machine has it, else grep */
export const buildCodeSearchCommand = (query: string): string => {
    const q = shellQuote(query)
    return [
        `(command -v rg >/dev/null 2>&1`,
        `&& rg -n -F -S --no-heading --color never -m 5 --max-columns 300 -- ${q} .`,
        `|| grep -rnIF --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.next -m 5 -- ${q} .)`,
        `2>/dev/null | head -n ${CODE_SEARCH_LIMIT}`,
    ].join(' ')
}

/** `path:line:text` lines from rg or grep */
export const parseCodeSearchOutput = (stdout: string): CodeSearchMatch[] =>
    stdout
        .split('\n')
        .map((line) => line.match(/^(?:\.\/)?([^:]+):(\d+):(.*)$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => ({
            path: match[1] ?? '',
            line: Number(match[2]),
            preview: (match[3] ?? '').trim().slice(0, 300),
        }))

export const TASKS_COMMAND = 'ps -eo pid=,etimes=,args= --sort=start_time'

// processes of the machine itself, not started by the agent or the terminal
const SYSTEM_PROCESS =
    /^(\[|\/sbin\/init|\/usr\/bin\/envd|envd|ps |sudo |\/bin\/sh -c ps |sh -c ps |systemd|tini)/

/** the processes the agent or the terminal started, oldest first */
export const parseTasksOutput = (stdout: string): SandboxTask[] =>
    stdout
        .split('\n')
        .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => ({
            pid: Number(match[1]),
            elapsedSeconds: Number(match[2]),
            command: (match[3] ?? '').slice(0, 500),
        }))
        .filter((task) => task.pid !== 1 && !SYSTEM_PROCESS.test(task.command))
