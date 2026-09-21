import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { beforeAll, describe, expect, it } from 'bun:test'

describe('apps/docs page content & layout tests', () => {
    const distDir = join(__dirname, '../dist')

    beforeAll(() => {
        if (!existsSync(distDir) || !existsSync(join(distDir, 'index.html'))) {
            execSync('bun run build', { cwd: join(__dirname, '..'), stdio: 'pipe' })
        }
    })

    describe('landing page (index.html)', () => {
        const getLandingHtml = () => readFileSync(join(distDir, 'index.html'), 'utf-8')

        it('renders hero title, description, and install command', () => {
            const html = getLandingHtml()

            expect(html).toContain('december, a coding agent')
            expect(html).toContain('for terminal and cloud')
            expect(html).toContain('npm install -g @trydecember/cli')
        })

        it('includes package manager switch options for npm, bun, and pnpm', () => {
            const html = getLandingHtml()

            expect(html).toContain('data-pm="npm"')
            expect(html).toContain('data-pm="bun"')
            expect(html).toContain('data-pm="pnpm"')
        })

        it('includes instant authenticated redirect check for logged-in sessions', () => {
            const html = getLandingHtml()

            expect(html).toContain('december_logged_in=1')
            expect(html).toContain('window.location.replace')
        })

        it('renders full footer with legal and social links', () => {
            const html = getLandingHtml()

            expect(html).toContain('href="/privacy"')
            expect(html).toContain('href="/terms"')
            expect(html).toContain('https://github.com/phasehumans/december/blob/main/CHANGELOG.md')
            expect(html).toContain('changelog')
            expect(html).toContain('https://github.com/phasehumans/december')
            expect(html).toContain('https://www.npmjs.com/package/@trydecember/cli')
            expect(html).toContain('https://x.com/phasehumans')
            expect(html).toContain('https://www.youtube.com/@phasehumans')
            expect(html).toContain('id="back-to-top-btn"')
        })
    })

    describe('docs overview page (docs/index.html)', () => {
        const getDocsIndexHtml = () => readFileSync(join(distDir, 'docs/index.html'), 'utf-8')

        it('renders breadcrumbs showing home and docs root', () => {
            const html = getDocsIndexHtml()

            expect(html).toContain('href="/"')
            expect(html).toContain('[docs]')
        })

        it('renders documentation directory grid linking to all sections', () => {
            const html = getDocsIndexHtml()

            expect(html).toContain('Documentation Directory')
            expect(html).toContain('href="/docs/quickstart"')
            expect(html).toContain('href="/docs/architecture"')
            expect(html).toContain('href="/docs/agent-loop"')
            expect(html).toContain('href="/docs/checkpoints"')
            expect(html).toContain('href="/docs/previews"')
            expect(html).toContain('href="/docs/cli"')
            expect(html).toContain('href="/docs/slash-commands"')
            expect(html).toContain('href="/docs/prompting"')
            expect(html).toContain('href="/docs/integrations"')
            expect(html).toContain('href="/docs/security"')
        })
    })

    describe('docs subpages (e.g. quickstart, architecture, cli)', () => {
        const subpages = [
            { slug: 'quickstart', title: 'Getting Started' },
            { slug: 'architecture', title: 'System Architecture' },
            { slug: 'cli', title: 'CLI Reference' },
            { slug: 'agent-loop', title: 'Agent Reasoning Loop' },
            { slug: 'checkpoints', title: 'Git Checkpoints' },
            { slug: 'previews', title: 'Live Sandboxed Previews' },
            { slug: 'slash-commands', title: 'Slash Commands' },
            { slug: 'prompting', title: 'Prompting Guide' },
            { slug: 'integrations', title: 'Model Providers' },
            { slug: 'security', title: 'Security &amp; Isolation' },
        ]

        for (const { slug, title } of subpages) {
            it(`subpage ${slug} renders breadcrumbs, title, and linear navigation`, () => {
                const html = readFileSync(join(distDir, `docs/${slug}/index.html`), 'utf-8')

                // Breadcrumbs
                expect(html).toContain('href="/docs"')
                expect(html).toContain(slug)

                // Title
                expect(html).toContain(title)

                // Linear Prev / Next navigation container
                expect(html).toContain('mt-14 flex flex-col sm:flex-row items-center')

                // Code block copy button / script inclusion
                expect(html).toContain('code-copy-btn')
            })
        }
    })

    describe('legal pages (privacy & terms)', () => {
        it('privacy page renders policy sections and security contact', () => {
            const html = readFileSync(join(distDir, 'privacy/index.html'), 'utf-8')

            expect(html).toContain('Privacy Policy')
            expect(html).toContain('security@trydecember.com')
            expect(html).toContain('team@trydecember.com')
            expect(html).toContain('href="/terms"')
            expect(html).toContain('href="/docs/security"')
        })

        it('terms page renders terms sections and contact information', () => {
            const html = readFileSync(join(distDir, 'terms/index.html'), 'utf-8')

            expect(html).toContain('Terms of Service')
            expect(html).toContain('team@trydecember.com')
            expect(html).toContain('href="/privacy"')
            expect(html).toContain('href="/docs/security"')
        })
    })
})
