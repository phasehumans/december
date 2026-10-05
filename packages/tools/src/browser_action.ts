import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const browserActionSchema = Type.Object({
    action: Type.Union(
        [
            Type.Literal('navigate'),
            Type.Literal('click'),
            Type.Literal('type'),
            Type.Literal('screenshot'),
            Type.Literal('get_console_errors'),
        ],
        { description: 'The interactive browser action to execute' }
    ),
    url: Type.Optional(
        Type.String({ description: 'URL to navigate to (required for action: "navigate")' })
    ),
    selector: Type.Optional(
        Type.String({ description: 'CSS selector or text target (for action: "click" or "type")' })
    ),
    text: Type.Optional(
        Type.String({ description: 'Text to input (required for action: "type")' })
    ),
    fullPage: Type.Optional(
        Type.Boolean({ description: 'Capture full scrollable page (for action: "screenshot")' })
    ),
})

export type BrowserActionInput = Static<typeof browserActionSchema>

export const BrowserActionTool: Tool<BrowserActionInput> = {
    name: 'browser_action',
    description:
        'Interact with a headless browser session. Supports navigating to URLs, clicking elements, typing into inputs, capturing screenshots, and inspecting console or network errors on localhost web apps.',
    inputSchema: browserActionSchema,
    execute: async (input, context: ToolExecuteContext) => {
        try {
            if (!context.operations.browser) {
                return `Failed to execute browser action: Browser operations are not supported in this environment.`
            }

            if (!context.operations.browser.action) {
                // Graceful fallback for navigate when only basic browser operations exist
                if (input.action === 'navigate' && input.url) {
                    const navResult = await context.operations.browser.navigate(input.url)
                    if (navResult.error) {
                        return `Failed to navigate: ${navResult.error}`
                    }
                    let out = truncateOutput(navResult.text, 25000, 100).text
                    if (navResult.consoleErrors && navResult.consoleErrors.length > 0) {
                        out +=
                            '\n\n[CONSOLE ERRORS]\n' +
                            navResult.consoleErrors.map((err) => `- ${err}`).join('\n')
                    }
                    if (navResult.networkErrors && navResult.networkErrors.length > 0) {
                        out +=
                            '\n\n[FAILED NETWORK REQUESTS]\n' +
                            navResult.networkErrors.map((err) => `- ${err}`).join('\n')
                    }
                    return out
                }
                return `Browser interactive actions ('click', 'type', 'screenshot') require Chrome or Chromium to be installed.`
            }

            const result = await context.operations.browser.action(input)

            if (result.error) {
                return `Failed to execute action "${input.action}": ${result.error}`
            }

            let response =
                result.output ||
                result.text ||
                `Browser action "${input.action}" completed successfully.`

            if (result.screenshotPath) {
                response += `\n[Screenshot saved: ${result.screenshotPath}]`
            }

            if (result.consoleErrors && result.consoleErrors.length > 0) {
                response +=
                    '\n\n[CONSOLE ERRORS]\n' +
                    result.consoleErrors.map((err) => `- ${err}`).join('\n')
            }

            if (result.networkErrors && result.networkErrors.length > 0) {
                response +=
                    '\n\n[FAILED NETWORK REQUESTS]\n' +
                    result.networkErrors.map((err) => `- ${err}`).join('\n')
            }

            return response
        } catch (error: any) {
            return `Failed to execute browser action: ${error.message}`
        }
    },
}
