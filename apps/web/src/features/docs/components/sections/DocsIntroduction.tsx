import {
    Sparkles,
    CheckCircle2,
    Terminal,
    Globe,
    Cpu,
    GitBranch,
    Shield,
    Workflow,
    Zap,
} from 'lucide-react'
import React from 'react'

import { CodeBlock, DocCallout, DocCard, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsIntroduction: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Sparkles className="w-3 h-3" />
                        Autonomous Coding Agent
                    </span>
                    <span className="text-[12px] text-[#71717A]">v0.3 Stable</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Introducing December
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    December is an autonomous AI software engineer, built to help engineering teams
                    plan, generate, test, and ship production-ready applications across cloud and
                    terminal.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Overview */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        About December Agent
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        <strong className="text-[#EDEDEF]">December</strong> pairs codebase
                        intelligence with live, hardware-isolated sandboxes. Instead of offering
                        speculative code completions, December acts as an end-to-end pair engineer:
                        it inspects your directory structure, reads package manifests, executes
                        commands, captures compiler diagnostics, and iterates autonomously until
                        your tests pass.
                    </p>

                    <DocCallout type="tip" title="Cloud & Terminal Synergy">
                        Start tasks locally in your terminal with{' '}
                        <code className="text-[#EDEDEF] font-mono text-[12px]">december</code> and
                        seamlessly hand off complex builds to cloud sandboxes with interactive live
                        previews.
                    </DocCallout>
                </section>

                {/* 2. Core Strengths */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        What are December&apos;s Strengths?
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        December excels across the full software development lifecycle, particularly
                        for tasks that require multi-file coordination and compiler validation:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                        <DocCard
                            icon={Zap}
                            title="Feature Implementation"
                            description="Builds full-stack features from natural language prompts, wiring frontends, backend APIs, schemas, and routes."
                        />
                        <DocCard
                            icon={CheckCircle2}
                            title="Bug Reproduction & Fixes"
                            description="Analyzes stack traces and test logs, traces bug origins across monorepos, and applies surgical AST-safe patches."
                        />
                        <DocCard
                            icon={Cpu}
                            title="Micro-VM Sandboxed Execution"
                            description="Runs every workspace in an isolated micro-VM with dedicated CPU, RAM, and secure reverse WebSocket tunnels."
                        />
                        <DocCard
                            icon={Workflow}
                            title="Self-Healing Compiler Loop"
                            description="Captures TypeScript errors, ESLint diagnostics, and runtime crashes, correcting code autonomously before presenting."
                        />
                        <DocCard
                            icon={GitBranch}
                            title="Git Checkpointing & Time Travel"
                            description="Generates ephemeral commit snapshots on every turn, letting you roll back refactors or branch without risk."
                        />
                        <DocCard
                            icon={Shield}
                            title="Zero Training on Private Code"
                            description="Enterprise data protection guarantees that your proprietary codebase and prompts are never used to train foundational models."
                        />
                    </div>
                </section>

                {/* 3. Two Operating Environments */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Two Operating Environments
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-[#EDEDEF] font-medium text-[14px]">
                                <Globe className="w-4 h-4 text-[#87B2F4]" />
                                Cloud Workspace (Web IDE)
                            </div>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Zero-setup cloud sandbox accessible directly in the browser at{' '}
                                <a
                                    href="https://trydecember.com"
                                    className="text-[#87B2F4] hover:underline"
                                >
                                    trydecember.com
                                </a>
                                . Features split-screen live previews, DOM inspection, branch
                                management, and multi-turn session timeline.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-[#EDEDEF] font-medium text-[14px]">
                                <Terminal className="w-4 h-4 text-[#7FD6B0]" />
                                December CLI (Terminal)
                            </div>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Fast, keyboard-driven terminal user interface (TUI) running directly
                                in your local repository. Bring your own keys or authenticate with
                                your cloud account via{' '}
                                <code className="text-[#EDEDEF] font-mono text-[12px]">
                                    december login
                                </code>
                                .
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. Quick Start Snippet */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Instant Quick Start
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Try December instantly in your terminal without installing:
                    </p>
                    <CodeBlock code="npx @trydecember/cli" language="bash" />
                    <p className="text-[13px] text-[#9A9998]">
                        Or install globally to access the command anywhere:
                    </p>
                    <CodeBlock code="npm install -g @trydecember/cli" language="bash" />
                </section>

                {/* Pagination */}
                {onNavigate && <DocPagination currentTab="Introduction" onNavigate={onNavigate} />}
            </div>
        </div>
    )
}
