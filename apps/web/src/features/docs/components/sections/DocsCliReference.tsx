import React from 'react'

export const DocsCliReference: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-6">
                <h1 className="text-[16px] font-medium text-[#EDEDEF] mb-1">
                    December CLI Reference
                </h1>
                <p className="text-[13.5px] text-[#9A9998]">
                    Command line arguments, interactive slash commands, and configuration.
                </p>
            </div>

            <div className="flex flex-col gap-6 border-t border-[#242323] pt-5">
                {/* 1. Core CLI Commands */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        1. Standalone CLI Commands
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        These commands can be executed directly from your terminal shell:
                    </p>

                    <div className="space-y-3 pt-1 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <div>
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december login
                            </code>
                            <p className="mt-0.5">
                                Authenticates your terminal device with your December account via an
                                automated browser handshake and stores the resulting session token.
                            </p>
                        </div>

                        <div>
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december
                            </code>
                            <p className="mt-0.5">
                                Launches the interactive terminal user interface (TUI) in the
                                current working directory, indexing local Git repository context.
                            </p>
                        </div>

                        <div>
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december docs [section]
                            </code>
                            <p className="mt-0.5">
                                Opens December documentation directly in your default web browser.
                                Deep links to specific subpages when an argument is provided (e.g.{' '}
                                <code className="text-[#EDEDEF] font-mono text-[12px]">
                                    december docs cli
                                </code>
                                ).
                            </p>
                        </div>

                        <div>
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december update
                            </code>
                            <p className="mt-0.5">
                                Checks for the latest version of{' '}
                                <code className="text-[#EDEDEF] font-mono text-[12px]">
                                    @trydecember/cli
                                </code>{' '}
                                on npm and updates the global installation.
                            </p>
                        </div>

                        <div>
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december --help
                            </code>
                            <p className="mt-0.5">
                                Displays all available CLI flags, model overrides, logging options,
                                and command help text.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Interactive Slash Commands */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        2. Interactive Slash Commands
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Type a forward slash (
                        <code className="text-[#EDEDEF] font-mono text-[12px]">/</code>) inside the
                        TUI input bar to open the command palette:
                    </p>

                    <ul className="list-disc list-inside space-y-1.5 text-[13.5px] text-[#9A9998] pl-1">
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                /docs:
                            </strong>{' '}
                            Opens December web documentation in your default browser.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                /clear:
                            </strong>{' '}
                            Clears conversation history and resets active context memory.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                /handoff:
                            </strong>{' '}
                            Archives the local workspace and uploads it to an isolated cloud
                            micro-VM.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                /fork:
                            </strong>{' '}
                            Branches the current session into a new conversation thread.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                /copy:
                            </strong>{' '}
                            Copies the last agent response to your system clipboard.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                /grill-me:
                            </strong>{' '}
                            Interviews the developer interactively to clarify requirements before
                            generating code.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                /exit:
                            </strong>{' '}
                            Gracefully closes the terminal session.
                        </li>
                    </ul>
                </section>

                {/* 3. Keyboard Shortcuts */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        3. Keyboard Shortcuts
                    </h2>
                    <ul className="list-disc list-inside space-y-1.5 text-[13.5px] text-[#9A9998] pl-1">
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                Ctrl + C:
                            </strong>{' '}
                            Cancels active model generation or ongoing tool execution.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">
                                Ctrl + O:
                            </strong>{' '}
                            Toggles display of model thinking traces in the message list.
                        </li>
                        <li>
                            <strong className="text-[#D6D5C9] font-mono text-[12.5px]">Tab:</strong>{' '}
                            Autocompletes highlighted command or file mention in the prompt bar.
                        </li>
                    </ul>
                </section>

                {/* 4. Configuration Storage */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-[14px] font-medium text-[#EDEDEF]">
                        4. Configuration & Token Storage
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        The CLI stores user authentication credentials, BYOK API keys, and provider
                        preferences locally at:
                    </p>
                    <div className="bg-[#111111] border border-[#242323] rounded-md px-3 py-2 font-mono text-[12.5px] text-[#D6D5C9] select-all">
                        ~/.december/config.json
                    </div>
                </section>
            </div>
        </div>
    )
}
