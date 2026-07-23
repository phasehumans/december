import React from 'react'

export const ProfilePrivacySettings: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-6 border-b border-[#242323] pb-4">
                <h1 className="text-[18px] font-medium text-white mb-1">Privacy Policy</h1>
                <p className="text-[13px] text-[#7B7A79]">
                    Last updated: July 2026 &bull; Your code privacy and data security are our top
                    priorities.
                </p>
            </div>

            {/* Content Sections */}
            <div className="flex flex-col gap-6 text-[13.5px] leading-relaxed text-[#D6D5C9]">
                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        1. Information We Collect
                    </h2>
                    <p className="text-[#A3A29E]">
                        We collect minimal information necessary to deliver our services, including
                        account registration details (email, username, name), connected GitHub
                        account metadata, and session usage telemetry to optimize performance.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        2. Code Privacy & Model Isolation
                    </h2>
                    <p className="text-[#A3A29E]">
                        Your private source code, repository content, environment secrets, and
                        prompts belong exclusively to you.{' '}
                        <strong className="text-white font-medium">
                            We do not sell your code or use your private repositories to train
                            foundation AI models.
                        </strong>
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        3. Data Storage & Security
                    </h2>
                    <p className="text-[#A3A29E]">
                        All data is transmitted via industry-standard TLS encryption and stored in
                        secure, isolated environments. Execution environments operate within
                        isolated sandboxes to ensure user workspace separation.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">
                        4. Integrations & Third Parties
                    </h2>
                    <p className="text-[#A3A29E]">
                        When connecting GitHub, Vercel, Supabase, or other third-party services,
                        tokens are stored securely in encrypted storage. You can disconnect
                        integrations at any time via your Account Settings.
                    </p>
                </section>

                <section className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-medium text-white">5. Your Data Rights</h2>
                    <p className="text-[#A3A29E]">
                        You have the right to request access to, export, or permanently delete your
                        account data and saved sessions at any time through the Account Settings
                        tab.
                    </p>
                </section>

                <section className="flex flex-col gap-2 border-t border-[#242323] pt-4">
                    <h2 className="text-[15px] font-medium text-white">6. Privacy Inquiries</h2>
                    <p className="text-[#A3A29E]">
                        If you have questions or concerns regarding our privacy practices, please
                        contact us at{' '}
                        <a
                            href="mailto:privacy@trydecember.com"
                            className="text-[#87B2F4] hover:underline"
                        >
                            privacy@trydecember.com
                        </a>
                        .
                    </p>
                </section>
            </div>
        </div>
    )
}
