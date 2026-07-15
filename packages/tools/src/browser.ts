import { Tool, ToolExecuteContext } from '@december/shared'

import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const browserSchema = Type.Object({
    url: Type.String({ description: 'The URL to navigate to' }),
})

export type BrowserInput = Static<typeof browserSchema>

export const BrowserTool: Tool<BrowserInput> = {
    name: 'browser',
    description:
        'Use a basic HTTP client to fetch the HTML content of a URL. Strips out scripts and styles to return clean text.',
    inputSchema: browserSchema,
    execute: async ({ url }, context: ToolExecuteContext) => {
        try {
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

            return truncateOutput(cleanText, 25000, 100).text
        } catch (error: any) {
            return `Failed to fetch URL: ${error.message}`
        }
    },
}
