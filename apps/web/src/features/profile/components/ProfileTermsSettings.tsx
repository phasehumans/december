import React from 'react'

export const ProfileTermsSettings: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-6 border-b border-[#242323] pb-4">
                <h1 className="text-[18px] font-medium text-white mb-1">Terms of Service</h1>
                <p className="text-[13px] text-[#7B7A79]">
                    Last updated: July 2026 &bull; Please read these terms carefully before using
                    December.
                </p>
            </div>

            {/* Content Sections */}
            <div className="flex flex-col gap-6 text-[13.5px] leading-relaxed text-[#D6D5C9]">
                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">1. Acceptance of Terms</h2>
                    <p className="text-[#A3A29E]">
                        By accessing or using December ("Platform", "Service"), provided by Phase
                        Humans Inc., you agree to be bound by these Terms of Service. If you do not
                        agree to all terms, you may not use or access the platform.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        2. Platform & AI Services
                    </h2>
                    <p className="text-[#A3A29E]">
                        December is an AI-driven software development workspace enabling code
                        generation, architecture planning, isolated execution environments, and
                        workflow automation. You understand that AI-generated output is provided on
                        an "as-is" basis and should be reviewed prior to production deployment.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        3. Ownership & Intellectual Property
                    </h2>
                    <p className="text-[#A3A29E]">
                        You retain full ownership of all code, repositories, prompts, and assets you
                        create or import into December. We claim no ownership over your code or
                        intellectual property.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        4. Acceptable Use & Conduct
                    </h2>
                    <p className="text-[#A3A29E]">
                        You agree not to use the Service for illegal activities, reverse-engineering
                        sandbox infrastructure, bypassing rate limits, or generating malicious
                        software. Misuse of execution environments or automated API agents may
                        result in account termination.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        5. Service Availability & Modifications
                    </h2>
                    <p className="text-[#A3A29E]">
                        We continuously update and optimize December. While we strive for maximum
                        uptime, features or services may be updated, scheduled for maintenance, or
                        modified with reasonable notice when possible.
                    </p>
                </section>

                <section className="flex flex-col gap-2 border-t border-[#242323] pt-4">
                    <h2 className="text-[15px] font-medium text-white">6. Contact & Inquiries</h2>
                    <p className="text-[#A3A29E]">
                        If you have any questions regarding these Terms of Service, please contact
                        our team at{' '}
                        <a
                            href="mailto:support@trydecember.com"
                            className="text-[#87B2F4] hover:underline"
                        >
                            support@trydecember.com
                        </a>
                        .
                    </p>
                </section>
            </div>
        </div>
    )
}
