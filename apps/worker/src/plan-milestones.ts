export type PlanPhaseId = 'reproduce' | 'locate' | 'implement' | 'test' | 'pr'

export type PlanPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface PlanMilestone {
    id: PlanPhaseId
    title: string
    description: string
    status: PlanPhaseStatus
    rationale?: string
    logs: string[]
    startedAt?: string
    completedAt?: string
}

export interface SessionPlan {
    sessionId: string
    activePhaseId: PlanPhaseId
    milestones: PlanMilestone[]
    updatedAt: number
}

const PHASE_ORDER: PlanPhaseId[] = ['reproduce', 'locate', 'implement', 'test', 'pr']

export function createDefaultSessionPlan(sessionId: string): SessionPlan {
    const now = new Date().toISOString()
    return {
        sessionId,
        activePhaseId: 'reproduce',
        milestones: [
            {
                id: 'reproduce',
                title: 'Reproduce & Understand',
                description:
                    'Analyze user prompt, inspect issue context, and reproduce problem state.',
                status: 'in_progress',
                logs: [],
                startedAt: now,
            },
            {
                id: 'locate',
                title: 'Locate Relevant Code',
                description:
                    'Search repository, inspect source tree, and locate files requiring changes.',
                status: 'pending',
                logs: [],
            },
            {
                id: 'implement',
                title: 'Implement Solution',
                description: 'Apply targeted modifications, refactor code, and update components.',
                status: 'pending',
                logs: [],
            },
            {
                id: 'test',
                title: 'Run Tests & Verify',
                description: 'Run automated tests, verify builds, and ensure no regressions.',
                status: 'pending',
                logs: [],
            },
            {
                id: 'pr',
                title: 'Branch & Create PR',
                description: 'Commit to task branch, push to origin, and generate pull request.',
                status: 'pending',
                logs: [],
            },
        ],
        updatedAt: Date.now(),
    }
}

export function inferPhaseFromToolCall(toolName: string, input?: any): PlanPhaseId | null {
    const lowerName = (toolName || '').toLowerCase()

    if (
        ['read_file', 'readfile', 'grep', 'find', 'search', 'directory_list', 'list_dir'].includes(
            lowerName
        )
    ) {
        return 'locate'
    }

    if (
        [
            'write_file',
            'writefile',
            'write_to_file',
            'edit_file',
            'editfile',
            'edit_diff',
            'create_file',
            'replace_file_content',
            'multi_replace_file_content',
            'patch_file',
        ].includes(lowerName)
    ) {
        return 'implement'
    }

    if (['bash', 'shell', 'command', 'terminal'].includes(lowerName)) {
        const cmd = String(input?.command || input?.cmd || '').toLowerCase()
        const isTestCommand =
            /\b(test|pytest|jest|vitest|typecheck)\b/.test(cmd) ||
            /\b(bun|npm|cargo|pnpm|yarn)\s+(test|run test|check)/.test(cmd) ||
            cmd.includes('tsc --noemit')

        if (isTestCommand) {
            return 'test'
        }
    }

    return null
}

export function advancePlanPhase(options: {
    plan: SessionPlan
    targetPhaseId: PlanPhaseId
    rationale?: string
    log?: string
}): SessionPlan {
    const { plan, targetPhaseId, rationale, log } = options
    const targetIndex = PHASE_ORDER.indexOf(targetPhaseId)
    if (targetIndex === -1) return plan

    const now = new Date().toISOString()

    const updatedMilestones = plan.milestones.map((milestone) => {
        const index = PHASE_ORDER.indexOf(milestone.id)

        if (index < targetIndex) {
            return {
                ...milestone,
                status: 'completed' as PlanPhaseStatus,
                completedAt: milestone.completedAt || now,
            }
        } else if (index === targetIndex) {
            const existingLogs = milestone.logs || []
            const newLogs = log ? [...existingLogs, log] : existingLogs
            return {
                ...milestone,
                status: 'in_progress' as PlanPhaseStatus,
                rationale: rationale || milestone.rationale,
                logs: newLogs,
                startedAt: milestone.startedAt || now,
            }
        } else {
            return milestone
        }
    })

    return {
        ...plan,
        activePhaseId: targetPhaseId,
        milestones: updatedMilestones,
        updatedAt: Date.now(),
    }
}
