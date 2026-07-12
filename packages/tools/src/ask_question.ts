import { Tool } from '@december/shared'

export const AskQuestionTool: Tool<{
    questions: Array<{
        question: string
        options: string[]
        is_multi_select?: boolean
    }>
}> = {
    name: 'ask_question',
    description: `Use this tool to ask the user one or more multiple-choice questions. Execution is blocked until the user responds.`,
    inputSchema: {
        type: 'object',
        properties: {
            questions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        question: { type: 'string' },
                        options: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        is_multi_select: { type: 'boolean' },
                    },
                    required: ['question', 'options'],
                },
            },
        },
        required: ['questions'],
    },
    execute: async (input, context) => {
        // The implementation here will be intercepted by the UI, but we provide a fallback
        // in case the UI doesn't intercept it (e.g. running in headless mode).
        // Since we want this to be intercepted by the TUI, we can just throw an error here,
        // or we can invoke a callback from context.operations if we added one.

        // Actually, if we're not intercepted, we should probably fail or return a message.
        if ((context.operations as any).askQuestion) {
            return await (context.operations as any).askQuestion(input.questions)
        }

        return 'Error: Interactive menus are only supported in the TUI.'
    },
}
