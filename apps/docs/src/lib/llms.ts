// Builds llms.txt and llms-full.txt (https://llmstxt.org/) from the docs and blog sources at build time.
import { docCategories } from './docs-nav'

const SITE = 'https://trydecember.com'

interface PageFrontmatter {
    title: string
    description?: string
    currentSlug?: string
}

interface SourcePage {
    title: string
    description: string
    url: string
    body: string
}

const docModules = import.meta.glob<{ frontmatter: PageFrontmatter }>('../pages/docs/*.mdx', {
    eager: true,
})
const docSources = import.meta.glob<string>('../pages/docs/*.mdx', {
    eager: true,
    query: '?raw',
    import: 'default',
})
const blogModules = import.meta.glob<{ frontmatter: PageFrontmatter }>('../pages/blog/*.mdx', {
    eager: true,
})
const blogSources = import.meta.glob<string>('../pages/blog/*.mdx', {
    eager: true,
    query: '?raw',
    import: 'default',
})

const HTML_BLOCK_OPEN = /<(div|section|figure|aside|svg|table)\b/g
const HTML_BLOCK_CLOSE = /<\/(div|section|figure|aside|svg|table)>/g

/** Turn an MDX source into plain markdown: drop frontmatter, imports, and HTML blocks such as diagrams. */
export function mdxToMarkdown(source: string): string {
    const withoutFrontmatter = source.replace(/^---\n[\s\S]*?\n---\n/, '')
    const out: string[] = []
    let inFence = false
    let htmlDepth = 0

    for (const line of withoutFrontmatter.split('\n')) {
        if (line.trimStart().startsWith('```')) inFence = !inFence
        if (inFence || line.trimStart().startsWith('```')) {
            if (htmlDepth === 0) out.push(line)
            continue
        }
        const opens = (line.match(HTML_BLOCK_OPEN) ?? []).length
        const closes = (line.match(HTML_BLOCK_CLOSE) ?? []).length
        if (htmlDepth > 0 || (opens > 0 && line.trimStart().startsWith('<'))) {
            htmlDepth = Math.max(0, htmlDepth + opens - closes)
            continue
        }
        if (/^(import|export)\s/.test(line)) continue
        out.push(line)
    }

    return out
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function slugFromPath(filePath: string): string {
    return filePath
        .split('/')
        .pop()!
        .replace(/\.mdx$/, '')
}

function loadDocs(): SourcePage[] {
    const bySlug = new Map<string, SourcePage>()
    for (const [filePath, mod] of Object.entries(docModules)) {
        const slug = slugFromPath(filePath)
        bySlug.set(slug, {
            title: mod.frontmatter.title,
            description: mod.frontmatter.description ?? '',
            url: slug === 'index' ? `${SITE}/docs` : `${SITE}/docs/${slug}`,
            body: mdxToMarkdown(docSources[filePath] ?? ''),
        })
    }

    const ordered: SourcePage[] = []
    const intro = bySlug.get('index')
    if (intro) ordered.push(intro)
    for (const item of docCategories.flatMap((c) => c.items)) {
        const page = bySlug.get(item.slug)
        if (page) ordered.push(page)
        bySlug.delete(item.slug)
    }
    bySlug.delete('index')
    // Any page missing from the nav still gets listed, at the end
    ordered.push(...bySlug.values())
    return ordered
}

function loadBlog(): SourcePage[] {
    return Object.entries(blogModules).map(([filePath, mod]) => ({
        title: mod.frontmatter.title,
        description: mod.frontmatter.description ?? '',
        url: `${SITE}/blog/${slugFromPath(filePath)}`,
        body: mdxToMarkdown(blogSources[filePath] ?? ''),
    }))
}

const SUMMARY =
    'December is an open-source coding agent. It reads your code, writes changes, and runs commands in your terminal or in December Cloud. It works with any model: link a plan you already pay for (Claude, ChatGPT, GitHub Copilot, Gemini), sign in with December, or use your own API keys.'

export function buildLlmsTxt(): string {
    const docs = loadDocs()
    const blog = loadBlog()
    const lines = [
        '# December',
        '',
        `> ${SUMMARY}`,
        '',
        'Install: `npm install -g @trydecember/cli`, then run `december` in your project folder.',
        '',
        '## Docs',
        '',
        ...docs.map((p) => `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ''}`),
        '',
        '## Blog',
        '',
        ...blog.map((p) => `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ''}`),
        '',
        '## Optional',
        '',
        `- [Changelog](${SITE}/docs/changelog): Release history.`,
        `- [Full docs in one file](${SITE}/llms-full.txt)`,
        `- [Source code](https://github.com/phasehumans/december)`,
        '',
    ]
    return lines.join('\n')
}

export function buildLlmsFullTxt(): string {
    const sections = loadDocs().map((p) => `# ${p.title}\n\nSource: ${p.url}\n\n${p.body}`)
    return [`# December documentation\n\n> ${SUMMARY}`, ...sections].join('\n\n---\n\n') + '\n'
}
