import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const browserSchema = Type.Object({
    url: Type.String({ description: 'The URL to navigate to' }),
})

export type BrowserInput = Static<typeof browserSchema>

export const BrowserTool: Tool<BrowserInput> = {
    name: 'browser',
    description:
        'Use a basic HTTP client to fetch the HTML content of a URL. Strips out scripts and styles to return clean text. It also exposes a VNC stream for UI inspection.',
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
            if (result.vncUrl) {
                output += `\n\n[VNC STREAM STARTED: ${result.vncUrl}]`
            }

            return output
        } catch (error: any) {
            return `Failed to fetch URL: ${error.message}`
        }
    },
}
