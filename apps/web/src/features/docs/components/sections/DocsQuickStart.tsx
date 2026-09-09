import React from 'react'

export const DocsQuickStart: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-6">
                <h1 className="text-[16px] font-medium text-[#EDEDEF] mb-1">
                    Getting Started with December
                </h1>
                <p className="text-[13.5px] text-[#9A9998]">
                    Step-by-step walkthrough for cloud workspace and terminal CLI.
                </p>
            </div>

            <div className="flex flex-col gap-6 border-t border-[#242323] pt-5">
                {/* 1. Cloud Workspace Walkthrough */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        1. Cloud Workspace Walkthrough
                    </h2>
                    <div className="space-y-3 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                A. Starting a Session
                            </h3>
                            <p>
                                Navigate to the home dashboard and enter a natural language prompt
                                describing what you want to build. You can also pick a starter
                                template (React, Next.js, Node, Vite) or connect your GitHub account
                                to import an existing repository.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                B. Prompting & Context Mentions
                            </h3>
                            <p>
                                Provide detailed specifications, user stories, or bug reports. Type{' '}
                                <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12.5px] font-mono">
                                    @
                                </code>{' '}
                                in the prompt input to attach repository files, existing sessions,
                                or stored environment secrets directly into the agent&apos;s
                                context.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[13.5px] font-medium text-[#EDEDEF] mb-0.5">
                                C. Inspecting Code & Live Previews
                            </h3>
                            <p>
                                Once invoked, the agent provisions a micro-VM, boots the development
                                server, and streams code edits. You can interact with the live
                                application in the preview window, inspect file changes in the code
                                viewer, or download the full workspace bundle.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Terminal CLI Installation */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        2. Terminal CLI Installation & Setup
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        December can also run natively in your local terminal environment. Install
                        the CLI globally using either npm or curl:
                    </p>

                    <div className="space-y-2 pt-1">
                        <p className="text-[13px] text-[#EDEDEF] font-medium">Using npm:</p>
                        <div className="bg-[#111111] border border-[#242323] rounded-md px-3 py-2 font-mono text-[12.5px] text-[#7FD6B0] select-all">
                            npm install -g @trydecember/cli
                        </div>

                        <p className="text-[13px] text-[#EDEDEF] font-medium pt-1">
                            Using curl (standalone installer):
                        </p>
                        <div className="bg-[#111111] border border-[#242323] rounded-md px-3 py-2 font-mono text-[12.5px] text-[#7FD6B0] select-all">
                            curl -fsSL https://trydecember.com/install.sh | bash
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <p>
                            <strong className="text-[#D6D5C9]">Authentication:</strong> Run{' '}
                            <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12.5px] font-mono">
                                december login
                            </code>{' '}
                            to link your terminal device to your December account via an automated
                            browser handshake.
                        </p>
                        <p>
                            <strong className="text-[#D6D5C9]">Launching the Agent:</strong> Run{' '}
                            <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12.5px] font-mono">
                                december
                            </code>{' '}
                            in any directory to start an interactive TUI session with Git context
                            tracking.
                        </p>
                    </div>
                </section>

                {/* 3. Starter Templates & Repositories */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        3. Repositories & Workspaces
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        To work with your GitHub repositories, connect your account from{' '}
                        <a
                            href="https://trydecember.com/settings/connections"
                            className="text-[#87B2F4] hover:underline"
                        >
                            Settings &gt; Connections
                        </a>
                        . The December GitHub App requests minimum permissions required to clone,
                        branch, and open pull requests on the specific repositories you authorize.
                    </p>
                </section>
            </div>
        </div>
    )
}
