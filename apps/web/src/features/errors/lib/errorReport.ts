/** the text "Copy error" puts on the clipboard, so a user can paste it into a bug report */
export const getErrorReport = (error: unknown, componentStack?: string | null): string => {
    const lines: string[] = []
    if (error instanceof Error) {
        lines.push(error.stack || `${error.name}: ${error.message}`)
    } else {
        lines.push(String(error))
    }
    if (componentStack) lines.push(`Component stack:${componentStack}`)
    lines.push(`Page: ${window.location.pathname}`)
    lines.push(`Time: ${new Date().toISOString()}`)
    lines.push(`Browser: ${navigator.userAgent}`)
    return lines.join('\n\n')
}

/** copies the text; returns false when the browser refuses */
export const copyText = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch (err) {
        console.warn('Could not copy the error report', err)
        return false
    }
}
