import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'
import { Type, type Static } from '@sinclair/typebox'
import * as cheerio from 'cheerio'

const webSearchSchema = Type.Object({
    query: Type.String({ description: 'The search query to look up on the internet.' }),
})

export type WebSearchInput = Static<typeof webSearchSchema>

export const WebSearchTool: Tool<WebSearchInput> = {
    name: 'web_search',
    description:
        'Searches the internet using DuckDuckGo to find information, returning titles, snippets, and URLs. Completely free and requires no API keys.',
    inputSchema: webSearchSchema,
    execute: async ({ query }, context: ToolExecuteContext) => {
        try {
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
            const res = await fetch(url, {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            })

            if (!res.ok) {
                return `Search failed with status ${res.status}: ${res.statusText}`
            }

            const html = await res.text()
            const $ = cheerio.load(html)

            const results: Array<{ title: string; url: string; snippet: string }> = []

            $('.result').each((i, el) => {
                const title = $(el).find('.result__title').text().trim()
                const snippet = $(el).find('.result__snippet').text().trim()
                let link = $(el).find('.result__url').attr('href') || ''

                if (link.startsWith('//')) {
                    const parsedUrl = new URL('https:' + link)
                    link = parsedUrl.searchParams.get('uddg') || link
                }

                if (title && link) {
                    results.push({ title, url: link, snippet })
                }
            })

            if (results.length === 0) {
                return 'No search results found.'
            }

            let output = `Search Results for "${query}":\n\n`
            results.slice(0, 10).forEach((result, index) => {
                output += `${index + 1}. ${result.title}\n`
                output += `   URL: ${result.url}\n`
                output += `   Snippet: ${result.snippet}\n\n`
            })

            return truncateOutput(output).text
        } catch (error: any) {
            return `Failed to execute web search: ${error.message}`
        }
    },
}
