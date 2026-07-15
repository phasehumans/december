import { Tool } from '@december/shared'

import { Type, Static } from '@sinclair/typebox'

const askQuestionSchema = Type.Object({
    questions: Type.Array(
        Type.Object({
            question: Type.String(),
            options: Type.Array(Type.String()),
            is_multi_select: Type.Optional(Type.Boolean()),
        })
    ),
})

export type AskQuestionInput = Static<typeof askQuestionSchema>

export const AskQuestionTool: Tool<AskQuestionInput> = {
    name: 'ask_question',
    description: `Use this tool to ask the user one or more multiple-choice questions. Execution is blocked until the user responds.`,
    inputSchema: askQuestionSchema,
    execute: async (input, context) => {
        // The implementation here will be intercepted by the UI, but we provide a fallback
        // in case the UI doesn't intercept it (e.g. running in headless mode).
        // Since we want this to be intercepted by the TUI, we can just throw an error here,
        // or we can invoke a callback from context.operations if we added one.

        if (context.operations.ui?.askQuestion) {
            return await context.operations.ui.askQuestion(input.questions)
        }

        return 'Error: Interactive menus are only supported in the TUI.'
    },
}
