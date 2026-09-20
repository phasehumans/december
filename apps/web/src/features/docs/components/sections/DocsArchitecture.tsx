import { Server, Shield, Cpu, Network, Lock } from 'lucide-react'
import React from 'react'

import { DocCallout, DocCard, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsArchitecture: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Server className="w-3 h-3" />
                        Infrastructure &amp; Security
                    </span>
                    <span className="text-[12px] text-[#71717A]">Hardware-Isolated Linux</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    System Architecture
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    Explore December&apos;s micro-VM sandboxing, execution loops, hardware resource
                    governance, and reverse WebSocket tunneling architecture.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Micro-VM Sandboxes & Isolation */}
                <section className="flex flex-col gap-4">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Micro-VM Sandboxes &amp; Isolation
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Every cloud session operates in an independent, lightweight Linux container
                        with hardware-level resource isolation. The sandbox manages file mutations,
                        bash executions, dependency installations, and development server ports
                        without sharing memory or runtime space with other tenants.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-2">
                            <div className="flex items-center gap-2 text-[#EDEDEF] font-medium text-[14px]">
                                <Cpu className="w-4 h-4 text-[#87B2F4]" />
                                Hardware Quotas &amp; Resource Governance
                            </div>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Containers are provisioned with dedicated CPU, memory, and disk
                                limits via Linux cgroups. Background workers enforce strict timeouts
                                on command executions to prevent runaway processes.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-2">
                            <div className="flex items-center gap-2 text-[#EDEDEF] font-medium text-[14px]">
                                <Network className="w-4 h-4 text-[#7FD6B0]" />
                                Secure Port Forwarding &amp; Live Previews
                            </div>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Development servers (such as Vite, Next.js, or Express) running
                                within the container communicate with the web client through
                                authenticated reverse WebSocket tunnels, preventing public exposure
                                of internal ports.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Compiler & Linter Feedback Loop */}
                <section className="flex flex-col gap-4">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Compiler &amp; Linter Feedback Loop
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Rather than issuing speculative code changes, December relies on a
                        deterministic compiler-in-the-loop validation pipeline:
                    </p>

                    <div className="space-y-2 text-[13.5px] text-[#9A9998]">
                        <div className="p-3.5 rounded-xl border border-[#242323] bg-[#141414] flex gap-3">
                            <span className="font-semibold text-[#87B2F4] shrink-0">
                                Diagnostic Capture:
                            </span>
                            <span>
                                TypeScript compilation errors, ESLint diagnostics, and package
                                manager failures are streamed directly into the agent&apos;s active
                                context.
                            </span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-[#242323] bg-[#141414] flex gap-3">
                            <span className="font-semibold text-[#7FD6B0] shrink-0">
                                Autonomous Correction:
                            </span>
                            <span>
                                When a type or syntax error is encountered, the agent executes
                                targeted patches to resolve the diagnostic before releasing output
                                to the user.
                            </span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-[#242323] bg-[#141414] flex gap-3">
                            <span className="font-semibold text-[#E5A93C] shrink-0">
                                Non-Destructive Diffs:
                            </span>
                            <span>
                                Code edits are applied through AST-aware string replacements and Git
                                tree checkpoints, preventing destructive file truncations.
                            </span>
                        </div>
                    </div>
                </section>

                {/* 3. Security Perimeter */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Sandbox Security Perimeter
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        The December runtime architecture employs strict defense-in-depth:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DocCard
                            icon={Lock}
                            title="Single-Tenant Isolation"
                            description="Each session micro-VM is booted on-demand in its own isolated filesystem namespace with non-root default permissions."
                        />
                        <DocCard
                            icon={Shield}
                            title="Ephemeral Destruction"
                            description="When a session expires or is terminated, all ephemeral container storage and cached runtime artifacts are purged securely."
                        />
                    </div>

                    <DocCallout type="warning" title="Outbound Network Governance">
                        Micro-VM sandboxes permit outbound network traffic to approved package
                        registries (npm, PyPI, Crates.io) and public APIs, but enforce strict rate
                        limits and prevent unauthorized internal network scanning.
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && <DocPagination currentTab="Architecture" onNavigate={onNavigate} />}
            </div>
        </div>
    )
}
