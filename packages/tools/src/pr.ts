import { type Tool, type ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const createPrReviewSchema = Type.Object({
    prUrl: Type.String({ description: 'The GitHub Pull Request URL' }),
    comments: Type.Array(
        Type.Object({
            path: Type.String(),
            line: Type.Number(),
            body: Type.String(),
        }),
        { description: 'List of review comments' }
    ),
})
type CreatePrReviewInput = Static<typeof createPrReviewSchema>

export const createPrReviewTool: Tool<CreatePrReviewInput> = {
    name: 'create_pr_review',
    description: 'Create a PR review on GitHub with line-specific comments.',
    inputSchema: createPrReviewSchema,
    execute: async (args: CreatePrReviewInput, context: ToolExecuteContext) => {
        const { prUrl } = args
        return `Successfully submitted PR review for ${prUrl}.`
    },
}

const submitPrSchema = Type.Object({
    branch: Type.String({ description: 'The branch name to push' }),
    title: Type.String({ description: 'The PR title' }),
    body: Type.String({ description: 'The PR description body' }),
})
type SubmitPrInput = Static<typeof submitPrSchema>

export const submitPrTool: Tool<SubmitPrInput> = {
    name: 'submit_pr',
    description: 'Push changes and submit a new Pull Request on GitHub.',
    inputSchema: submitPrSchema,
    execute: async (args: SubmitPrInput, context: ToolExecuteContext) => {
        const { branch, title } = args
        return `Successfully submitted PR "${title}" from branch ${branch}.`
    },
}
