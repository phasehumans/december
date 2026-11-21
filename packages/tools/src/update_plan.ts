import { Tool } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const planItemSchema = Type.Object({
    text: Type.String({ description: 'One step, written as a short action' }),
    status: Type.Union([
        Type.Literal('pending'),
        Type.Literal('in_progress'),
        Type.Literal('done'),
    ]),
})

const updatePlanSchema = Type.Object({
    items: Type.Array(planItemSchema, {
        description:
            'The full plan, in order. Send every step on each call, not only the changed ones.',
    }),
})

export type UpdatePlanInput = Static<typeof updatePlanSchema>

/** Checks the plan and returns an error message, or null when it is valid */
export function validatePlan(input: UpdatePlanInput): string | null {
    if (!Array.isArray(input?.items) || input.items.length === 0) {
        return 'Error: the plan needs at least one item.'
    }
    if (input.items.some((item) => !item || typeof item.text !== 'string' || !item.text.trim())) {
        return 'Error: every plan item needs a non-empty text.'
    }
    const active = input.items.filter((item) => item.status === 'in_progress').length
    if (active > 1) {
        return 'Error: only one plan item can be in_progress at a time.'
    }
    return null
}

export const UpdatePlanTool: Tool<UpdatePlanInput> = {
    name: 'update_plan',
    description:
        'Show the user a short checklist of your plan for a multi-step task, and keep it current as you work. ' +
        'Call it when a task has 3 or more steps, and again each time a step starts or finishes. ' +
        'Send the full list every time. Exactly one item is in_progress while you work on it. ' +
        'When the user approved a plan with /plan, start by calling this tool with the steps of that plan. ' +
        'Do not use it for single-step tasks.',
    inputSchema: updatePlanSchema,
    execute: async (input) => {
        const error = validatePlan(input)
        if (error) return error
        const done = input.items.filter((item) => item.status === 'done').length
        return `Plan updated (${done}/${input.items.length} done).`
    },
}
