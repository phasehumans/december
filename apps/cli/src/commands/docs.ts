export function resolveDocsSectionPath(section?: string): string {
    if (!section) return ''
    const clean = section.replace(/^\/+/, '').toLowerCase().trim()
    const map: Record<string, string> = {
        intro: '',
        introduction: '',
        overview: '',
        quickstart: '/quickstart',
        'quick-start': '/quickstart',
        start: '/quickstart',
        guide: '/quickstart',
        arch: '/architecture',
        architecture: '/architecture',
        cli: '/cli',
        commands: '/cli',
        terminal: '/cli',
        privacy: '/privacy',
        terms: '/terms',
        changelog: '/changelog/',
    }
    return map[clean] !== undefined ? map[clean] : `/${clean}`
}

export async function handleChangelogCommand(): Promise<void> {
    const baseUrl = (process.env.WEB_URL || 'https://trydecember.com').replace(/\/$/, '')
    const targetUrl = `${baseUrl}/docs/changelog/`

    console.log('Opening December changelog in your default browser...')
    console.log(`\x1b[38;2;135;178;244m${targetUrl}\x1b[0m`)

    try {
        const { openUrl } = await import('../utils/open')
        await openUrl(targetUrl)
    } catch {
        // Intentionally swallowed: fallback URL is printed above for headless environments
    }
}

export async function handleDocsCommand(options?: { section?: string }): Promise<void> {
    const rawSection = options?.section?.toLowerCase().trim()
    const sectionPath = resolveDocsSectionPath(rawSection)
    const baseUrl = (process.env.WEB_URL || 'https://trydecember.com').replace(/\/$/, '')
    const targetUrl = `${baseUrl}/docs${sectionPath}`

    console.log('Opening December documentation in your default browser...')
    console.log(`\x1b[38;2;135;178;244m${targetUrl}\x1b[0m`)

    try {
        const { openUrl } = await import('../utils/open')
        await openUrl(targetUrl)
    } catch {
        // Intentionally swallowed: fallback URL is printed above for headless environments
    }
}
