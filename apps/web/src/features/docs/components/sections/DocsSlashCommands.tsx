import { Command } from 'lucide-react'
import React from 'react'

import { DocCallout, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsSlashCommands: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Command className="w-3 h-3" />
                        Command Palette
                    </span>
                    <span className="text-[12px] text-[#71717A]">Slash Directives</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Interactive Slash Commands
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    Trigger workflow actions, switch models, run test suites, and manage context
                    directly inside the terminal TUI or cloud prompt input.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Using Slash Commands */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        How Slash Commands Work
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Whenever you enter a forward slash (
                        <code className="text-[#EDEDEF] font-mono text-[12.5px] bg-[#1E1E1E] px-1.5 py-0.5 rounded">
                            /
                        </code>
                        ) as the first character of your prompt, December opens an auto-completing
                        command palette. Use your arrow keys to select a command, or type the full
                        name.
                    </p>
                </section>

                {/* 2. Slash Commands Table */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Command Reference
                    </h2>
                    <div className="overflow-x-auto rounded-xl border border-[#242323] bg-[#141414]">
                        <table className="w-full text-left text-[13px]">
                            <thead className="border-b border-[#242323] text-[#EDEDEF] font-medium bg-[#181818]">
                                <tr>
                                    <th className="p-3">Command</th>
                                    <th className="p-3">Action &amp; Description</th>
                                    <th className="p-3">Example Usage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#242323] text-[#9A9998]">
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /plan
                                    </td>
                                    <td className="p-3">
                                        Instructs December to create an architectural plan and
                                        confirm implementation steps before writing files.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /plan add stripe billing
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /test
                                    </td>
                                    <td className="p-3">
                                        Executes the repository&apos;s unit or integration test
                                        suite and streams failures to the agent for auto-repair.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /test auth.test.ts
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /diff
                                    </td>
                                    <td className="p-3">
                                        Prints a unified, colored Git diff of all unstaged file
                                        mutations generated during the session.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /diff
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /commit
                                    </td>
                                    <td className="p-3">
                                        Generates a standardized conventional commit message and
                                        commits staged changes to your Git branch.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /commit
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /compact
                                    </td>
                                    <td className="p-3">
                                        Prunes redundant historical terminal tool outputs and
                                        summarizes conversation context to free token limits.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /compact
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /model
                                    </td>
                                    <td className="p-3">
                                        Switches the underlying reasoning model tier mid-flight
                                        without terminating your active session.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /model gemini-2.5-pro
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /undo
                                    </td>
                                    <td className="p-3">
                                        Rolls back file changes from the most recent prompt turn
                                        using the ephemeral Git snapshot.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /undo
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /clear
                                    </td>
                                    <td className="p-3">
                                        Clears the terminal viewport buffer and resets the visual
                                        screen.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /clear
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-mono text-[#87B2F4] font-medium">
                                        /docs
                                    </td>
                                    <td className="p-3">
                                        Opens the official December documentation in your default
                                        web browser.
                                    </td>
                                    <td className="p-3 font-mono text-[12px] text-[#7FD6B0]">
                                        /docs cli
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 3. Pro Tips */}
                <section className="flex flex-col gap-3">
                    <DocCallout type="tip" title="Combining Directives with Prompts">
                        You can chain slash commands with specific task descriptions, for example:{' '}
                        <code className="text-[#EDEDEF] font-mono text-[12px]">
                            /plan refactor state management to zustand
                        </code>
                        . December will build the implementation spec first and wait for your green
                        light before mutating files.
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && (
                    <DocPagination currentTab="Slash Commands" onNavigate={onNavigate} />
                )}
            </div>
        </div>
    )
}
