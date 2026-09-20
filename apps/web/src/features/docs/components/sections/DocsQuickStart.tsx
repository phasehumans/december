import { Terminal, Rocket } from 'lucide-react'
import React from 'react'

import { CodeBlock, DocCallout, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsQuickStart: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Rocket className="w-3 h-3" />
                        Getting Started
                    </span>
                    <span className="text-[12px] text-[#71717A]">Under 2 minutes</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Getting Started with December
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    Follow this walkthrough to launch your first session in either the cloud
                    workspace or directly inside your local terminal repository.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Cloud Workspace Walkthrough */}
                <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#1E1E1E] border border-[#2B2B2B] text-[#EDEDEF] text-[12px] font-bold flex items-center justify-center">
                            1
                        </span>
                        <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                            Cloud Workspace Walkthrough
                        </h2>
                    </div>

                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        The cloud workspace offers zero-configuration micro-VM sandboxes with live
                        interactive previews and GitHub integration.
                    </p>

                    <div className="space-y-3">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-2">
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                Step A: Launch a New Session
                            </h3>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Visit{' '}
                                <a
                                    href="https://trydecember.com"
                                    className="text-[#87B2F4] hover:underline"
                                >
                                    trydecember.com
                                </a>{' '}
                                and type your initial task in the prompt bar. You can choose a
                                starter template (React, Vite, Next.js, Node) or import an existing
                                GitHub repository.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-2">
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                Step B: Attach Files &amp; Context with @ Mentions
                            </h3>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Type{' '}
                                <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12px] font-mono">
                                    @
                                </code>{' '}
                                in the prompt bar to attach specific project files, recent sessions,
                                or environment variables directly into the agent&apos;s working
                                memory.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-2">
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                Step C: Inspect Code &amp; Test Live Previews
                            </h3>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                As December executes, the split-screen view updates with real-time
                                file diffs, live dev server output, and interactive preview frames.
                                You can test the application directly in the browser.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Terminal CLI Installation */}
                <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#1E1E1E] border border-[#2B2B2B] text-[#EDEDEF] text-[12px] font-bold flex items-center justify-center">
                            2
                        </span>
                        <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                            Terminal CLI Installation &amp; Setup
                        </h2>
                    </div>

                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        For local development, the December CLI runs directly in your terminal,
                        respecting your local Git repository context.
                    </p>

                    <div className="space-y-3">
                        <div>
                            <p className="text-[13px] text-[#EDEDEF] font-medium mb-1">
                                Global installation:
                            </p>
                            <CodeBlock
                                code="npm install -g @trydecember/cli"
                                language="bash"
                                filename="Terminal"
                            />
                        </div>

                        <div>
                            <p className="text-[13px] text-[#EDEDEF] font-medium mb-1">
                                Or run instantly with npx (no install needed):
                            </p>
                            <CodeBlock code="npx @trydecember/cli" language="bash" />
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1.5">
                            <h3 className="text-[14px] font-medium text-[#EDEDEF] flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-[#7FD6B0]" />
                                Authentication Handshake
                            </h3>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Run{' '}
                                <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12px] font-mono">
                                    december login
                                </code>{' '}
                                to authorize your CLI session. A browser window opens automatically
                                to connect your device and store your session credentials securely.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1.5">
                            <h3 className="text-[14px] font-medium text-[#EDEDEF] flex items-center gap-2">
                                <Rocket className="w-4 h-4 text-[#87B2F4]" />
                                Launching the Agent
                            </h3>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Navigate to any project directory and run{' '}
                                <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12px] font-mono">
                                    december
                                </code>
                                . The agent scans your repo, parses Git status, and launches the
                                interactive TUI.
                            </p>
                        </div>
                    </div>

                    <DocCallout type="tip" title="First Session Tip">
                        Start with a focused task such as{' '}
                        <span className="text-[#EDEDEF] font-mono text-[12px]">
                            &quot;Add a search filter bar with debounce to the session list&quot;
                        </span>
                        . Small, well-scoped prompts allow you to inspect the agent&apos;s planning
                        and verification flow.
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && <DocPagination currentTab="Quick Start" onNavigate={onNavigate} />}
            </div>
        </div>
    )
}
