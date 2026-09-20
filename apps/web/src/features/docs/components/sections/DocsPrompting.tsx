import { Lightbulb, Check, X } from 'lucide-react'
import React from 'react'

import { CodeBlock, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsPrompting: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lightbulb className="w-3 h-3" />
                        Best Practices
                    </span>
                    <span className="text-[12px] text-[#71717A]">Prompt Engineering</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Prompting &amp; Instructions Guide
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    December excels when given clear specifications, explicit file references, and
                    concrete verification criteria. Learn how to structure prompts for maximum
                    efficiency.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Prompt Anatomy */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        The Anatomy of an Effective Prompt
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        High-performing instructions typically combine four core ingredients:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1.5">
                            <span className="text-[12px] font-semibold text-[#87B2F4] uppercase tracking-wider">
                                1. Objective
                            </span>
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">Clear Goal</h3>
                            <p className="text-[13px] text-[#9A9998]">
                                What should be built, fixed, or refactored? State the user-facing or
                                architectural outcome directly.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1.5">
                            <span className="text-[12px] font-semibold text-[#7FD6B0] uppercase tracking-wider">
                                2. Context (@)
                            </span>
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                File References
                            </h3>
                            <p className="text-[13px] text-[#9A9998]">
                                Reference exact file paths or use{' '}
                                <code className="text-[#EDEDEF] font-mono text-[12px]">@file</code>{' '}
                                so the agent starts in the right spot.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1.5">
                            <span className="text-[12px] font-semibold text-[#E5A93C] uppercase tracking-wider">
                                3. Constraints
                            </span>
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">Boundaries</h3>
                            <p className="text-[13px] text-[#9A9998]">
                                Specify libraries to use, backwards-compatibility requirements, and
                                design conventions.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-1.5">
                            <span className="text-[12px] font-semibold text-[#C084FC] uppercase tracking-wider">
                                4. Verification
                            </span>
                            <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                                Acceptance Test
                            </h3>
                            <p className="text-[13px] text-[#9A9998]">
                                Tell December how to verify success: run a test script, verify
                                compiler output, or check browser behaviour.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Good vs. Bad Prompts */}
                <section className="flex flex-col gap-4">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Good vs. Bad Instructions
                    </h2>

                    {/* Example 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
                            <div className="flex items-center gap-2 text-red-400 font-medium text-[13.5px]">
                                <X className="w-4 h-4" />
                                Vague / Suboptimal
                            </div>
                            <p className="text-[13px] text-[#EDEDEF] font-mono bg-[#0E0E0E] p-2.5 rounded-lg border border-[#242323]">
                                &quot;Fix the broken auth in my app.&quot;
                            </p>
                            <p className="text-[12.5px] text-[#9A9998]">
                                Lacks error messages, reproduction steps, or the relevant auth files
                                to look at.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-medium text-[13.5px]">
                                <Check className="w-4 h-4" />
                                Specific &amp; Actionable
                            </div>
                            <p className="text-[13px] text-[#EDEDEF] font-mono bg-[#0E0E0E] p-2.5 rounded-lg border border-[#242323]">
                                &quot;In @src/features/auth/auth.service.ts, fix the 401 uncaught
                                error on token expiration. Add automatic token refresh and verify by
                                running bun test auth.service.test.ts.&quot;
                            </p>
                            <p className="text-[12.5px] text-[#9A9998]">
                                Specifies file, exact failure mode, expected behavior, and test
                                verification command.
                            </p>
                        </div>
                    </div>

                    {/* Example 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
                            <div className="flex items-center gap-2 text-red-400 font-medium text-[13.5px]">
                                <X className="w-4 h-4" />
                                Vague / Suboptimal
                            </div>
                            <p className="text-[13px] text-[#EDEDEF] font-mono bg-[#0E0E0E] p-2.5 rounded-lg border border-[#242323]">
                                &quot;Make the dashboard faster.&quot;
                            </p>
                            <p className="text-[12.5px] text-[#9A9998]">
                                The agent cannot identify what metric matters (bundle size, query
                                latency, render time).
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-medium text-[13.5px]">
                                <Check className="w-4 h-4" />
                                Specific &amp; Actionable
                            </div>
                            <p className="text-[13px] text-[#EDEDEF] font-mono bg-[#0E0E0E] p-2.5 rounded-lg border border-[#242323]">
                                &quot;Profile the database queries in @src/server/routes/stats.ts.
                                Add an index on createdAt in the Prisma schema, generate the
                                migration, and verify response time drops below 50ms.&quot;
                            </p>
                            <p className="text-[12.5px] text-[#9A9998]">
                                Identifies the route, proposes the concrete database solution, and
                                states the latency goal.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Context Mentions (@) */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Using @ Context Mentions
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        In either the cloud input box or the terminal CLI, typing{' '}
                        <code className="text-[#EDEDEF] bg-[#1E1E1E] px-1.5 py-0.5 rounded font-mono text-[12.5px]">
                            @
                        </code>{' '}
                        opens a context picker:
                    </p>

                    <div className="space-y-2 text-[13px] text-[#9A9998]">
                        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-[#242323] bg-[#141414]">
                            <code className="text-[#87B2F4] font-mono font-medium">@filename</code>
                            <span>
                                Injects the content and AST summary of that specific file into the
                                prompt context.
                            </span>
                        </div>
                        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-[#242323] bg-[#141414]">
                            <code className="text-[#7FD6B0] font-mono font-medium">@directory</code>
                            <span>
                                Traverses and indexes all files within the directory without loading
                                heavy binaries.
                            </span>
                        </div>
                        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-[#242323] bg-[#141414]">
                            <code className="text-[#E5A93C] font-mono font-medium">
                                @secret:KEY
                            </code>
                            <span>
                                References an environment secret securely inside the micro-VM
                                without exposing raw tokens in chat.
                            </span>
                        </div>
                    </div>
                </section>

                {/* 4. Cheat Sheet Templates */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Prompt Templates Cheat Sheet
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Copy and adapt these battle-tested templates for your own workflows:
                    </p>

                    <div className="space-y-4">
                        <div>
                            <span className="text-[13px] font-medium text-[#EDEDEF] block mb-1">
                                1. Feature Implementation Template
                            </span>
                            <CodeBlock
                                language="markdown"
                                code={`Implement [Feature Name] in [Component/Route Path].
Requirements:
- Add UI matching [existing design system / components]
- Connect to [API endpoint or database table]
- Handle loading, error, and empty states
- Verify by running [test command or inspecting live preview]`}
                            />
                        </div>

                        <div>
                            <span className="text-[13px] font-medium text-[#EDEDEF] block mb-1">
                                2. Bug Reproduction &amp; Patch Template
                            </span>
                            <CodeBlock
                                language="markdown"
                                code={`Fix the following bug reported in [Route/Component]:
Error message / Stack trace: [Paste stack trace here]
Expected behavior: [Describe desired result]
Relevant files: @[path/to/file1] @[path/to/file2]
Verification: Write a unit test replicating this issue and ensure it passes.`}
                            />
                        </div>
                    </div>
                </section>

                {/* Pagination */}
                {onNavigate && (
                    <DocPagination currentTab="Prompting Guide" onNavigate={onNavigate} />
                )}
            </div>
        </div>
    )
}
