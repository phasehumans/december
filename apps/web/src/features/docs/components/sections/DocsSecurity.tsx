import { ShieldCheck, Lock, Server, CheckCircle2 } from 'lucide-react'
import React from 'react'

import { DocCallout, DocCard, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsSecurity: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Trust &amp; Privacy
                    </span>
                    <span className="text-[12px] text-[#71717A]">Enterprise Security</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Security &amp; Sandboxing Isolation
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    December provides hardware-isolated sandboxes, zero-model-training guarantees,
                    and compliance controls to protect your private code and IP.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Zero Model Training Guarantee */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Zero Model Training Policy
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Your intellectual property belongs exclusively to you. December maintains a
                        strict, unconditional zero-training policy:
                    </p>

                    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[14px]">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            No Model Training on Private Data
                        </div>
                        <p className="text-[13px] text-[#D6D5C9] leading-relaxed">
                            Under no circumstances is your source code, prompt history, repository
                            metadata, or session output used to train, retrain, or fine-tune
                            foundational machine learning models.
                        </p>
                    </div>
                </section>

                {/* 2. Micro-VM Sandbox Isolation */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Hardware-Level Micro-VM Isolation
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Every user workspace operates in an isolated micro-VM environment:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DocCard
                            icon={Server}
                            title="Single-Tenant Containers"
                            description="Each session is provisioned in its own dedicated container. Memory, filesystem, and processes are completely inaccessible to other users."
                        />
                        <DocCard
                            icon={Lock}
                            title="Ephemeral Lifecycle"
                            description="When a session concludes, the container filesystem is shredded and destroyed, leaving no lingering residual data on host servers."
                        />
                    </div>
                </section>

                {/* 3. Google OAuth & Compliance */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        OAuth &amp; Limited Use Compliance
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        December strictly adheres to the{' '}
                        <strong className="text-[#EDEDEF]">
                            Google API Services User Data Policy
                        </strong>
                        , including the Limited Use requirements:
                    </p>

                    <div className="space-y-2 text-[13px] text-[#9A9998]">
                        <p>
                            • Google user data is accessed solely to authenticate user identity and
                            manage authorized cloud sessions.
                        </p>
                        <p>
                            • Data obtained through Google OAuth is never transferred to third
                            parties or used for advertising.
                        </p>
                        <p>
                            • Humans never read your private repository code unless you explicitly
                            request technical support and grant temporary access.
                        </p>
                    </div>

                    <DocCallout type="info" title="Legal Policies">
                        For complete legal documentation, review our{' '}
                        <a href="/privacy" className="text-[#87B2F4] hover:underline">
                            Privacy Policy
                        </a>{' '}
                        and{' '}
                        <a href="/terms" className="text-[#87B2F4] hover:underline">
                            Terms of Service
                        </a>
                        .
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && (
                    <DocPagination currentTab="Security & Isolation" onNavigate={onNavigate} />
                )}
            </div>
        </div>
    )
}
