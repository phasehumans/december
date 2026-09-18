import path from 'node:path'

/**
 * Format a string with an OSC 8 terminal hyperlink sequence.
 * In modern terminals (Ghostty, iTerm2, Kitty, Alacritty, WezTerm, VS Code),
 * this makes the text clickable while displaying only the clean label.
 */
export function terminalLink(text: string, uri: string): string {
    if (!uri) return text
    return `\x1b]8;;${uri}\x1b\\${text}\x1b]8;;\x1b\\`
}

/**
 * Format a file path with an OSC 8 file:// hyperlink, optionally linking to a specific line.
 */
export function fileLink(
    displayPath: string,
    targetPath: string,
    line?: number,
    col?: number
): string {
    if (!targetPath) return displayPath
    const absPath = path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(process.cwd(), targetPath)

    const lineFragment = line ? `#L${line}${col ? `:${col}` : ''}` : ''
    const uri = `file://${absPath}${lineFragment}`
    return terminalLink(displayPath, uri)
}

/**
 * Converts an absolute or messy path to a clean relative path from cwd.
 * If the path is outside cwd or invalid, returns the original path.
 */
export function toRelativePath(filePath: string, cwd: string = process.cwd()): string {
    if (!filePath) return ''
    const trimmed = filePath.trim()
    if (!path.isAbsolute(trimmed)) return trimmed
    const rel = path.relative(cwd, trimmed)
    if (!rel || rel.startsWith('..')) {
        return trimmed
    }
    return rel
}
