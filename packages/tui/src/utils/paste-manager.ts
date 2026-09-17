const pasteStore = new Map<string, string>()
let pasteCounter = 0

export function clearPastes(): void {
    pasteStore.clear()
    pasteCounter = 0
}

export function isPasteToken(token: string): boolean {
    return /^\[Pasted \d+ lines(?: #\d+)?\]$/.test(token)
}

export function storePaste(text: string): string {
    const lineCount = text.split(/\r?\n/).length
    const baseToken = `[Pasted ${lineCount} lines]`
    if (pasteStore.get(baseToken) === text) {
        return baseToken
    }
    let token = baseToken
    if (pasteStore.has(token)) {
        token = `[Pasted ${lineCount} lines #${++pasteCounter}]`
    }
    pasteStore.set(token, text)
    return token
}

export function getPasteContent(token: string): string | undefined {
    return pasteStore.get(token)
}

export function expandPastes(text: string): string {
    if (!text) return ''
    return text.replace(/\[Pasted \d+ lines(?: #\d+)?\]/g, (match) => {
        return pasteStore.get(match) ?? match
    })
}
