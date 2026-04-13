export const cleanPrompt = (input: string): string => {
    if (!input) {
        return ''
    }
    return input.replace(/\r\n?/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}
