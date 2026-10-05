import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const browserSchema = Type.Object({
    url: Type.String({ description: 'The URL to navigate to' }),
})

export type BrowserInput = Static<typeof browserSchema>

export const BrowserTool: Tool<BrowserInput> = {
    name: 'browser',
    description:
        'Use an interactive browser engine to navigate to a URL, execute client-side JavaScript, extract rendered page content, and capture console or network errors.',
    inputSchema: browserSchema,
    execute: async ({ url }, context: ToolExecuteContext) => {
        try {
            if (!context.operations.browser) {
                return `Failed to fetch URL: Browser operations are not supported in this environment.`
            }

            const result = await context.operations.browser.navigate(url)

            if (result.error) {
                return `Failed to fetch URL: ${result.error}`
            }

            let output = truncateOutput(result.text, 25000, 100).text

            if (result.consoleErrors && result.consoleErrors.length > 0) {
                output +=
                    '\n\n[CONSOLE ERRORS]\n' +
                    result.consoleErrors.map((err) => `- ${err}`).join('\n')
            }

            if (result.networkErrors && result.networkErrors.length > 0) {
                output +=
                    '\n\n[FAILED NETWORK REQUESTS]\n' +
                    result.networkErrors.map((err) => `- ${err}`).join('\n')
            }

            if (result.vncUrl) {
                output += `\n\n[VNC STREAM STARTED: ${result.vncUrl}]`
            }

            return output
        } catch (error: any) {
            return `Failed to fetch URL: ${error.message}`
        }
    },
}
