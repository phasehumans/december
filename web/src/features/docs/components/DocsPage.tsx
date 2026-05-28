import {
    ChevronLeft,
    Rocket,
    BookOpen,
    Terminal,
    Users,
    Shield,
    CreditCard,
    Layout,
    Code,
    Cpu,
    GitBranch,
    Globe,
    Settings,
    HelpCircle,
    Info,
    CheckCircle,
    AlertTriangle,
    ShieldAlert,
    Key,
    Layers,
    Sparkles,
    Database,
    Palette,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { Skeleton } from '@/shared/components/ui/Skeleton'

interface DocsPageProps {
    onBack: () => void
}

const DocsSkeleton = () => (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-300">
        <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-3/4 max-w-[400px] rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-[90%] rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
        <div className="flex flex-col gap-4 mt-6">
            <Skeleton className="h-8 w-1/2 max-w-[250px] rounded-lg" />
            <Skeleton className="h-4 w-[95%] rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-[85%] rounded-md" />
            <Skeleton className="h-4 w-[80%] rounded-md" />
        </div>
    </div>
)

const DocsSidebarSkeleton = () => (
    <div className="flex flex-col gap-2 mt-4 animate-in fade-in duration-300">
        <Skeleton className="h-3 w-24 ml-3 rounded-md mb-1 mt-2" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
        <Skeleton className="h-3 w-32 ml-3 rounded-md mb-1 mt-4" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
    </div>
)

const Callout: React.FC<{
    type?: 'info' | 'tip' | 'warning' | 'alert'
    title: string
    children: React.ReactNode
}> = ({ type = 'info', title, children }) => {
    const styles = {
        info: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
        tip: 'bg-[#1E1D1B] border-[#383736] text-[#A3A299]',
        warning: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400',
        alert: 'bg-red-500/5 border-red-500/20 text-red-400',
    }

    const icons = {
        info: <Info className="w-4 h-4 text-blue-400" />,
        tip: <Sparkles className="w-4 h-4 text-amber-400" />,
        warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
        alert: <ShieldAlert className="w-4 h-4 text-red-500" />,
    }

    return (
        <div className={`flex flex-col gap-1 p-4 rounded-xl border ${styles[type]} mt-4 mb-4`}>
            <div className="flex items-center gap-2 font-semibold text-[14px] text-white">
                {icons[type]}
                {title}
            </div>
            <div className="text-[13.5px] text-[#A3A299] leading-relaxed ml-6">{children}</div>
        </div>
    )
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
    <div className="flex flex-col rounded-xl border border-[#2B2A29] bg-[#100E12] overflow-hidden mt-3 mb-3">
        <div className="flex items-center justify-between px-4 py-2 bg-[#171615] border-b border-[#2B2A29]">
            <span className="text-[11px] text-[#7B7A79] font-mono">{language}</span>
        </div>
        <div className="p-4 overflow-x-auto">
            <pre className="text-[12.5px] text-[#D6D5C9] font-mono leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    </div>
)

export const DocsPage: React.FC<DocsPageProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('welcome')
    const [isInitialLoading, setIsInitialLoading] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialLoading(false)
        }, 300)
        return () => clearTimeout(timer)
    }, [])

    const sidebarCategories = [
        {
            title: 'Getting Started',
            items: [
                { id: 'welcome', label: 'Welcome to December', icon: Rocket },
                { id: 'quickstart', label: 'Quickstart Guide', icon: BookOpen },
                { id: 'concepts', label: 'Core Concepts', icon: Cpu },
                { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Terminal },
            ],
        },
        {
            title: 'Workspace & Security',
            items: [
                { id: 'workspace', label: 'Workspace & RBAC', icon: Users },
                { id: 'security', label: 'Security & Compliance', icon: Shield },
                { id: 'billing', label: 'Billing & Tokenomics', icon: CreditCard },
            ],
        },
        {
            title: 'Editor & Canvas',
            items: [
                { id: 'canvas-workflow', label: 'Canvas Visual Workflow', icon: Layout },
                { id: 'dual-editor', label: 'Dual-Engine Architecture', icon: Code },
                { id: 'styling', label: 'Custom Styling & Themes', icon: Palette },
                { id: 'prompting-tips', label: 'AI Assist & Prompting', icon: Cpu },
            ],
        },
        {
            title: 'Integrations',
            items: [
                { id: 'github-sync', label: 'GitHub Sync & Git Flow', icon: GitBranch },
                { id: 'database', label: 'Database & Persistence', icon: Database },
                { id: 'stripe', label: 'Stripe & Subscriptions', icon: CreditCard },
                { id: 'cloud-deploys', label: 'Cloud Deploys & Domains', icon: Globe },
                { id: 'cli-api', label: 'Programmatic CLI & APIs', icon: Settings },
            ],
        },
    ]

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px]">
            <div className="flex w-full h-full bg-[#171615] rounded-lg border border-[#242323] overflow-hidden">
                {/* Docs Sidebar */}
                <div className="w-[230px] md:w-[280px] shrink-0 border-r border-[#242323] flex flex-col py-4">
                    <div className="px-4 mb-6">
                        <button
                            onClick={onBack}
                            className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#1E1D1B] px-2 py-1 -ml-2 rounded-lg text-[13px] font-semibold transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1.5" />
                            Home
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-4 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:rounded-full">
                        {isInitialLoading ? (
                            <DocsSidebarSkeleton />
                        ) : (
                            sidebarCategories.map((category) => (
                                <div key={category.title} className="flex flex-col gap-1">
                                    <div className="px-3 py-1.5 text-[11px] font-bold text-[#7B7A79] uppercase tracking-wider">
                                        {category.title}
                                    </div>
                                    {category.items.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id)}
                                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors text-left ${
                                                    activeTab === item.id
                                                        ? 'bg-[#1E1D1B] border border-[#2B2A29] text-[#D6D5C9] shadow-sm'
                                                        : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]/50 border border-transparent'
                                                }`}
                                            >
                                                <Icon
                                                    className="w-[15px] h-[15px] shrink-0"
                                                    strokeWidth={1.5}
                                                />
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#171615] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                    <div className="w-full max-w-[800px] mx-auto px-8 md:px-16 py-8 md:py-16 text-[#D6D5C9]">
                        {isInitialLoading ? (
                            <DocsSkeleton />
                        ) : activeTab === 'welcome' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] md:text-[44px] font-semibold text-white tracking-tight leading-tight">
                                        Welcome to December
                                    </h1>
                                    <p className="text-[16px] md:text-[18px] text-[#A3A299] leading-relaxed">
                                        December is a premium, visual-first AI development platform
                                        designed to build, iterate, and deploy full-stack web
                                        applications dynamically. Describe your ideas, refine
                                        components in real-time, and control code natively via Git.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[22px] font-semibold text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Dual-Engine Philosophy
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Unlike typical generative templates or black-box builders,
                                        December operates on a **dual-engine pipeline**. It bridges
                                        natural language generation with direct code manipulation.
                                        Your designs translate to clean React/TypeScript code synced
                                        directly to Git branches in real-time.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-5 flex flex-col gap-2">
                                            <strong className="text-white text-[14px]">
                                                Visual First Design
                                            </strong>
                                            <p className="text-[13px] text-[#A3A299] leading-relaxed">
                                                Mock up, draw, and structure components visually on
                                                the Canvas. Swapping layouts and generating
                                                structures feels native, responsive, and tactile.
                                            </p>
                                        </div>
                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-5 flex flex-col gap-2">
                                            <strong className="text-white text-[14px]">
                                                Developer Centric Git Flow
                                            </strong>
                                            <p className="text-[13px] text-[#A3A299] leading-relaxed">
                                                Every visual box represents an isolated JSX
                                                component. December outputs high-performance
                                                packages under version control with continuous
                                                integration.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[22px] font-semibold text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Core Stack & Technologies
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        December generates modern, robust web applications using
                                        state-of-the-art technologies:
                                    </p>
                                    <table className="w-full text-left text-[13.5px] text-[#A3A299] border-collapse mt-2">
                                        <thead>
                                            <tr className="border-b border-[#2B2A29] text-white">
                                                <th className="py-2.5 font-medium">Layer</th>
                                                <th className="py-2.5 font-medium">Stack</th>
                                                <th className="py-2.5 font-medium">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3.5 font-medium text-[#D6D5C9]">
                                                    Frontend Logic
                                                </td>
                                                <td className="py-3.5 text-white">
                                                    React 18 + TypeScript
                                                </td>
                                                <td className="py-3.5">
                                                    Strict typed, component-oriented, state-driven
                                                    interfaces.
                                                </td>
                                            </tr>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3.5 font-medium text-[#D6D5C9]">
                                                    UI Styling
                                                </td>
                                                <td className="py-3.5 text-white">
                                                    TailwindCSS v4
                                                </td>
                                                <td className="py-3.5">
                                                    Harmonized styling tokens and dynamic utilities.
                                                </td>
                                            </tr>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3.5 font-medium text-[#D6D5C9]">
                                                    Bundler & Tooling
                                                </td>
                                                <td className="py-3.5 text-white">Vite / Bun</td>
                                                <td className="py-3.5">
                                                    Extremely fast local compilation, build cycles,
                                                    and testing runner.
                                                </td>
                                            </tr>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3.5 font-medium text-[#D6D5C9]">
                                                    Database & ORM
                                                </td>
                                                <td className="py-3.5 text-white">
                                                    Supabase / Prisma
                                                </td>
                                                <td className="py-3.5">
                                                    Automated schema generation, query builders, and
                                                    database migrator.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : activeTab === 'quickstart' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Quickstart Guide
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Build and launch your first live application in under 3
                                        minutes with December's visual editor.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-6 mt-2">
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 mt-0.5 shadow-sm">
                                            1
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className="text-white font-medium text-[16px]">
                                                Initialize a New Project
                                            </h3>
                                            <p className="text-[14px] text-[#A3A299] leading-relaxed">
                                                Head to the Home page and type your core application
                                                intent in the prompt input, or click the **"New
                                                Project"** button in the sidebar. Describe your core
                                                goal (e.g., *"Create a real-time developer metrics
                                                dashboard"*).
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 mt-0.5 shadow-sm">
                                            2
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className="text-white font-medium text-[16px]">
                                                Refine Natively in Visual Mode
                                            </h3>
                                            <p className="text-[14px] text-[#A3A299] leading-relaxed">
                                                Describe adjustments in natural language inside the
                                                AI chat sidebar. Highlight specific visual elements
                                                in **"Visual Mode"** to focus edits on that specific
                                                card, button, or list row directly.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 mt-0.5 shadow-sm">
                                            3
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className="text-white font-medium text-[16px]">
                                                Inspect Code, Canvas & Structure
                                            </h3>
                                            <p className="text-[14px] text-[#A3A299] leading-relaxed">
                                                Toggle between **"Preview"** to test active
                                                interactions, **"Code"** to see raw compiled React
                                                TypeScript in the Editor, and **"Canvas"** to view
                                                flexbox frames and drag-and-drop structural
                                                elements.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center font-bold text-white shrink-0 mt-0.5 shadow-sm">
                                            4
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className="text-white font-medium text-[16px]">
                                                Deploy Globally
                                            </h3>
                                            <p className="text-[14px] text-[#A3A299] leading-relaxed">
                                                Click the **"Publish"** button in the preview
                                                header. Your project is instantly assigned a public
                                                `december.dev` preview domain and deployed globally
                                                on our fast edge network.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Callout title="Continuous Integration" type="tip">
                                    Every visual iteration compiles and merges to a dedicated
                                    branch. By connecting your GitHub account, December
                                    automatically builds and pushes clean, well-formatted commits
                                    straight to Git.
                                </Callout>
                            </div>
                        ) : activeTab === 'shortcuts' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Keyboard Shortcuts
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Accelerate your visual editor design and Canvas workflows
                                        with these single-key shortcuts.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Canvas Selection Shortcuts
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <strong className="text-white text-[13.5px]">
                                                    Select Tool
                                                </strong>
                                                <p className="text-[11.5px] text-[#7B7A79]">
                                                    Select, grab, and move layers and components.
                                                </p>
                                            </div>
                                            <kbd className="bg-[#242323] border border-[#383736] rounded px-2.5 py-0.5 text-[12px] font-mono text-[#D6D5C9] font-semibold">
                                                V
                                            </kbd>
                                        </div>

                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <strong className="text-white text-[13.5px]">
                                                    Hand / Pan Tool
                                                </strong>
                                                <p className="text-[11.5px] text-[#7B7A79]">
                                                    Navigate and scroll across the Canvas view.
                                                </p>
                                            </div>
                                            <kbd className="bg-[#242323] border border-[#383736] rounded px-2.5 py-0.5 text-[12px] font-mono text-[#D6D5C9] font-semibold">
                                                H
                                            </kbd>
                                        </div>

                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <strong className="text-white text-[13.5px]">
                                                    Frame Container
                                                </strong>
                                                <p className="text-[11.5px] text-[#7B7A79]">
                                                    Create flexible bounding layout frames.
                                                </p>
                                            </div>
                                            <kbd className="bg-[#242323] border border-[#383736] rounded px-2.5 py-0.5 text-[12px] font-mono text-[#D6D5C9] font-semibold">
                                                F
                                            </kbd>
                                        </div>

                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <strong className="text-white text-[13.5px]">
                                                    Pen Tool
                                                </strong>
                                                <p className="text-[11.5px] text-[#7B7A79]">
                                                    Draw customized drawings and notes.
                                                </p>
                                            </div>
                                            <kbd className="bg-[#242323] border border-[#383736] rounded px-2.5 py-0.5 text-[12px] font-mono text-[#D6D5C9] font-semibold">
                                                P
                                            </kbd>
                                        </div>

                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <strong className="text-white text-[13.5px]">
                                                    Eraser Tool
                                                </strong>
                                                <p className="text-[11.5px] text-[#7B7A79]">
                                                    Remove canvas vector strokes and components.
                                                </p>
                                            </div>
                                            <kbd className="bg-[#242323] border border-[#383736] rounded px-2.5 py-0.5 text-[12px] font-mono text-[#D6D5C9] font-semibold">
                                                E
                                            </kbd>
                                        </div>

                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <strong className="text-white text-[13.5px]">
                                                    Rectangle Shape
                                                </strong>
                                                <p className="text-[11.5px] text-[#7B7A79]">
                                                    Draw standard square boxes on the canvas.
                                                </p>
                                            </div>
                                            <kbd className="bg-[#242323] border border-[#383736] rounded px-2.5 py-0.5 text-[12px] font-mono text-[#D6D5C9] font-semibold">
                                                R
                                            </kbd>
                                        </div>

                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <strong className="text-white text-[13.5px]">
                                                    Text Tool
                                                </strong>
                                                <p className="text-[11.5px] text-[#7B7A79]">
                                                    Create editable on-screen typography layers.
                                                </p>
                                            </div>
                                            <kbd className="bg-[#242323] border border-[#383736] rounded px-2.5 py-0.5 text-[12px] font-mono text-[#D6D5C9] font-semibold">
                                                T
                                            </kbd>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Tactile Workspace Modifiers
                                    </h2>
                                    <ul className="list-disc pl-5 flex flex-col gap-3 text-[14px] text-[#A3A299]">
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Spacebar or Shift:
                                            </strong>{' '}
                                            Hold down temporarily to switch your tool to the **Hand
                                            (Pan)** tool. Releasing the key instantly restores your
                                            active tool. Useful when dragging large component
                                            structures.
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">Escape:</strong>{' '}
                                            Clears the current visual element selection, resets
                                            highlighted borders, and closes popup menu drawers
                                            immediately.
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Cmd / Ctrl + K:
                                            </strong>{' '}
                                            Opens the global Workspace Command Palette from
                                            anywhere.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : activeTab === 'workspace' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Workspace & Team Collaborations
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Organize projects, assign roles, and manage permissions
                                        across collaborative teams in your Workspace.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Role-Based Access Control (RBAC)
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        December supports four standard roles to maintain security
                                        boundaries across your workspace:
                                    </p>
                                    <div className="flex flex-col gap-3.5 mt-2">
                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex flex-col gap-1">
                                            <strong className="text-white text-[14px]">
                                                Owner / Admin
                                            </strong>
                                            <p className="text-[13px] text-[#A3A299]">
                                                Full billing control, member invitations, API key
                                                management, custom domains, and deletion
                                                capabilities.
                                            </p>
                                        </div>
                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex flex-col gap-1">
                                            <strong className="text-white text-[14px]">
                                                Editor
                                            </strong>
                                            <p className="text-[13px] text-[#A3A299]">
                                                Create, modify, compile, and duplicate projects. Can
                                                push deployments, synchronize databases, and sync
                                                back to Git branches.
                                            </p>
                                        </div>
                                        <div className="bg-[#1E1D1B] border border-[#2B2A29] rounded-xl p-4 flex flex-col gap-1">
                                            <strong className="text-white text-[14px]">
                                                Viewer
                                            </strong>
                                            <p className="text-[13px] text-[#A3A299]">
                                                Read-only access. Review active preview screens,
                                                read code repositories, inspect canvas structures,
                                                and check audit histories.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Callout title="Billing Boundaries" type="warning">
                                    Only Workspace Owners can subscribe to plans, invite billing
                                    contacts, configure credit cards, and perform plan changes or
                                    cancellation flows.
                                </Callout>
                            </div>
                        ) : activeTab === 'security' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Security & Compliance
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Enterprise-grade code security, isolated data boundaries,
                                        and strict compliance structures.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        AI Training Data Privacy Policy
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        At December, your code remains exclusively yours. We
                                        strictly partition workspace contexts. Custom generation
                                        models are completely isolated and **never** trained on your
                                        private inputs, prompt history, database models, or codebase
                                        repositories. Workspace owners can toggle strict
                                        workspace-wide opt-outs inside Account Settings to enforce
                                        local LLM inference configurations.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Compliance & Isolation
                                    </h2>
                                    <ul className="list-disc pl-5 flex flex-col gap-2.5 text-[14.0px] text-[#A3A299]">
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                SOC 2 Type II Compliance:
                                            </strong>{' '}
                                            Enforced access controls, continuous network
                                            vulnerability scanning, and annual third-party audits.
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                ISO/IEC 27001:2022:
                                            </strong>{' '}
                                            Certified information security management systems
                                            covering infrastructure, databases, and deployment
                                            pipelines.
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                GDPR / CCPA Alignment:
                                            </strong>{' '}
                                            Native data residency selection (EU, US, APAC region
                                            centers) and instant data purging controls.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : activeTab === 'billing' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Billing & Token Economics
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Understand subscriptions, credit caps, and credit
                                        consumption rates inside December.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Model Consumption Matrix
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Generative edits and plans consume credits in cents
                                        depending on model intelligence and token output.
                                    </p>
                                    <table className="w-full text-left text-[13px] text-[#A3A299] border-collapse mt-2">
                                        <thead>
                                            <tr className="border-b border-[#2B2A29] text-white">
                                                <th className="py-2.5 font-medium">Model</th>
                                                <th className="py-2.5 font-medium">
                                                    Input/1M Tokens
                                                </th>
                                                <th className="py-2.5 font-medium">
                                                    Output/1M Tokens
                                                </th>
                                                <th className="py-2.5 font-medium">
                                                    Average cost per edit
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3 font-medium text-[#D6D5C9]">
                                                    Claude 3.5 Sonnet
                                                </td>
                                                <td className="py-3">$3.00</td>
                                                <td className="py-3">$15.00</td>
                                                <td className="py-3 text-white">~ 4.0 cents</td>
                                            </tr>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3 font-medium text-[#D6D5C9]">
                                                    GPT-4o
                                                </td>
                                                <td className="py-3">$2.50</td>
                                                <td className="py-3">$10.00</td>
                                                <td className="py-3 text-white">~ 3.0 cents</td>
                                            </tr>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3 font-medium text-[#D6D5C9]">
                                                    Gemini 2.5 Flash
                                                </td>
                                                <td className="py-3">$0.075</td>
                                                <td className="py-3">$0.30</td>
                                                <td className="py-3 text-white">~ 0.2 cents</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <Callout title="Auto-Replenish Limits" type="info">
                                    When remaining credits fall to $0, AI generations are paused.
                                    You can activate Auto-Replenish inside Billing Settings to
                                    configure automated top-ups (e.g. $10 additions) when your
                                    credits fall below $2.
                                </Callout>
                            </div>
                        ) : activeTab === 'canvas-workflow' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Canvas Visual Workflow
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Build structural components, arrange layouts, and link
                                        database models completely visually.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Component Linking & Flow
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        On the Canvas, drag components into **"Frames"** to group
                                        them inside flexbox wrappers. To bind user actions (e.g.
                                        form submission) to backend mutations (e.g. database
                                        insert), simply drag a connection arrow from the button node
                                        to the database table entity. December automatically
                                        generates the required client-side fetch handlers and Prisma
                                        service endpoints.
                                    </p>
                                </div>

                                <Callout title="Drawing Vectors" type="tip">
                                    Use the **Pen Tool (P)** to sketch UI additions, notes, or flow
                                    diagrams directly on top of generated elements. Drawings are
                                    saved inside the project version manifest under vector layers.
                                </Callout>
                            </div>
                        ) : activeTab === 'dual-editor' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Dual-Engine Architecture
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        How December seamlessly bridges the gap between visual
                                        layout designers and real source code.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Synchronization Flow
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Our dual-engine pipeline ensures the visual layout remains
                                        completely synced with the React code:
                                    </p>
                                    <ol className="list-decimal pl-5 flex flex-col gap-3.5 text-[14px] text-[#A3A299] marker:text-[#7B7A79] marker:font-bold">
                                        <li className="pl-1">
                                            <strong className="text-[#D6D5C9]">
                                                Visual Action:
                                            </strong>{' '}
                                            When you drag or add a component on the Canvas, it
                                            registers in our local Rust compiler.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="text-[#D6D5C9]">
                                                AST Compiling:
                                            </strong>{' '}
                                            The AST (Abstract Syntax Tree) is compiled, generating
                                            clean JSX and Tailwind v4 classes in memory.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="text-[#D6D5C9]">
                                                Direct Code Sync:
                                            </strong>{' '}
                                            The generated code compiles and mounts inside CodeMirror
                                            instantly. Any manual code adjustments you type inside
                                            the Code tab immediately re-render visual Canvas
                                            components.
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        ) : activeTab === 'prompting-tips' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        AI Assist & Prompting Tips
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Master prompting structures to generate production-ready
                                        architectures instantly.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Targeted Visual Prompting
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Instead of writing broad, sweeping prompts, toggle **"Visual
                                        Mode"** inside the editor. Click on the specific element you
                                        want to edit (e.g. the main navigation bar). This isolates
                                        that component's JSX subtree, allowing you to prompt small,
                                        focused changes (e.g., *"Make this bar sticky and add a
                                        subtle blur shadow"*) without affecting the rest of the
                                        layout.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Prompting Best Practices
                                    </h2>
                                    <ul className="list-disc pl-5 flex flex-col gap-2.5 text-[14px] text-[#A3A299]">
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Specify state:
                                            </strong>{' '}
                                            Ask for active, hover, and empty states explicitly
                                            (*"Show a beautiful skeleton card loader while list is
                                            empty"*).
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Define boundaries:
                                            </strong>{' '}
                                            Guide layout scopes (*"Wrap this in an isolated flex
                                            layout"*).
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Iterative refinements:
                                            </strong>{' '}
                                            Prompt incremental, step-by-step changes rather than
                                            large structural modifications all at once.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : activeTab === 'github-sync' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        GitHub Sync & Git Flow
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Manage your repository syncing, branch commits, and conflict
                                        resolutions.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Silent Pushes & Pull Requests
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Once GitHub is connected, December sets up a continuous
                                        integration pipeline. Every single successfully compiled
                                        visual iteration triggers a silent commit and pushes it
                                        straight to a dedicated `december/feature-name` branch. When
                                        you are ready to merge into `main`, click **"Create PR"**
                                        directly from December to generate a beautifully structured
                                        pull request with diff summaries.
                                    </p>
                                </div>

                                <Callout title="Conflict Resolutions" type="warning">
                                    If another developer pushes direct edits to your Git branch,
                                    December automatically triggers a background branch merge. If
                                    merge conflicts arise, they are highlighted in the direct Code
                                    tab, letting you resolve conflicts manually before compiling.
                                </Callout>
                            </div>
                        ) : activeTab === 'cloud-deploys' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Cloud Deploys & Custom Domains
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Deploy applications globally, configure routing, and connect
                                        custom domains.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Setting up Custom Domains
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Pro subscribers can easily link custom domains (e.g.
                                        `app.mybrand.com`) to their December preview deployments:
                                    </p>
                                    <ol className="list-decimal pl-5 flex flex-col gap-3 text-[14px] text-[#A3A299] marker:text-[#7B7A79] marker:font-bold">
                                        <li>
                                            Open **Project Settings** and navigate to the
                                            **Domains** tab.
                                        </li>
                                        <li>
                                            Add your custom domain and copy the target CNAME target.
                                        </li>
                                        <li>
                                            Configure your DNS provider with the following
                                            parameters:
                                        </li>
                                    </ol>
                                    <table className="w-full text-left text-[13px] text-[#A3A299] border-collapse mt-2">
                                        <thead>
                                            <tr className="border-b border-[#2B2A29] text-white">
                                                <th className="py-2.5 font-medium">Type</th>
                                                <th className="py-2.5 font-medium">Host</th>
                                                <th className="py-2.5 font-medium">Value</th>
                                                <th className="py-2.5 font-medium">TTL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-[#2B2A29]/40">
                                                <td className="py-3 font-medium text-[#D6D5C9]">
                                                    CNAME
                                                </td>
                                                <td className="py-3">@ / app</td>
                                                <td className="py-3">dns.december.dev</td>
                                                <td className="py-3">Automatic</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : activeTab === 'cli-api' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Programmatic CLI & APIs
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Trigger generations, sync databases, and manage environments
                                        programmatically.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        December CLI
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Deploy our headless CLI to integrate December into your
                                        local shell and CI pipeline workflow:
                                    </p>
                                    <CodeBlock
                                        code={`# Install December global CLI
npm install -g @december/cli

# Login and authorize account
december login

# Initialize database schema from current Prisma model
december db pull --project-id <your-uuid>`}
                                        language="bash"
                                    />
                                </div>
                            </div>
                        ) : activeTab === 'concepts' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Core Concepts
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Explore the foundational architecture that drives the
                                        December platform.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Abstract Syntax Tree (AST) Modification
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Instead of generating arbitrary text or writing simple code
                                        scripts, December maps the visual nodes you draw directly to
                                        a structured React/TypeScript Abstract Syntax Tree (AST).
                                        Every visually selected component is mapped to its exact
                                        matching TSX representation.
                                    </p>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        When you edit elements via the chat interface, the AI works
                                        with a semantic representation of the tree, modifying exact
                                        React components, styling nodes, and import trees without
                                        disrupting the surrounding layout.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Isolated Component Frameworks
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        To maintain a production-grade, easily maintainable layout,
                                        generated apps are designed around strict component
                                        boundaries. Feature-driven directories in `src/features`
                                        isolate complex stateful code, while `src/shared` hosts
                                        atomic, highly reusable buttons, badges, and modals.
                                    </p>
                                </div>
                            </div>
                        ) : activeTab === 'styling' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Custom Styling & Themes
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        December uses a robust, developer-centric styling system
                                        built on TailwindCSS.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Harmonized Design Tokens
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Every project generated comes pre-configured with a
                                        carefully curated, harmonized palette. Standard styling
                                        features (HWB / HSL color mappings, glassmorphic headers,
                                        card gradients, and backdrop-blur panels) reside within the
                                        standard tokens.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Transitions & Micro-Animations
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Interactable buttons and input panels default to precise
                                        transitions (e.g. `transition-[border-color,box-shadow]` and
                                        `transition-[transform,background-color]`), removing
                                        standard browser layout flickers and auto-focus sparks.
                                        Framer Motion is fully integrated for beautiful page-level
                                        and stateful modal transitions.
                                    </p>
                                </div>
                            </div>
                        ) : activeTab === 'database' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Database & Persistence
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Manage database tables, schemas, and relationships natively
                                        in your projects.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Prisma ORM Integration
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        December projects are backed by Prisma, facilitating
                                        automated relational migrations. You can visually add data
                                        fields, customize relation fields, and generate queries
                                        without typing raw SQL.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Dynamic API Endpoints
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Every database table added automatically scaffolds
                                        corresponding TypeScript controller, service, routing, and
                                        Zod validation files. This makes back-end persistence
                                        immediately available to the web front-end interface.
                                    </p>
                                </div>
                            </div>
                        ) : activeTab === 'stripe' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3.5">
                                    <h1 className="text-[36px] font-semibold text-white tracking-tight">
                                        Stripe & Subscriptions
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Easily monetize your generated web application using Stripe
                                        integration.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Scaffolding Subscription Plans
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        Quickly set up Free, Pro, and Enterprise subscription tiers.
                                        The platform automatically creates backend middleware to
                                        guard API endpoints and locks specific UI actions depending
                                        on active checkout cycles and subscription flags.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2 tracking-tight">
                                        Checkout Flows & Webhook Listeners
                                    </h2>
                                    <p className="text-[14.5px] text-[#A3A299] leading-relaxed">
                                        December provisions complete Stripe Checkout routes,
                                        customized Razorpay integrations, billing transaction
                                        tables, and standard webhook routers to securely process
                                        payment status updates in real-time.
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
