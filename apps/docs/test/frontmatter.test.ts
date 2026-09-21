import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'bun:test'

interface ParsedFrontmatter {
    layout?: string
    title?: string
    description?: string
    currentSlug?: string
    [key: string]: string | undefined
}

describe('apps/docs MDX frontmatter & content validation', () => {
    const docsDir = join(__dirname, '../src/pages/docs')
    const mdxFiles = readdirSync(docsDir).filter((f) => f.endsWith('.mdx'))

    const parseMdxFile = (filename: string): { frontmatter: ParsedFrontmatter; body: string } => {
        const raw = readFileSync(join(docsDir, filename), 'utf-8')
        const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
        if (!match) {
            throw new Error(`File ${filename} does not contain valid frontmatter delimiters (---)`)
        }

        const frontmatterLines = match[1].split('\n')
        const frontmatter: ParsedFrontmatter = {}

        for (const line of frontmatterLines) {
            const colonIdx = line.indexOf(':')
            if (colonIdx === -1) continue
            const key = line.slice(0, colonIdx).trim()
            let val = line.slice(colonIdx + 1).trim()
            if (
                (val.startsWith("'") && val.endsWith("'")) ||
                (val.startsWith('"') && val.endsWith('"'))
            ) {
                val = val.slice(1, -1)
            }
            frontmatter[key] = val
        }

        return {
            frontmatter,
            body: match[2].trim(),
        }
    }

    it('finds documentation MDX files in docs directory', () => {
        expect(mdxFiles.length).toBeGreaterThanOrEqual(11)
        expect(mdxFiles).toContain('index.mdx')
        expect(mdxFiles).toContain('quickstart.mdx')
    })

    for (const file of mdxFiles) {
        describe(`file: ${file}`, () => {
            it('has valid frontmatter attributes', () => {
                const { frontmatter } = parseMdxFile(file)

                expect(frontmatter.layout).toBe('../../layouts/DocsLayout.astro')
                expect(frontmatter.title).toBeDefined()
                expect(frontmatter.title!.trim().length).toBeGreaterThan(3)

                expect(frontmatter.description).toBeDefined()
                expect(frontmatter.description!.trim().length).toBeGreaterThan(10)

                expect(frontmatter.currentSlug).toBeDefined()
                if (file === 'index.mdx') {
                    expect(frontmatter.currentSlug).toBe('')
                } else {
                    const expectedSlug = file.replace(/\.mdx$/, '')
                    expect(frontmatter.currentSlug).toBe(expectedSlug)
                }
            })

            it('has substantial body content with section headings', () => {
                const { body } = parseMdxFile(file)

                expect(body.length).toBeGreaterThan(100)
                // Docs pages should contain markdown headings (## or ###)
                expect(body).toMatch(/^##+ /m)
            })

            it('does not contain unresolved TODOs or placeholder lorem text', () => {
                const { body } = parseMdxFile(file)

                expect(body.toLowerCase()).not.toContain('lorem ipsum')
                expect(body.toLowerCase()).not.toContain('todo:')
                expect(body.toLowerCase()).not.toContain('fixme:')
            })
        })
    }
})
