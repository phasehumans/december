import {
    ChevronLeft,
    Book,
    Rocket,
    Users,
    LayoutDashboard,
    ShieldCheck,
    Terminal,
    Lightbulb,
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
        <div className="flex flex-col gap-4 mt-6">
            <Skeleton className="h-8 w-1/3 max-w-[200px] rounded-lg" />
            <Skeleton className="h-24 w-full rounded-xl" />
        </div>
    </div>
)

const DocsSidebarSkeleton = () => (
    <div className="flex flex-col gap-2 mt-4 animate-in fade-in duration-300">
        <Skeleton className="h-3 w-24 ml-3 rounded-md mb-1 mt-2" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />

        <Skeleton className="h-3 w-32 ml-3 rounded-md mb-1 mt-4" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />

        <Skeleton className="h-3 w-28 ml-3 rounded-md mb-1 mt-4" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />

        <Skeleton className="h-3 w-20 ml-3 rounded-md mb-1 mt-4" />
        <Skeleton className="h-8 w-[90%] mx-auto rounded-xl" />
    </div>
)

const Callout: React.FC<{ type?: 'info' | 'tip'; title: string; children: React.ReactNode }> = ({
    type = 'info',
    title,
    children,
}) => (
    <div
        className={`flex flex-col gap-1 p-4 rounded-xl border ${type === 'tip' ? 'bg-[#1E1D1B] border-[#383736]' : 'bg-[#1a1b26] border-[#2a2b3d]'} mt-2 mb-2`}
    >
        <div className="flex items-center gap-2 font-medium text-[14px] text-white">
            {type === 'tip' ? (
                <Lightbulb className="w-4 h-4 text-yellow-500" />
            ) : (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
            )}
            {title}
        </div>
        <div className="text-[14px] text-[#A3A299] leading-relaxed ml-6">{children}</div>
    </div>
)

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
    <div className="flex flex-col rounded-xl border border-[#383736] bg-[#121110] overflow-hidden mt-3 mb-3">
        <div className="flex items-center justify-between px-4 py-2 bg-[#171615] border-b border-[#383736]">
            <span className="text-[12px] text-[#7B7A79] font-mono">{language}</span>
        </div>
        <div className="p-4 overflow-x-auto">
            <pre className="text-[13px] text-[#D6D5C9] font-mono leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    </div>
)

