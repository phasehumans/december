import React from 'react'

export const DocsArchitecture: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-6">
                <h1 className="text-[16px] font-medium text-[#EDEDEF] mb-1">System Architecture</h1>
                <p className="text-[13.5px] text-[#9A9998]">
                    Micro-VM sandboxing, execution loops, and security design.
                </p>
            </div>

            <div className="flex flex-col gap-6 border-t border-[#242323] pt-5">
                {/* 1. Micro-VM Sandboxes & Isolation */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        1. Micro-VM Sandboxes & Isolation
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Every cloud session operates in an independent, lightweight Linux container
                        with hardware-level resource isolation. The sandbox manages file mutations,
                        bash executions, dependency installations, and development server ports
                        without sharing memory or runtime space with other tenants.
                    </p>
                    <div className="space-y-3 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                A. Hardware Quotas & Resource Governance
                            </h3>
                            <p>
                                Containers are provisioned with dedicated CPU, memory, and disk
                                limits via Linux cgroups. Background workers enforce strict timeouts
                                on command executions to prevent runaway processes.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                B. Secure Port Forwarding & Live Previews
                            </h3>
                            <p>
                                Development servers (such as Vite, Next.js, or Express) running
                                within the container communicate with the web client through
                                authenticated reverse WebSocket tunnels, preventing public exposure
                                of internal ports.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Compiler & Linter Feedback Loop */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        2. Compiler & Linter Feedback Loop
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Rather than issuing speculative code changes, December relies on a
                        deterministic compiler-in-the-loop validation pipeline:
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 text-[13.5px] text-[#9A9998] pl-1">
                        <li>
                            <strong className="text-[#D6D5C9]">Diagnostic Capture:</strong>{' '}
                            TypeScript compilation errors, ESLint diagnostics, and package manager
                            failures are streamed directly into the agent&apos;s active context.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9]">Autonomous Correction:</strong> When
                            a type or syntax error is encountered, the agent executes targeted
                            patches to resolve the diagnostic before releasing output to the user.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9]">Non-Destructive Diffs:</strong> Code
                            edits are applied through AST-aware string replacements and Git tree
                            checkpoints, preventing destructive file truncations.
                        </li>
                    </ul>
                </section>

                {/* 3. Checkpointing & Context Compression */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        3. Checkpointing & Context Compression
                    </h2>
                    <div className="space-y-3 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                Git Checkpointing & Undo System
                            </h3>
                            <p>
                                Every agent turn creates an ephemeral Git commit snapshot.
                                Developers can step backward through prompt turns or undo specific
                                refactors with complete fidelity.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                Token Pruning & Prompt Caching
                            </h3>
                            <p>
                                Historical terminal command outputs and repetitive tool payloads are
                                systematically compressed into concise summaries, keeping
                                conversations within model attention boundaries while lowering
                                latency.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. Security & Tenant Separation */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        4. Security & Tenant Separation
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        User secrets, API keys, and repository credentials are encrypted at rest
                        with AES-256 and transmitted exclusively over TLS. Sensitive keys are
                        stripped from client-facing telemetry and never used to train third-party
                        foundation models.
                    </p>
                </section>
            </div>
        </div>
    )
}
