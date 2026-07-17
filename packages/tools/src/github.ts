import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const githubSchema = Type.Object({
    endpoint: Type.String({ description: 'GitHub API endpoint (e.g. /repos/owner/repo/issues)' }),
    method: Type.Optional(Type.String({ description: 'GET, POST, PATCH, etc. Defaults to GET.' })),
    body: Type.Optional(Type.String({ description: 'JSON string of the request body' })),
})

export type GitHubInput = Static<typeof githubSchema>

export const GitHubTool: Tool<GitHubInput> = {
    name: 'github',
    description:
        'Interact with GitHub API (create PRs, read issues, etc). Automatically injects GITHUB_TOKEN if available in the environment.',
    inputSchema: githubSchema,
    execute: async ({ endpoint, method = 'GET', body }, context: ToolExecuteContext) => {
        try {
            const token = context.operations.env.get('GITHUB_TOKEN')
            const headers: Record<string, string> = {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'December-Agent',
            }
            if (token) {
                headers['Authorization'] = `token ${token}`
            }

            const url = endpoint.startsWith('http')
                ? endpoint
                : `https://api.github.com${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

            const res = await fetch(url, {
                method,
                headers,
                body: body ? body : undefined,
            })

            const text = await res.text()
            if (!res.ok) {
                return `GitHub API Error (${res.status}): ${text}`
            }

            return text
        } catch (error: any) {
            return `Failed to fetch from GitHub: ${error.message}`
        }
    },
}