export const DocsPage: React.FC<DocsPageProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('Welcome to December')
    const [isInitialLoading, setIsInitialLoading] = useState(true)

    // Simulate loading effect only on initial mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialLoading(false)
        }, 500)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px]">
            <div className="flex w-full h-full bg-[#171615] rounded-lg border border-[#242323] overflow-hidden">
                {/* Docs Sidebar */}
                <div className="w-[220px] md:w-[260px] shrink-0 border-r border-[#242323] flex flex-col py-4">
                    <div className="px-4 mb-6">
                        <button
                            onClick={onBack}
                            className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#1E1D1B] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Home
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:rounded-full">
                        {isInitialLoading ? (
                            <DocsSidebarSkeleton />
                        ) : (
                            <>
                                {/* Getting started */}
                                <div className="px-3 py-2 text-[12px] font-semibold text-[#7B7A79] mt-2 mb-1 uppercase tracking-wider">
                                    Getting started
                                </div>
                                <button
                                    onClick={() => setActiveTab('Welcome to December')}
                                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                        activeTab === 'Welcome to December'
                                            ? 'bg-[#242323] text-[#D6D5C9]'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    <Rocket className="w-[16px] h-[16px]" strokeWidth={1.5} />
                                    Welcome to December
                                </button>
                                <button
                                    onClick={() => setActiveTab('Create an account')}
                                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                        activeTab === 'Create an account'
                                            ? 'bg-[#242323] text-[#D6D5C9]'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    <Book className="w-[16px] h-[16px] opacity-0" />
                                    Create an account
                                </button>
                                <button
                                    onClick={() => setActiveTab('Plans and credits')}
                                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                        activeTab === 'Plans and credits'
                                            ? 'bg-[#242323] text-[#D6D5C9]'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    <Book className="w-[16px] h-[16px] opacity-0" />
                                    Plans and credits
                                </button>

                                {/* Workspace */}
                                <div className="px-3 py-2 text-[12px] font-semibold text-[#7B7A79] mt-4 mb-1 uppercase tracking-wider">
                                    December workspace
                                </div>
                                <button
                                    onClick={() => setActiveTab('Workspace')}
                                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                        activeTab === 'Workspace'
                                            ? 'bg-[#242323] text-[#D6D5C9]'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    <Users className="w-[16px] h-[16px]" strokeWidth={1.5} />
                                    Workspace
                                </button>
                                <button
                                    onClick={() => setActiveTab('Admin settings')}
                                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                        activeTab === 'Admin settings'
                                            ? 'bg-[#242323] text-[#D6D5C9]'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    <Book className="w-[16px] h-[16px] opacity-0" />
                                    Admin settings
                                </button>

                                {/* Dashboard */}
                                <div className="px-3 py-2 text-[12px] font-semibold text-[#7B7A79] mt-4 mb-1 uppercase tracking-wider">
                                    December dashboard
                                </div>
                                <button
                                    onClick={() => setActiveTab('Dashboard overview')}
                                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                        activeTab === 'Dashboard overview'
                                            ? 'bg-[#242323] text-[#D6D5C9]'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    <LayoutDashboard
                                        className="w-[16px] h-[16px]"
                                        strokeWidth={1.5}
                                    />
                                    Dashboard overview
                                </button>

                                {/* Reference */}
                                <div className="px-3 py-2 text-[12px] font-semibold text-[#7B7A79] mt-4 mb-1 uppercase tracking-wider">
                                    Reference
                                </div>
                                <button
                                    onClick={() => setActiveTab('Security & privacy')}
                                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                        activeTab === 'Security & privacy'
                                            ? 'bg-[#242323] text-[#D6D5C9]'
                                            : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    <ShieldCheck className="w-[16px] h-[16px]" strokeWidth={1.5} />
                                    Security & privacy
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#171615] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                    <div className="w-full max-w-[800px] mx-auto px-8 md:px-16 py-8 md:py-16 text-[#D6D5C9]">
                        {isInitialLoading ? (
                            <DocsSkeleton />
                        ) : activeTab === 'Welcome to December' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-[32px] md:text-[40px] font-semibold text-white tracking-tight">
                                        Welcome to December
                                    </h1>
                                    <p className="text-[16px] md:text-[18px] text-[#A3A299] leading-relaxed">
                                        December is a full-stack AI development platform for
                                        building, iterating on, and deploying web applications using
                                        natural language, with real code, security, and enterprise
                                        governance.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-2">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Who December is for
                                    </h2>
                                    <ul className="list-none flex flex-col gap-3 text-[15px] text-[#A3A299]">
                                        <li className="flex gap-3 items-start">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#7B7A79] shrink-0" />
                                            <span>
                                                <strong className="text-[#D6D5C9]">
                                                    Founders and entrepreneurs
                                                </strong>{' '}
                                                launching MVPs or testing early product ideas.
                                            </span>
                                        </li>
                                        <li className="flex gap-3 items-start">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#7B7A79] shrink-0" />
                                            <span>
                                                <strong className="text-[#D6D5C9]">
                                                    Designers
                                                </strong>{' '}
                                                moving beyond static mockups to production-ready
                                                interfaces.
                                            </span>
                                        </li>
                                        <li className="flex gap-3 items-start">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#7B7A79] shrink-0" />
                                            <span>
                                                <strong className="text-[#D6D5C9]">
                                                    Developers
                                                </strong>{' '}
                                                using December to quickly set up projects, internal
                                                tools, and early prototypes.
                                            </span>
                                        </li>
                                        <li className="flex gap-3 items-start">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#7B7A79] shrink-0" />
                                            <span>
                                                <strong className="text-[#D6D5C9]">
                                                    Engineering teams
                                                </strong>{' '}
                                                reviewing, extending, and maintaining generated code
                                                through GitHub.
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        How December fits into your workflow
                                    </h2>
                                    <ol className="list-decimal pl-5 flex flex-col gap-4 text-[15px] text-[#A3A299] marker:text-[#7B7A79] marker:font-medium">
                                        <li className="pl-2">
                                            <strong className="text-[#D6D5C9] block mb-1">
                                                Describe what you want to build
                                            </strong>
                                            Use natural language to explain your product vision.
                                        </li>
                                        <li className="pl-2">
                                            <strong className="text-[#D6D5C9] block mb-1">
                                                Review and iterate dynamically
                                            </strong>
                                            Refine the code dynamically in real-time within the
                                            canvas.
                                        </li>
                                        <li className="pl-2">
                                            <strong className="text-[#D6D5C9] block mb-1">
                                                Sync code to GitHub
                                            </strong>
                                            Ensure version control and collaborate with your team
                                            natively.
                                        </li>
                                        <li className="pl-2">
                                            <strong className="text-[#D6D5C9] block mb-1">
                                                Deploy and operate
                                            </strong>
                                            Ship securely with enterprise-grade compliance and
                                            infrastructure.
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        ) : activeTab === 'Create an account' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-[32px] font-semibold text-white tracking-tight">
                                        Create an account
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Getting started with December is simple. You can create an
                                        account using your existing credentials to start generating
                                        applications in seconds.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Sign up methods
                                    </h2>
                                    <div className="flex flex-col gap-4 text-[15px] text-[#A3A299]">
                                        <p>
                                            We currently support the following authentication
                                            methods:
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                            <div className="bg-[#1E1D1B] border border-[#383736] rounded-xl p-4 flex flex-col gap-1.5">
                                                <strong className="text-[#D6D5C9] text-[14px]">
                                                    GitHub (Recommended)
                                                </strong>
                                                <p className="text-[13px] text-[#A3A299] leading-relaxed">
                                                    Automatically links your December account to
                                                    your GitHub profile, allowing seamless
                                                    repository syncing.
                                                </p>
                                            </div>
                                            <div className="bg-[#1E1D1B] border border-[#383736] rounded-xl p-4 flex flex-col gap-1.5">
                                                <strong className="text-[#D6D5C9] text-[14px]">
                                                    Google
                                                </strong>
                                                <p className="text-[13px] text-[#A3A299] leading-relaxed">
                                                    Quick and easy access using your Google
                                                    Workspace or personal Gmail account.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Callout title="Early Access" type="tip">
                                        Currently, December is rolling out to early access users. If
                                        you do not have an invite code, you may be placed on the
                                        waitlist upon registration.
                                    </Callout>
                                </div>
                            </div>
                        ) : activeTab === 'Plans and credits' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-[32px] font-semibold text-white tracking-tight">
                                        Plans and credits
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        December offers flexible pricing tiers designed to scale
                                        with your needs, from solo developers building side projects
                                        to enterprise teams requiring governance.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div className="bg-[#1E1D1C] border border-[#242323] rounded-xl p-6 flex flex-col gap-2 hover:border-[#383736] transition-colors">
                                        <h3 className="text-white font-medium text-[18px]">
                                            Free Tier
                                        </h3>
                                        <p className="text-[14px] text-[#7B7A79]">
                                            Best for exploring.
                                        </p>
                                        <div className="text-[24px] font-medium text-white mt-2 mb-2">
                                            $0{' '}
                                            <span className="text-[14px] text-[#7B7A79] font-normal">
                                                /mo
                                            </span>
                                        </div>
                                        <ul className="mt-2 flex flex-col gap-2 text-[14px] text-[#A3A299]">
                                            <li className="flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4 text-[#7B7A79]" />{' '}
                                                100 Generation credits / month
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-[#7B7A79]" />{' '}
                                                Community support
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Book className="w-4 h-4 text-[#7B7A79]" /> Public
                                                projects only
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="bg-[#1E1D1C] border border-[#383736] rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden ring-1 ring-white/10 shadow-lg">
                                        <div className="absolute top-0 right-0 bg-[#D6D5C9] text-black text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg tracking-wider">
                                            Popular
                                        </div>
                                        <h3 className="text-white font-medium text-[18px]">
                                            Pro Tier
                                        </h3>
                                        <p className="text-[14px] text-[#7B7A79]">
                                            For professional makers.
                                        </p>
                                        <div className="text-[24px] font-medium text-white mt-2 mb-2">
                                            $20{' '}
                                            <span className="text-[14px] text-[#7B7A79] font-normal">
                                                /mo
                                            </span>
                                        </div>
                                        <ul className="mt-2 flex flex-col gap-2 text-[14px] text-[#A3A299]">
                                            <li className="flex items-center gap-2">
                                                <Rocket className="w-4 h-4 text-[#7B7A79]" />{' '}
                                                Unlimited Generation credits
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4 text-[#7B7A79]" />{' '}
                                                Private projects
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Terminal className="w-4 h-4 text-[#7B7A79]" />{' '}
                                                GitHub sync & custom domains
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'Workspace' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-[32px] font-semibold text-white tracking-tight">
                                        Workspace
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Your Workspace is the central hub where you and your team
                                        collaborate on December projects. It organizes your
                                        applications, settings, and shared resources.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Managing Projects
                                    </h2>
                                    <p className="text-[15px] text-[#A3A299]">
                                        Inside your workspace, you can organize projects into
                                        folders, set visibility (Internal, External, Draft), and
                                        duplicate existing templates to jumpstart new development.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Collaboration
                                    </h2>
                                    <p className="text-[15px] text-[#A3A299] leading-relaxed">
                                        Invite team members via email or share secure links. You can
                                        define granular access controls, allowing certain members to
                                        edit code while restricting others to view-only mode.
                                    </p>
                                    <CodeBlock
                                        code={`// Example of inviting a user via the CLI API
phase workspace invite --email user@example.com --role editor`}
                                        language="bash"
                                    />
                                </div>
                            </div>
                        ) : activeTab === 'Admin settings' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-[32px] font-semibold text-white tracking-tight">
                                        Admin settings
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        Workspace administrators have access to global settings to
                                        manage security, billing, and integrations.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Available Controls
                                    </h2>
                                    <ul className="list-disc pl-5 flex flex-col gap-2 text-[15px] text-[#A3A299]">
                                        <li>
                                            <strong className="text-[#D6D5C9]">API Keys:</strong>{' '}
                                            Generate and revoke December API keys for programmatic
                                            access.
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Billing & Usage:
                                            </strong>{' '}
                                            Monitor credit consumption and manage payment methods.
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Data Opt-Out:
                                            </strong>{' '}
                                            Configure data retention and AI training opt-out
                                            preferences.
                                        </li>
                                        <li>
                                            <strong className="text-[#D6D5C9]">
                                                Integrations:
                                            </strong>{' '}
                                            Connect your workspace to GitHub, Vercel, and other
                                            external providers.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : activeTab === 'Dashboard overview' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-[32px] font-semibold text-white tracking-tight">
                                        Dashboard overview
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        The dashboard is your personal command center. It provides
                                        an at-a-glance view of your recent activity, starred
                                        projects, and active deployments.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Navigation
                                    </h2>
                                    <p className="text-[15px] text-[#A3A299] leading-relaxed">
                                        Use the global search bar to instantly find projects by name
                                        or content. The project list supports advanced sorting
                                        (Newest first, Oldest first) and filtering by publish status
                                        (Draft, Generated, Published).
                                    </p>
                                    <Callout title="Keyboard Shortcuts" type="tip">
                                        Press{' '}
                                        <kbd className="bg-[#242323] border border-[#383736] rounded px-1.5 py-0.5 text-[12px] font-mono mx-1">
                                            ⌘ + K
                                        </kbd>{' '}
                                        anywhere in the dashboard to open the global command
                                        palette.
                                    </Callout>
                                </div>
                            </div>
                        ) : activeTab === 'Security & privacy' ? (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-[32px] font-semibold text-white tracking-tight">
                                        Security & privacy
                                    </h1>
                                    <p className="text-[16px] text-[#A3A299] leading-relaxed">
                                        December is built from the ground up with enterprise
                                        security in mind. We prioritize the protection of your
                                        intellectual property and user data.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Certifications and standards
                                    </h2>
                                    <ul className="list-disc pl-5 flex flex-col gap-2 text-[15px] text-[#A3A299]">
                                        <li>SOC 2 Type II Certified</li>
                                        <li>ISO 27001:2022 Compliant</li>
                                        <li>GDPR Compliant Architecture</li>
                                    </ul>
                                </div>

                                <div className="flex flex-col gap-4 mt-4">
                                    <h2 className="text-[20px] font-medium text-white border-b border-[#242323] pb-2">
                                        Access and identity
                                    </h2>
                                    <ul className="list-none flex flex-col gap-3 text-[15px] text-[#A3A299]">
                                        <li className="flex gap-3 items-start">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7B7A79] shrink-0" />
                                            <span>
                                                Role-based access control (RBAC) at the workspace
                                                level.
                                            </span>
                                        </li>
                                        <li className="flex gap-3 items-start">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7B7A79] shrink-0" />
                                            <span>
                                                Enforced Two-factor authentication (2FA) for
                                                organization members.
                                            </span>
                                        </li>
                                        <li className="flex gap-3 items-start">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7B7A79] shrink-0" />
                                            <span>
                                                Single sign-on (SSO) and SCIM user provisioning for
                                                Enterprise tiers.
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                                <Callout title="Data Privacy" type="info">
                                    Your proprietary code and datasets are strictly partitioned.
                                    Enterprise models are never trained on your private workspace
                                    data.
                                </Callout>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
