import { buildCheckpointCommand, findMatchingRule, getLearnPrompt } from '@december/shared'

import { withPlanFirst } from './plan-first'

import type { AgentHooks } from '@december/shared'

/**
 * What a cloud turn does with the slash commands that run as an agent turn (#632):
 * /learn becomes the learn prompt, plan first wraps the prompt. Everything else is sent
 * as typed.
 */
export const buildTurnPrompt = async (data: {
    prompt: string
    planFirst: boolean
    sandbox?: any
}): Promise<string> => {
    const { prompt, planFirst, sandbox } = data
    const learn = prompt.trim().match(/^\/learn(?:\s+([\s\S]*))?$/)
    if (learn) {
        const target = await findLearnTarget(sandbox)
        return getLearnPrompt({
            lesson: (learn[1] ?? '').trim(),
            ruleFile: 'AGENTS.md',
            ruleFileExists: target.ruleFileExists,
            nestedRuleFiles: [],
            skillsDir: '.december/skills',
            existingSkillNames: target.skillNames,
        })
    }
    return planFirst ? withPlanFirst(prompt) : prompt
}

/** whether AGENTS.md exists and which project skills there are, in the session machine */
const findLearnTarget = async (sandbox: any) => {
    const fallback = { ruleFileExists: false, skillNames: [] as string[] }
    if (!sandbox?.commands?.run) return fallback
    const result = await sandbox.commands
        .run('test -f AGENTS.md && echo RULES; ls -1 .december/skills 2>/dev/null | head -n 50', {
            cwd: '/workspace',
        })
        .catch(() => null)
    const lines = String(result?.stdout ?? '')
        .split('\n')
        .map((line: string) => line.trim())
        .filter(Boolean)
    return {
        ruleFileExists: lines.includes('RULES'),
        skillNames: lines.filter((line: string) => line !== 'RULES'),
    }
}

/**
 * A snapshot of /workspace before the turn of this user message, for /rewind. Never
 * fails the turn: a session without the snapshot rewinds only its chat.
 */
export const createTurnCheckpoint = async (data: { sandbox?: any; sequence?: number }) => {
    const { sandbox, sequence } = data
    if (!sandbox?.commands?.run || !sequence || sequence < 1) return false
    const result = await sandbox.commands
        .run(buildCheckpointCommand(sequence), { cwd: '/workspace', timeoutMs: 60_000 })
        .catch((error: unknown) => {
            console.warn(`[WORKER] turn checkpoint ${sequence} failed:`, error)
            return null
        })
    return String(result?.stdout ?? '').includes('CHECKPOINT')
}

/** /permissions in cloud sessions: a tool call that matches a deny rule is blocked */
export const buildDenyRulesHook = (rules: string[]): AgentHooks['beforeToolCall'] | undefined => {
    const active = rules.map((rule) => rule.trim()).filter(Boolean)
    if (active.length === 0) return undefined
    return async (toolCall) => {
        const rule = findMatchingRule(active, toolCall as any, { allowBareShellName: true })
        return rule
            ? { block: true, reason: `the user denied this in settings (${rule})` }
            : undefined
    }
}
