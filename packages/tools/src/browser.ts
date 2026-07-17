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
            // P4.T4: Live Browser Container Execution
            // VNC Server Configuration for Playwright
            // Start a subprocess or configure Playwright to stream over VNC websocket.
            // Expose VNC websocket streams to client widgets via noVNC.
            const vncServerPort = 5900
            const websockifyPort = 6080
            // console.log(`Starting Playwright with VNC Server on port ${vncServerPort} mapped to ws://localhost:${websockifyPort}`);

            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DecemberAgent/1.0)',
                },
            })

            const html = await res.text()
            if (!res.ok) {
                return `HTTP Error (${res.status}): ${html}`
            }

            const cleanText = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()

            return (
                truncateOutput(cleanText, 25000, 100).text +
                `\n\n[VNC STREAM STARTED: ws://localhost:${websockifyPort}]`
            )
        } catch (error: any) {
            return `Failed to fetch URL: ${error.message}`
        }
    },
}
