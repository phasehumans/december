import React from 'react'

export const DocsIntroduction: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-6">
                <h1 className="text-[16px] font-medium text-[#EDEDEF] mb-1">
                    About December Agent
                </h1>
                <p className="text-[13.5px] text-[#9A9998]">
                    Autonomous AI software engineering platform for terminal and cloud.
                </p>
            </div>

            <div className="flex flex-col gap-6 border-t border-[#242323] pt-5">
                {/* 1. Overview & Purpose */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        1. Platform Overview & Purpose
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        <strong className="text-[#D6D5C9]">December</strong> is an autonomous AI
                        software engineering platform and cloud workspace designed to plan,
                        generate, build, test, and deploy full-stack applications. It transforms
                        natural language prompts, bug reports, and architectural specifications into
                        production-ready software by pairing codebase intelligence with live
                        sandboxed execution.
                    </p>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Whether working from your terminal or in the browser, December provides
                        continuous execution, automated compiler recovery, and real-time preview
                        environments.
                    </p>
                </section>

                {/* 2. Core Capabilities */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        2. Core Platform Capabilities
                    </h2>
                    <div className="space-y-3 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                A. Autonomous Codebase Navigation
                            </h3>
                            <p>
                                The agent inspects directory hierarchies, parses abstract syntax
                                trees (AST), resolves imports across monorepos, and performs
                                surgical non-destructive diffs across multiple files simultaneously.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                B. Micro-VM Sandboxed Execution
                            </h3>
                            <p>
                                Every user workspace runs inside a dedicated, hardware-isolated
                                micro-VM container. The container manages package dependencies,
                                executes shell commands, runs database migrations, and exposes
                                preview ports securely.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                C. Terminal & Cloud Synergy
                            </h3>
                            <p>
                                Operate directly in local repositories using the December CLI or
                                work in the zero-config web cloud workspace. Sessions can be forked,
                                shared, or handed off between local machines and cloud sandboxes.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                D. Live Previews & Hot Reload
                            </h3>
                            <p>
                                Full-stack dev servers (Next.js, Vite, Node, Python) run inside the
                                container, streaming instant interactive previews with DOM element
                                inspection and runtime error telemetry.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Execution Environments */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        3. Execution Environments
                    </h2>
                    <div className="space-y-3 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                Cloud Workspace (Web)
                            </h3>
                            <p>
                                Accessible through{' '}
                                <a
                                    href="https://trydecember.com"
                                    className="text-[#87B2F4] hover:underline"
                                >
                                    https://trydecember.com
                                </a>
                                . Provides a web-native IDE with interactive chat, live preview
                                split-screen, version timeline, GitHub synchronization, and team
                                sharing.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                December CLI (Terminal)
                            </h3>
                            <p>
                                A keyboard-driven terminal user interface (TUI) powered by Ink and
                                Node.js. Run tasks locally in your current Git repo, bring your own
                                API keys (BYOK), or trigger background cloud jobs with handoff.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. The Agent Decision Loop */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        4. The Agent Decision Loop
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        December executes an autonomous multi-turn control loop to guarantee code
                        correctness:
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 text-[13.5px] text-[#9A9998] pl-1">
                        <li>
                            <strong className="text-[#D6D5C9]">Inspect:</strong> Reads relevant
                            files, scans dependencies, and gathers workspace diagnostic context.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9]">Plan:</strong> Outlines atomic code
                            modifications, architectural decisions, and required bash commands.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9]">Execute:</strong> Applies targeted
                            file edits, installs packages, and runs build scripts in the sandbox.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9]">Verify:</strong> Traps compiler
                            errors, linter warnings, and runtime exceptions to autonomously
                            self-correct before presenting changes.
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    )
}
