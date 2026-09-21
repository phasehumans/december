import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'bun:test'

interface DocItem {
    slug: string
    label: string
    desc: string
}

interface DocCategory {
    category: string
    items: DocItem[]
}

describe('apps/docs navigation & content structure', () => {
    const docsDir = join(__dirname, '../src/pages/docs')
    const layoutPath = join(__dirname, '../src/layouts/DocsLayout.astro')

    const getDocCategories = (): DocCategory[] => {
        const content = readFileSync(layoutPath, 'utf-8')
        const match = content.match(/const docCategories = (\[[\s\S]*?\]);\n/)
        if (!match) {
            throw new Error('Could not find docCategories in DocsLayout.astro')
        }
        return eval(`(${match[1]})`) as DocCategory[]
    }

    it('defines non-empty doc categories with valid schema', () => {
        const categories = getDocCategories()
        expect(categories.length).toBeGreaterThanOrEqual(4)

        for (const cat of categories) {
            expect(cat.category).toBeDefined()
            expect(cat.category.trim().length).toBeGreaterThan(0)
            expect(Array.isArray(cat.items)).toBe(true)
            expect(cat.items.length).toBeGreaterThan(0)

            for (const item of cat.items) {
                expect(typeof item.slug).toBe('string')
                expect(item.slug.trim().length).toBeGreaterThan(0)
                expect(typeof item.label).toBe('string')
                expect(item.label.trim().length).toBeGreaterThan(0)
                expect(typeof item.desc).toBe('string')
                expect(item.desc.trim().length).toBeGreaterThan(0)
            }
        }
    })

    it('has unique slugs across all categories', () => {
        const categories = getDocCategories()
        const slugs = categories.flatMap((c) => c.items.map((i) => i.slug))
        const uniqueSlugs = new Set(slugs)
        expect(slugs.length).toBe(uniqueSlugs.size)
    })

    it('ensures every category item slug maps to an existing .mdx file', () => {
        const categories = getDocCategories()
        const slugs = categories.flatMap((c) => c.items.map((i) => i.slug))

        for (const slug of slugs) {
            const filePath = join(docsDir, `${slug}.mdx`)
            expect(existsSync(filePath)).toBe(true)
        }
    })

    it('ensures every .mdx file in src/pages/docs (except index.mdx) is registered in docCategories', () => {
        const categories = getDocCategories()
        const registeredSlugs = new Set(categories.flatMap((c) => c.items.map((i) => i.slug)))

        const allMdxFiles = readdirSync(docsDir).filter(
            (f) => f.endsWith('.mdx') && f !== 'index.mdx'
        )

        for (const file of allMdxFiles) {
            const slug = file.replace(/\.mdx$/, '')
            expect(registeredSlugs.has(slug)).toBe(true)
        }
    })

    it('verifies index.mdx exists as docs home entry point', () => {
        expect(existsSync(join(docsDir, 'index.mdx'))).toBe(true)
    })
})
