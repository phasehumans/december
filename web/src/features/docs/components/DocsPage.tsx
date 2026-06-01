import { ChevronLeft } from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'

import { Skeleton } from '@/shared/components/ui/Skeleton'

interface DocsPageProps {
    onBack: () => void
}

// Custom CDN-backed Mermaid component matching the elegant dark theme
interface MermaidProps {
    chart: string
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<boolean>(false)

    useEffect(() => {
        let isMounted = true

        const renderChart = async () => {
            try {
                if (!(window as any).mermaid) {
                    const script = document.createElement('script')
                    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
                    script.async = true
                    await new Promise((resolve, reject) => {
                        script.onload = resolve
                        script.onerror = reject
                        document.head.appendChild(script)
                    })
                }

                const mermaid = (window as any).mermaid
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    securityLevel: 'loose',
                    themeVariables: {
                        background: '#151413',
                        primaryColor: '#242322',
                        primaryTextColor: '#D6D5C9',
                        lineColor: '#383736',
                        secondaryColor: '#171615',
                        arrowheadColor: '#8F8E8D',
                    },
                })

                const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`
                const { svg: renderedSvg } = await mermaid.render(id, chart)

                if (isMounted) {
                    setSvg(renderedSvg)
                    setError(false)
                }
            } catch (err) {
                console.error('Mermaid render error:', err)
                if (isMounted) {
                    setError(true)
                }
            }
        }

        void renderChart()

        return () => {
            isMounted = false
        }
    }, [chart])

    if (error) {
        return (
            <div className="p-4 bg-[#1E1D1B] border border-[#2B2A29] rounded-xl text-center text-xs text-[#7B7A79] font-mono whitespace-pre overflow-x-auto my-4">
                {chart}
            </div>
        )
    }

    if (!svg) {
        return (
            <div className="h-44 w-full bg-[#1E1D1B]/50 border border-[#2B2A29]/50 rounded-xl flex items-center justify-center animate-pulse my-4">
                <span className="text-xs text-[#7B7A79] font-medium">
                    Generating visual diagram...
                </span>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="w-full flex justify-center bg-[#151413] border border-[#242322] rounded-xl p-5 my-5 overflow-x-auto select-none [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    )
}

const DocsSkeleton = () => (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
        <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-2/3 max-w-[360px] rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-[92%] rounded-md" />
        </div>
        <div className="flex flex-col gap-3 mt-4">
            <Skeleton className="h-7 w-1/2 max-w-[200px] rounded-lg" />
            <Skeleton className="h-4 w-[94%] rounded-md" />
            <Skeleton className="h-4 w-[85%] rounded-md" />
        </div>
    </div>
)

const DocsSidebarSkeleton = () => (
    <div className="flex flex-col gap-1.5 mt-2 animate-in fade-in duration-300 px-1">
        {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
    </div>
)

const Callout: React.FC<{
    type?: 'info' | 'tip' | 'warning' | 'alert'
    title: string
    children: React.ReactNode
}> = ({ type = 'info', title, children }) => {
    const styles = {
        info: 'bg-[#1E1D1B] border-[#2B2A29] text-[#A3A299]',
        tip: 'bg-[#1C1F1E] border-[#292D2C] text-[#9FB5A5]',
        warning: 'bg-[#221F1B] border-[#383025] text-[#D4AF8B]',
        alert: 'bg-[#221B1C] border-[#382527] text-[#D48B8E]',
    }

    return (
        <div className={`flex flex-col gap-1 p-4 rounded-xl border ${styles[type]} mt-4 mb-4`}>
            <div className="flex items-center gap-2 font-semibold text-[13.5px] text-white">
                {title}
            </div>
            <div className="text-[13px] leading-relaxed mt-1 font-medium">{children}</div>
        </div>
    )
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
    <div className="flex flex-col rounded-xl border border-[#242322] bg-[#0E0E0D] overflow-hidden mt-3 mb-3 font-mono">
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#171615] border-b border-[#242322]">
            <span className="text-[10px] text-[#7B7A79] uppercase font-bold tracking-wider">
                {language}
            </span>
        </div>
        <div className="p-4 overflow-x-auto">
            <pre className="text-[12px] text-[#D6D5C9] leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    </div>
)

export const DocsPage: React.FC<DocsPageProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('introduction')
    const [isInitialLoading, setIsInitialLoading] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialLoading(false)
        }, 200)
        return () => clearTimeout(timer)
    }, [])

    const subpages = [
        { id: 'introduction', label: 'Introduction' },
        { id: 'quickstart', label: 'Quick Start' },
        { id: 'architecture', label: 'Architecture' },
        { id: 'agent', label: 'Agent' },
        { id: 'canvas', label: 'Context Canvas' },
        { id: 'runtime', label: 'Runtime' },
        { id: 'deployments', label: 'Deployments' },
        { id: 'settings', label: 'Settings' },
        { id: 'security', label: 'Security' },
        { id: 'changelog', label: 'Changelog' },
        { id: 'privacy', label: 'Privacy Policy' },
        { id: 'terms', label: 'Terms of Service' },
    ]

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px]">
            <div className="flex w-full h-full bg-[#171615] rounded-lg border border-[#242323] overflow-hidden">
                {/* Flat Docs Sidebar */}
                <div className="w-[210px] md:w-[250px] shrink-0 border-r border-[#242323] flex flex-col py-4">
                    <div className="px-4 mb-5">
                        <button
                            onClick={onBack}
                            className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#1E1D1B] px-2.5 py-1 -ml-1 rounded-lg text-[13px] font-semibold transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Home
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-[2px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:rounded-full">
                        {isInitialLoading ? (
                            <DocsSidebarSkeleton />
                        ) : (
                            subpages.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors text-left border ${
                                        activeTab === item.id
                                            ? 'bg-[#1E1D1B] border-[#2B2A29] text-[#D6D5C9] shadow-sm font-semibold'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]/40 border-transparent'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#171615] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                    <div className="w-full max-w-[740px] mx-auto px-6 md:px-12 py-8 md:py-12 text-[#D6D5C9]">
                        {isInitialLoading ? (
                            <DocsSkeleton />
                        ) : activeTab === 'introduction' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight leading-tight">
                                        Introduction to December
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        December is a premium, visual-first development platform
                                        that empowers teams to prototype, design, and deploy
                                        full-stack applications instantly. Describe your app concept
                                        in plain language, construct layout blocks on a responsive
                                        visual canvas, and compile production-ready React +
                                        TypeScript code natively backed by Git version control.
                                    </p>
                                </div>

                                <Mermaid
                                    chart={`graph LR
                                        A[User Prompt] --> B[Dual-Engine Pipeline]
                                        B --> C[Visual Canvas]
                                        B --> D[React TypeScript Code]
                                        C --> E[Premium Sandbox Preview]
                                        D --> E`}
                                />

                                <div className="flex flex-col gap-3">
                                    <h2 className="text-[18px] font-medium text-white tracking-tight">
                                        Core Design Philosophy
                                    </h2>
                                    <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                        Traditional app builders are often black boxes, hiding code
                                        behind complex visual properties or rendering inflexible
                                        structures. December bridges visual manipulation and
                                        developer-first codebase integrity in real-time. Everything
                                        you draw on the Canvas generates readable components under
                                        absolute control.
                                    </p>
                                </div>

                                <Callout title="Premium Developer Sync" type="tip">
                                    Connect your repository in seconds. Every visual shift
                                    compile-merges straight to Git, keeping your local codebase,
                                    pull requests, and edge releases synchronized perfectly.
                                </Callout>
                            </div>
                        ) : activeTab === 'quickstart' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Quick Start Guide
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Launch your first fully collaborative full-stack web
                                        application in less than three minutes using our
                                        visual-first workflow.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-5 mt-2">
                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-sm">
                                            1
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white font-medium text-[15px]">
                                                Prompt and Initialize
                                            </h3>
                                            <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                                On the Home screen, input your core concept (e.g.,
                                                *"Create a real-time developer metrics dashboard"*).
                                                This instantiates a clean thread and compiles the
                                                initial visual component layers.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-sm">
                                            2
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white font-medium text-[15px]">
                                                Visually Edit and Refine
                                            </h3>
                                            <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                                Point and select any block to enter Visual Mode.
                                                Describe adjustments locally or drag canvas
                                                properties to instantly manipulate flexboxes,
                                                alignment, colors, or backend databases.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-sm">
                                            3
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white font-medium text-[15px]">
                                                Inspect and Verify
                                            </h3>
                                            <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                                Toggle between **Preview** to interact, **Code** to
                                                inspect clean React/TypeScript, and **Canvas** to
                                                manipulate structure, flexboxes, and assets.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-sm">
                                            4
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white font-medium text-[15px]">
                                                Publish to the Edge
                                            </h3>
                                            <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                                Click **Publish** in the editor header. Your project
                                                is automatically deployed on our globally optimized
                                                CDN under an instant custom `december.dev` domain.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'architecture' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Platform Architecture
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        December operates on an asynchronous dual-engine pipeline.
                                        Visual changes compile into an Abstract Syntax Tree (AST),
                                        generating clean code, while runtime sandboxes synchronize
                                        state instantly.
                                    </p>
                                </div>

                                <Mermaid
                                    chart={`graph TD
                                        A[Visual Web Client] -->|State / Prompts| B[REST / API Gateway]
                                        B -->|AST Changes| C[Code Agent Service]
                                        C -->|Surgical Diff| D[Isolated Vite Runtime]
                                        D -->|HMR Updates| A
                                        C -->|Git Commit| E[GitHub Repository]
                                        B -->|Publish| F[Edge CDN Platform]`}
                                />

                                <div className="flex flex-col gap-3">
                                    <h2 className="text-[18px] font-medium text-white tracking-tight">
                                        Key Architectural Highlights
                                    </h2>
                                    <ul className="list-disc pl-5 flex flex-col gap-2 text-[13.5px] text-[#A3A299]">
                                        <li>
                                            <strong className="text-white">
                                                Dual-Engine Compiler:
                                            </strong>{' '}
                                            Visually parsed node coordinates compile straight to
                                            React/JSX elements with styled-utility tokens.
                                        </li>
                                        <li>
                                            <strong className="text-white">
                                                Git Version Control:
                                            </strong>{' '}
                                            Commits, branches, and merges are managed
                                            programmatically via headless repository agents.
                                        </li>
                                        <li>
                                            <strong className="text-white">
                                                Isolated Sandbox:
                                            </strong>{' '}
                                            Individual app frames execute on virtual local runtimes
                                            using fast Bun-backed services.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : activeTab === 'agent' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        AI Code Agent
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        The December Agent is a specialized self-healing system
                                        designed to generate complete files, apply precise AST
                                        surgical diffs, and dynamically repair build issues.
                                    </p>
                                </div>

                                <Mermaid
                                    chart={`graph TD
                                        A[Receive Prompt / Change] --> B[Generate Component Diffs]
                                        B --> C[Verify Bun Compilation]
                                        C -->|Errors Found| D[Auto-Fix Compiler Error]
                                        C -->|Clean Build| E[Run Headless E2E Tests]
                                        E -->|Console Errors| D
                                        E -->|Success| F[Synchronize Canvas State]
                                        D --> B`}
                                />

                                <div className="flex flex-col gap-3">
                                    <h2 className="text-[18px] font-medium text-white tracking-tight">
                                        Self-Healing Loop
                                    </h2>
                                    <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                        Every compile process runs verification pipelines. If a
                                        component introduces standard TypeScript warnings or
                                        rendering faults, our headless agent captures logs
                                        immediately, reasons through dependencies, and automatically
                                        executes repair patches before showing you the preview.
                                    </p>
                                </div>
                            </div>
                        ) : activeTab === 'canvas' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Context Canvas
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Our visual layout canvas allows you to manipulate
                                        structures, assets, and component trees through direct
                                        selection bounds and flexbox properties.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Visual Node Tree
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            Every bounding box represents a JSX tag. December maps
                                            absolute and relative flexbox grids onto coordinate
                                            spaces, resolving nesting, margins, and borders into
                                            standard layout tokens.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Tactile Asset Binding
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            Upload pictures, embed media, or clip online content
                                            straight onto your canvas. December assigns each element
                                            a secure temporary key, scaling images reactively to fit
                                            layout components perfectly.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'runtime' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Isolated Runtime
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        A look under the hood at December's secure, lightning-fast
                                        compilation sandboxes.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                        Each workspace instance is running inside an isolated local
                                        container. We compile React 18 and strict TypeScript using
                                        custom, high-speed Vite bundlers.
                                    </p>
                                    <table className="w-full text-left text-[13px] text-[#A3A299] border-collapse mt-1">
                                        <thead>
                                            <tr className="border-b border-[#242322] text-white">
                                                <th className="py-2 font-medium">Metric</th>
                                                <th className="py-2 font-medium">Technology</th>
                                                <th className="py-2 font-medium">
                                                    Performance Goal
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-[#242322]/40">
                                                <td className="py-3 text-[#D6D5C9] font-medium">
                                                    Hot Reload
                                                </td>
                                                <td className="py-3 text-white">Vite HMR</td>
                                                <td className="py-3">&lt; 150ms state updates</td>
                                            </tr>
                                            <tr className="border-b border-[#242322]/40">
                                                <td className="py-3 text-[#D6D5C9] font-medium">
                                                    Server Execution
                                                </td>
                                                <td className="py-3 text-white">
                                                    Bun / Rust runtime
                                                </td>
                                                <td className="py-3">&lt; 3.0s total cold start</td>
                                            </tr>
                                            <tr className="border-b border-[#242322]/40">
                                                <td className="py-3 text-[#D6D5C9] font-medium">
                                                    Database ORM
                                                </td>
                                                <td className="py-3 text-white">
                                                    Prisma DB adapter
                                                </td>
                                                <td className="py-3">
                                                    &lt; 50ms schema migrations
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : activeTab === 'deployments' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Deployments & Domains
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Deploy production-ready projects globally on our fast edge
                                        content delivery network in single-click actions.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Edge Deployments
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            When you click **Publish**, December builds an optimized
                                            static bundle, deploys database assets, and provisions
                                            routing tables. Your projects load globally under
                                            sub-second latency from regional centers.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Custom Domains
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            Workspace settings support pointing projects to personal
                                            domains (e.g. `yourname.com`). We provision automatic
                                            SSL certificates, handling DNS verification, caching,
                                            and regional edge load-balancing.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'settings' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Account Settings
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Manage your account, customize UI parameters, choose sounds,
                                        and monitor available credits.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Notification Sound Preferences
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            Adjust generation sound parameters inside
                                            **Preferences**. By default, our snappy, high-fidelity
                                            arpeggiated synth bell chime plays upon successful
                                            visual compilations. This can be configured to play
                                            *Always*, *First Generation Only*, or *Never*.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Billing and Credit Balance
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            Free tiers grant $1.00 base credit limit. Upgrade to
                                            **Pro** to receive $5.00 monthly refreshes. If you have
                                            a gift card, coupon, or promotional code, click **Claim
                                            Credits** on the Billing tab to increase your balance
                                            instantly.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'security' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Security & Data Privacy
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        How we isolate, encrypt, and secure codebases, databases,
                                        and visual workspaces.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Zero Training Data Leakage
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            At December, we partition workspaces. Your custom code,
                                            assets, prompts, and database parameters are completely
                                            isolated. **We never train** LLMs or generative
                                            algorithms on your private inputs or database data.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-white font-medium text-[15px]">
                                            Compliance Standard Alignments
                                        </h3>
                                        <p className="text-[13.5px] text-[#A3A299] leading-relaxed">
                                            Our systems align with strict SOC 2 Type II and ISO
                                            27001 boundaries. We enforce encrypted tables, automated
                                            regular backups, regional data storage centers, and
                                            secure access audits.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'changelog' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Product Changelog
                                    </h1>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Follow along with recent product improvements, arpeggiated
                                        sound upgrades, and secure coupon systems.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-3 border-l border-[#242323] pl-4">
                                    <div className="flex flex-col gap-1 relative">
                                        <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#D6D5C9]" />
                                        <span className="text-[11px] font-mono text-[#7B7A79] font-bold">
                                            JUNE 2026
                                        </span>
                                        <h4 className="text-white font-semibold text-[14px]">
                                            Chime Audio Engines & Premium Web Clipper Modal
                                        </h4>
                                        <p className="text-[13px] text-[#A3A299] leading-relaxed">
                                            - Replaced simple beep tone with high-fidelity C-major
                                            arpeggiated bell chime.
                                            <br />
                                            - Refactored canvas toolbar popover into full-screen
                                            premium visual modal.
                                            <br />- Added 60-90 second capturing warnings during
                                            visual clipping phases.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-1 relative mt-4">
                                        <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#383736]" />
                                        <span className="text-[11px] font-mono text-[#7B7A79] font-bold">
                                            MAY 2026
                                        </span>
                                        <h4 className="text-white font-semibold text-[14px]">
                                            Secure Offline CLI Code Redemption
                                        </h4>
                                        <p className="text-[13px] text-[#A3A299] leading-relaxed">
                                            - Implemented SHA-256 hashed transaction-bound credit
                                            redeem endpoints.
                                            <br />
                                            - Added standalone secure CLI code generation scripts
                                            exporting to local CSVs.
                                            <br />- Introduced rate limiters to secure the code
                                            redemptions.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'privacy' ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Privacy Policy
                                    </h1>
                                    <p className="text-[11px] text-[#7B7A79] font-mono">
                                        Last Updated: June 1, 2026
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 text-[13.5px] text-[#A3A299] leading-relaxed">
                                    <p>
                                        This Privacy Policy outlines how December collects, secures,
                                        and handles information across our visual development
                                        interfaces, local workspaces, and server API pipelines.
                                    </p>
                                    <div>
                                        <h4 className="text-white font-medium mb-1">
                                            1. Information Collection
                                        </h4>
                                        <p>
                                            We collect email credentials, Git authorization
                                            parameters, prompt history, and visual state
                                            modifications solely to provision sandboxes, build code,
                                            and manage regional deployments.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-medium mb-1">
                                            2. Data Security & Storage
                                        </h4>
                                        <p>
                                            Code outputs, variables, and database assets are
                                            encrypted in transit and at rest. Multi-tenant
                                            partitioning ensures complete data isolation. We retain
                                            your data only as long as you maintain an active
                                            workspace account.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-medium mb-1">
                                            3. Your Data Rights
                                        </h4>
                                        <p>
                                            You retain full ownership of all compiled code, assets,
                                            and database schemas. You can export complete project
                                            folders or request a total, permanent purge of your
                                            workspace data at any time.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-[28px] font-semibold text-white tracking-tight">
                                        Terms of Service
                                    </h1>
                                    <p className="text-[11px] text-[#7B7A79] font-mono">
                                        Last Updated: June 1, 2026
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 text-[13.5px] text-[#A3A299] leading-relaxed">
                                    <p>
                                        Please read these Terms of Service carefully before
                                        utilizing December's visual editor, API endpoints, or edge
                                        deployment platforms.
                                    </p>
                                    <div>
                                        <h4 className="text-white font-medium mb-1">
                                            1. Account & Use Quotas
                                        </h4>
                                        <p>
                                            You must maintain secure authentication details. You are
                                            responsible for all workspace transactions, prompt
                                            requests, database executions, and credit usage events
                                            under your session.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-medium mb-1">
                                            2. Credits & Billing Terms
                                        </h4>
                                        <p>
                                            Subscription plans are billed monthly. Standard credits
                                            do not carry over across monthly cycles. Gifted credit
                                            balance claimed via promotional coupons is bound to the
                                            specific user account and cannot be refunded or
                                            transferred.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-medium mb-1">
                                            3. Limitations & Liabilities
                                        </h4>
                                        <p>
                                            December builds applications based on dynamic prompt
                                            reasoning. While our Code Agent runs self-healing tests,
                                            you remain responsible for final code review and
                                            compliance verification before final deployment.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
