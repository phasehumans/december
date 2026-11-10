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

            expect(html).toContain('december')
            expect(html).toContain('a (so much) better')
            expect(html).toContain('coding agent.')
            expect(html).toContain('npm install -g @trydecember/cli')
        })

        it('includes install command switch options for bash, powershell, and npm', () => {
            const html = getLandingHtml()

            expect(html).toContain('data-pm="npm"')
            expect(html).toContain('data-pm="bash"')
            expect(html).toContain('data-pm="powershell"')
            expect(html).not.toContain('data-pm="bun"')
        })

        it('includes instant authenticated redirect check for logged-in sessions', () => {
            const html = getLandingHtml()

            expect(html).toContain('december_logged_in=1')
            expect(html).toContain('window.location.replace')
        })

        it('renders full footer with legal and contact links', () => {
            const html = getLandingHtml()
            const footerHtml = html.slice(html.indexOf('<footer'))

            expect(footerHtml).toContain('built by')
            expect(footerHtml).toContain('href="/me"')
            expect(footerHtml).toContain('@chaitanya')
            expect(footerHtml).toMatch(
                /<a[^>]*href="\/me"[^>]*target="_blank"[^>]*>@chaitanya<\/a>/
            )
            expect(footerHtml).toContain('href="/privacy"')
            expect(footerHtml).toMatch(
                /<a[^>]*href="\/privacy"[^>]*target="_blank"[^>]*>privacy<\/a>/
            )
            expect(footerHtml).toContain('href="/terms"')
            expect(footerHtml).toMatch(/<a[^>]*href="\/terms"[^>]*target="_blank"[^>]*>terms<\/a>/)
            expect(footerHtml).toContain('href="/docs/changelog"')
            expect(footerHtml).toMatch(
                /<a[^>]*href="\/docs\/changelog"[^>]*target="_blank"[^>]*>changelog<\/a>/
            )
            expect(footerHtml).toContain('mailto:team@trydecember.com')
            expect(footerHtml).toContain('https://github.com/phasehumans')
            expect(footerHtml).toContain('https://x.com/phasehumans')
            expect(footerHtml).not.toContain('https://www.linkedin.com/in/phasehumans/')
            expect(footerHtml).not.toContain('https://github.com/phasehumans/december')
            expect(footerHtml).not.toContain('https://www.npmjs.com/package/@trydecember/cli')
            expect(footerHtml).not.toContain('https://www.youtube.com/@phasehumans')
            expect(html).not.toContain('id="faq-copy-btn"')
            expect(html).toContain('faq-toggle')
            expect(html).toContain('faq-content hidden')
            expect(html).not.toContain('or bun / pnpm')
            expect(html).not.toContain('id="back-to-top-btn"')
        })

        it('renders hero video player with privacy-enhanced YouTube embed', () => {
            const html = getLandingHtml()

            expect(html).toContain('id="hero-media-placeholder"')
            expect(html).toContain('https://www.youtube-nocookie.com/embed/n1gXOdLLTz4')
            expect(html).toContain('title="December Demo Video"')
        })

        it('renders environments card and cloud nudge auth links to /login', () => {
            const html = getLandingHtml()

            expect(html).toContain('Start December in Web')
            expect(html).toContain('Get started')
            expect(html).toContain('/login')
            expect(html).toContain('7000')
            expect(html).toContain('0.40')
            expect(html).toContain('december_cloud_nudge_dismissed')
            expect(html).toContain('TTL_MS')
            expect(html).toContain('isDesktop')
            expect(html).toContain('hidden sm:block fixed')
            expect(html).toContain('connect external developer tools or APIs via MCP')
        })

        it('renders mobile github icon in header without x icon and single-line mobile footer with built-by and docs/blog', () => {
            const html = getLandingHtml()
            const headerHtml = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
            const footerHtml = html.slice(html.indexOf('<footer'))

            // Header mobile icons: GitHub only (no X icon on mobile)
            expect(headerHtml).not.toContain('https://x.com/phasehumans')
            expect(headerHtml).toContain('https://github.com/phasehumans/december')
            expect(headerHtml).toContain('aria-label="GitHub Repository"')

            // Mobile Footer: single line with built by on left and docs & blog on right
            const mobileFooterHtml = footerHtml.slice(
                footerHtml.indexOf('Mobile View'),
                footerHtml.indexOf('Desktop View')
            )
            expect(mobileFooterHtml).toContain('built by')
            expect(mobileFooterHtml).toContain('@chaitanya')
            expect(mobileFooterHtml).toContain('href="/docs"')
            expect(mobileFooterHtml).toContain('href="/blog"')
            expect(mobileFooterHtml.indexOf('@chaitanya')).toBeLessThan(
                mobileFooterHtml.indexOf('href="/docs"')
            )
            expect(mobileFooterHtml.indexOf('href="/docs"')).toBeLessThan(
                mobileFooterHtml.indexOf('href="/blog"')
            )
        })

        it('renders non-sticky navbar without divider line, mobile hidden sign-in, and Try December Cloud button', () => {
            const html = getLandingHtml()
            const headerHtml = html.slice(html.indexOf('<header'), html.indexOf('</header>'))

            expect(headerHtml).not.toContain('sticky top-0')
            expect(headerHtml).toContain('relative')
            expect(headerHtml).not.toContain('border-b')
            expect(headerHtml).toContain('hidden sm:inline-flex')
            expect(headerHtml).toContain('Sign in')
            expect(html).toContain('sticky top-14')
            expect(html).toContain('Try December Cloud')
            expect(html).toContain('Try in Web')
            expect(html).not.toContain('Try in Cloud Sandbox')
            expect(html).not.toContain('Launch Cloud Sandbox')
            expect(html).not.toContain('or install CLI on your workstation')
            expect(html).toContain('Start building with December')
            expect(html).toContain('id="bottom-install-cli-btn"')
            expect(html).not.toContain('bottom-copy-tooltip')
            expect(html).not.toContain('Zero Source Retention')
        })

        it('renders gutter telemetry indicators across landing page sections', () => {
            const html = getLandingHtml()

            expect(html).toContain('DEC ENGINE')
            expect(html).toContain('AUTONOMOUS RUNTIME')
            expect(html).toContain('SPEC: ARCH 01')
            expect(html).toContain('DUAL-ENGINE CORE')
            expect(html).toContain('METRICS: BENCHMARKS')
            expect(html).toContain('SWE-BENCH VERIFIED')
            expect(html).toContain('RUNTIMES: MULTI-HOST')
            expect(html).toContain('PROTOCOL: TRUST')
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
            { slug: 'worktrees', title: 'Git Worktrees' },
            { slug: 'artifacts', title: 'Session Artifacts' },
            { slug: 'previews', title: 'Live Sandboxed Previews' },
            { slug: 'slash-commands', title: 'Slash Commands' },
            { slug: 'memory', title: 'Workspace Memory' },
            { slug: 'prompting', title: 'Prompting Guide' },
            { slug: 'mcp', title: 'Model Context Protocol' },
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
            expect(html).toContain('team@trydecember.com')
            expect(html).toContain('href="/terms"')
        })

        it('terms page renders terms sections and contact information', () => {
            const html = readFileSync(join(distDir, 'terms/index.html'), 'utf-8')

            expect(html).toContain('Terms of Service')
            expect(html).toContain('team@trydecember.com')
            expect(html).toContain('href="/privacy"')
        })
    })

    describe('portfolio page (me/index.html)', () => {
        it('renders minimal centered 2-line portfolio without header or footer', () => {
            const html = readFileSync(join(distDir, 'me/index.html'), 'utf-8')

            expect(html).toContain('Chaitanya Sonawane')
            expect(html).toContain('software engineer')
            expect(html).toContain('@december')
            expect(html).toContain('https://github.com/phasehumans')
            expect(html).toContain('https://www.youtube.com/@phasehumans')
            expect(html).toContain('https://x.com/phasehumans')
            expect(html).toContain('https://www.linkedin.com/in/phasehumans/')
            expect(html).not.toContain('href="https://www.npmjs.com/~phasehumans"')
            expect(html).toContain('https://codeforces.com/profile/phasehumans')
            expect(html).not.toContain('href="/blog"')
            expect(html).toContain('mailto:chetan@trydecember.com')
            // Minimal: Header and footer should be hidden
            expect(html).not.toContain('<footer')
        })
    })
})
