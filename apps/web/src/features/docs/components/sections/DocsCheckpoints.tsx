import { GitCommit, History, RotateCcw, GitBranch } from 'lucide-react'
import React from 'react'

import { CodeBlock, DocCallout, DocCard, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsCheckpoints: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <GitCommit className="w-3 h-3" />
                        Version Control
                    </span>
                    <span className="text-[12px] text-[#71717A]">Zero-Risk Experimentation</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Git Checkpointing &amp; Time Travel
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    December safeguards your codebase with atomic Git commit checkpoints on every
                    prompt turn. Step backward through time, review diffs, or undo refactors without
                    losing work.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. How Checkpointing Works */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Ephemeral Snapshots on Every Turn
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Whenever December initiates a task, it establishes a shadow Git checkpoint.
                        Before applying any edits, the current state of the workspace is recorded.
                        When the agent finishes, a clean ephemeral commit documents all changed
                        files, additions, and deletions.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                        <DocCard
                            icon={History}
                            title="Turn-by-Turn History"
                            description="Each user prompt and agent response creates an independent state checkpoint in the session timeline."
                        />
                        <DocCard
                            icon={RotateCcw}
                            title="Instant Rollbacks"
                            description="Revert single turns or rewind back to any prior state with one click or a quick terminal command."
                        />
                        <DocCard
                            icon={GitBranch}
                            title="Branch Isolation"
                            description="Your active working directory or default Git branch is shielded from partial or broken intermediate states."
                        />
                    </div>
                </section>

                {/* 2. Reverting in Cloud vs. CLI */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Reverting and Undoing Changes
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-2">
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                In the Cloud Workspace
                            </h3>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Use the timeline in the chat pane to view past turns. Click the
                                &quot;Rewind to this checkpoint&quot; button on any past turn to
                                instantly restore the micro-VM filesystem to that exact snapshot.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-2">
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                In the Terminal CLI
                            </h3>
                            <p className="text-[13px] text-[#9A9998] leading-relaxed">
                                Type{' '}
                                <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12px] font-mono">
                                    /undo
                                </code>{' '}
                                in the prompt input to rollback the most recent turn, or{' '}
                                <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded text-[12px] font-mono">
                                    /diff
                                </code>{' '}
                                to preview unstaged modifications before committing.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Exporting to GitHub */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        GitHub Pull Requests &amp; Branch Handoff
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        When you are satisfied with the implementation, December can package your
                        checkpoint commits into a clean Git branch and open a pull request directly
                        to your GitHub repository.
                    </p>

                    <CodeBlock
                        filename="Terminal (or Cloud Export)"
                        language="bash"
                        code={`# Review the clean cumulative diff
december /diff

# Generate conventional commit and push branch
december /commit -m "feat(search): add debounced search filter to session list"

# Open PR on GitHub
december /pr`}
                    />

                    <DocCallout type="tip" title="Non-Destructive AST Safety">
                        December never replaces files blindly. By computing AST replacement ranges,
                        it preserves existing comments, code formatting, and adjacent functions.
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && (
                    <DocPagination currentTab="Git Checkpoints" onNavigate={onNavigate} />
                )}
            </div>
        </div>
    )
}
