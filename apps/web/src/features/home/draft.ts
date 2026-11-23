/**
 * Keeps the Home prompt text when a slash command opens another page
 * (for example /mcp), so the text is still in the box when the user comes back.
 */
let draft: string | null = null

export const saveHomeDraft = (text: string) => {
    draft = text.trim() ? text : null
}

export const takeHomeDraft = (): string | null => {
    const value = draft
    draft = null
    return value
}
