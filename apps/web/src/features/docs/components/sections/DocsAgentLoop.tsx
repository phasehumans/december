import { Workflow, Eye, Brain, Play, RefreshCw } from 'lucide-react'
import React from 'react'

import { DocCallout, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsAgentLoop: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Workflow className="w-3 h-3" />
                        Engine Architecture
                    </span>
                    <span className="text-[12px] text-[#71717A]">Multi-Turn Reasoning</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Agent Decision Loop &amp; Self-Healing
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    December executes an autonomous multi-turn control loop to guarantee code
                    correctness before releasing diffs. Here is how the reasoning engine operates.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. The 4-Stage Loop */}
                <section className="flex flex-col gap-4">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        The 4-Stage Decision Cycle
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Rather than guessing code implementations in a single shot, December cycles
                        through four distinct phases:
                    </p>

                    <div className="space-y-3">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] flex gap-3.5 items-start">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <Eye className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                    1. Inspect &amp; Map
                                </h3>
                                <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                    The agent parses your repository tree, reads relevant file
                                    contents, traces import dependencies across monorepo packages,
                                    and reviews recent Git commits to understand codebase patterns.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] flex gap-3.5 items-start">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <Brain className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                    2. Plan &amp; Deconstruct
                                </h3>
                                <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                    Complex instructions are broken down into discrete atomic steps:
                                    database migrations, backend routes, schema updates, frontend UI
                                    components, and unit test suites.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] flex gap-3.5 items-start">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <Play className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                    3. Execute Non-Destructive Diffs
                                </h3>
                                <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                    Edits are applied via AST-aware string replace blocks rather
                                    than blind whole-file overwrites. This preserves existing logic,
                                    formatting, comments, and unrelated utilities.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] flex gap-3.5 items-start">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <RefreshCw className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                    4. Verify &amp; Self-Heal
                                </h3>
                                <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                    December triggers compiler builds (e.g.{' '}
                                    <code className="text-[#EDEDEF] font-mono text-[12px]">
                                        tsc --noEmit
                                    </code>
                                    ), linter checks, and test scripts inside the micro-VM. Any
                                    errors are streamed back into the agent context for immediate
                                    autonomous correction.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Compiler-in-the-Loop Feedback */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Compiler-in-the-Loop Feedback
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        The biggest differentiator between a simple chatbot and an autonomous coding
                        engineer is closed-loop runtime feedback. If a change causes a type mismatch
                        or breaks an import:
                    </p>

                    <div className="p-4 rounded-xl border border-[#242323] bg-[#0E0E0E] font-mono text-[12.5px] space-y-2 text-[#9A9998]">
                        <div className="text-red-400">
                            ✗ TypeScript Error: Property &apos;avatarUrl&apos; does not exist on
                            type &apos;UserSession&apos;.
                        </div>
                        <div className="text-[#87B2F4]">
                            → Agent reads diagnostic at src/app/header.tsx:42
                        </div>
                        <div className="text-[#7FD6B0]">
                            ✓ Agent adds optional avatarUrl?: string to UserSession interface in
                            src/app/types.ts
                        </div>
                        <div className="text-[#EDEDEF]">
                            ✓ Re-run tsc: 0 errors found. Changes finalized.
                        </div>
                    </div>

                    <DocCallout type="info" title="Zero Human Intervention">
                        December attempts up to multiple self-healing iterations before concluding a
                        turn. In over 85% of cases, compiler and syntax errors are resolved
                        autonomously before the developer reviews the result.
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && <DocPagination currentTab="Agent Loop" onNavigate={onNavigate} />}
            </div>
        </div>
    )
}
