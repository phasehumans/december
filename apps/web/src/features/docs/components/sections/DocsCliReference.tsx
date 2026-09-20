import { Terminal } from 'lucide-react'
import React from 'react'

import { DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsCliReference: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Terminal className="w-3 h-3" />
                        Developer Tooling
                    </span>
                    <span className="text-[12px] text-[#71717A]">@trydecember/cli</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    December CLI Reference
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    Command line arguments, authentication workflows, environment variables, and
                    interactive keyboard shortcuts for the December terminal agent.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Core Commands */}
                <section className="flex flex-col gap-4">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Core CLI Commands
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Execute these commands from any terminal shell:
                    </p>

                    <div className="space-y-3 pt-1 text-[13.5px] text-[#9A9998] leading-relaxed">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1">
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december login
                            </code>
                            <p className="mt-0.5">
                                Authenticates your terminal device with your December account via an
                                automated browser handshake and stores your session token locally.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1">
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december
                            </code>
                            <p className="mt-0.5">
                                Launches the interactive terminal user interface (TUI) in the
                                current working directory, indexing local Git repository context.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1">
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

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1">
                            <code className="text-[#87B2F4] font-medium text-[13px] font-mono">
                                december update
                            </code>
                            <p className="mt-0.5">
                                Checks for the latest version of{' '}
                                <code className="text-[#EDEDEF] font-mono text-[12px]">
                                    @trydecember/cli
                                </code>{' '}
                                on npm and updates your global installation.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1">
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

                {/* 2. CLI Flags */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Command Line Flags &amp; Options
                    </h2>
                    <div className="overflow-x-auto rounded-xl border border-[#242323] bg-[#141414]">
                        <table className="w-full text-left text-[13px]">
                            <thead className="border-b border-[#242323] text-[#EDEDEF] font-medium bg-[#181818]">
                                <tr>
                                    <th className="p-3">Flag</th>
                                    <th className="p-3">Description</th>
                                    <th className="p-3">Default</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#242323] text-[#9A9998] font-mono text-[12.5px]">
                                <tr>
                                    <td className="p-3 text-[#87B2F4]">--model &lt;name&gt;</td>
                                    <td className="p-3 font-sans">
                                        Override default LLM provider or model tier
                                    </td>
                                    <td className="p-3 text-[#71717A]">auto</td>
                                </tr>
                                <tr>
                                    <td className="p-3 text-[#87B2F4]">--workdir &lt;path&gt;</td>
                                    <td className="p-3 font-sans">
                                        Set root working directory for the agent
                                    </td>
                                    <td className="p-3 text-[#71717A]">process.cwd()</td>
                                </tr>
                                <tr>
                                    <td className="p-3 text-[#87B2F4]">--verbose</td>
                                    <td className="p-3 font-sans">
                                        Enable detailed execution logs &amp; debug traces
                                    </td>
                                    <td className="p-3 text-[#71717A]">false</td>
                                </tr>
                                <tr>
                                    <td className="p-3 text-[#87B2F4]">--cloud</td>
                                    <td className="p-3 font-sans">
                                        Dispatch task to remote cloud micro-VM instead of local
                                    </td>
                                    <td className="p-3 text-[#71717A]">false</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 3. Keyboard Shortcuts */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Keyboard Shortcuts
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Control the TUI with these convenient keyboard shortcuts:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px]">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[#242323] bg-[#141414]">
                            <span className="text-[#9A9998]">Trigger command palette</span>
                            <kbd className="px-2 py-0.5 rounded bg-[#202020] text-[#EDEDEF] font-mono text-[12px] border border-[#2D2D2D]">
                                /
                            </kbd>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[#242323] bg-[#141414]">
                            <span className="text-[#9A9998]">Cancel current generation</span>
                            <kbd className="px-2 py-0.5 rounded bg-[#202020] text-[#EDEDEF] font-mono text-[12px] border border-[#2D2D2D]">
                                Ctrl + C
                            </kbd>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[#242323] bg-[#141414]">
                            <span className="text-[#9A9998]">Clear terminal screen</span>
                            <kbd className="px-2 py-0.5 rounded bg-[#202020] text-[#EDEDEF] font-mono text-[12px] border border-[#2D2D2D]">
                                Ctrl + L
                            </kbd>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[#242323] bg-[#141414]">
                            <span className="text-[#9A9998]">Cycle prompt history</span>
                            <kbd className="px-2 py-0.5 rounded bg-[#202020] text-[#EDEDEF] font-mono text-[12px] border border-[#2D2D2D]">
                                Up / Down
                            </kbd>
                        </div>
                    </div>
                </section>

                {/* Pagination */}
                {onNavigate && <DocPagination currentTab="CLI Reference" onNavigate={onNavigate} />}
            </div>
        </div>
    )
}
