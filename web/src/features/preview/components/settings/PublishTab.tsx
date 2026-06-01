import { Rocket, RefreshCw, CheckCircle2 } from 'lucide-react'
import React from 'react'

import { PremiumInput, PremiumToggle } from './SettingsFormControls'

interface PublishTabProps {
    env: string
    setEnv: (val: string) => void
    subDomain: string
    setSubDomain: (val: string) => void
    customDomain: string
    setCustomDomain: (val: string) => void
    pwdProtection: boolean
    setPwdProtection: (val: boolean) => void
    noIndex: boolean
    setNoIndex: (val: boolean) => void
    deploying: boolean
    deployed: boolean
    handleDeploy: () => void
}

export const PublishTab: React.FC<PublishTabProps> = ({
    env,
    setEnv,
    subDomain,
    setSubDomain,
    customDomain,
    setCustomDomain,
    pwdProtection,
    setPwdProtection,
    noIndex,
    setNoIndex,
    deploying,
    deployed,
    handleDeploy,
}) => {
    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
            <h1 className="text-[16px] font-medium mb-3">Publish Application</h1>
            <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                {/* Environment Branch Select */}
                <div className="flex flex-col gap-3 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                        Target Environment
                    </span>
                    <span className="text-[13px] text-[#7B7A79]">
                        Select the deployment target environment branch.
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            {
                                id: 'preview',
                                label: 'Preview',
                                desc: 'Temporary developer test branch',
                            },
                            {
                                id: 'staging',
                                label: 'Staging',
                                desc: 'Pre-production QA sandbox',
                            },
                            {
                                id: 'production',
                                label: 'Production',
                                desc: 'Live public application',
                            },
                        ].map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                onClick={() => setEnv(item.id)}
                                className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-colors outline-none cursor-pointer ${
                                    env === item.id
                                        ? 'bg-[#242323] border-[#383736] text-[#D6D5C9]'
                                        : 'bg-[#1A1918] border-[#2B2A29] text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                }`}
                            >
                                <span className="font-semibold text-[13px] capitalize">
                                    {item.label}
                                </span>
                                <span className="text-[11px] opacity-75">{item.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Deployment Controls */}
                <div className="flex flex-col gap-3 border-t border-[#242323] pt-6 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                        Production Deployment
                    </span>
                    <span className="text-[13px] text-[#7B7A79]">
                        Deploy the active visual workspace to the live global edge sandbox.
                    </span>
                    <div className="p-6 rounded-xl border border-[#242323] bg-[#1A1918]/20 flex flex-col items-center justify-center text-center space-y-4">
                        <Rocket className="w-12 h-12 text-[#7B7A79]" strokeWidth={1.5} />
                        <div className="space-y-1">
                            <span className="block text-[14px] font-semibold text-white">
                                Deploy Live Application
                            </span>
                            <span className="block text-xs text-[#7B7A79] max-w-[400px]">
                                Compile the active visual workspace, bundle files, and push them
                                globally.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleDeploy}
                            disabled={deploying || deployed}
                            className={`rounded-lg px-5 py-2 text-[13px] font-semibold transition-colors outline-none cursor-pointer ${
                                deployed
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : deploying
                                      ? 'bg-[#242323] border border-[#383736] text-[#7B7A79] cursor-not-allowed'
                                      : 'bg-[#E8E7E4] text-[#171615] hover:bg-white'
                            }`}
                        >
                            {deploying ? (
                                <span className="flex items-center gap-1.5 justify-center">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Bundling Assets...</span>
                                </span>
                            ) : deployed ? (
                                <span className="flex items-center gap-1.5 justify-center">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Deployed Successfully!</span>
                                </span>
                            ) : (
                                'Deploy to Production'
                            )}
                        </button>
                    </div>
                </div>

                {/* Domain Settings */}
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-6 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                        Domain Configuration
                    </span>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] text-[#7B7A79]">
                            Your free default system subdomain.
                        </span>
                        <div className="flex gap-2 items-center">
                            <PremiumInput
                                value={subDomain}
                                onChange={(e) => setSubDomain(e.target.value)}
                                className="flex-1"
                            />
                            <span className="text-[13px] text-[#7B7A79] font-mono">
                                .december.dev
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] text-[#7B7A79]">
                            Point your own branded domain name to this build.
                        </span>
                        <PremiumInput
                            value={customDomain}
                            onChange={(e) => setCustomDomain(e.target.value)}
                            placeholder="www.my-awesome-app.com"
                        />
                    </div>
                </div>

                {/* Protection Settings */}
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-6 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                        Access Protection
                    </span>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] text-[#D6D5C9]">Password Protection</span>
                            <span className="text-[12px] text-[#7B7A79]">
                                Require visitors to input a password to view this staging/preview
                                deploy.
                            </span>
                        </div>
                        <PremiumToggle
                            active={pwdProtection}
                            onChange={() => setPwdProtection(!pwdProtection)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] text-[#D6D5C9]">
                                Block Search Indexing
                            </span>
                            <span className="text-[12px] text-[#7B7A79]">
                                Instruct crawlers and search engines to ignore this deployment.
                            </span>
                        </div>
                        <PremiumToggle active={noIndex} onChange={() => setNoIndex(!noIndex)} />
                    </div>
                </div>

                {/* Build Logs Console & History */}
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-6 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                        Terminal Build Logs & History
                    </span>
                    <div className="h-44 bg-[#100E12] rounded-xl border border-[#2B2A29] p-4 font-mono text-[11px] text-green-400 overflow-y-auto space-y-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        <div className="text-neutral-500">[12:02:11] $ bun run build.ts</div>
                        <div>[12:02:12] 🚀 Starting compile loops...</div>
                        <div>[12:02:13] 🗑️ Cleaning dist cache folder...</div>
                        <div>[12:02:15] 📄 Processing components index mappings...</div>
                        <div>[12:02:18] 📦 Bundling 4 JSX modules (vite v5.2)...</div>
                        <div>[12:02:22] ✅ Assets generated: chunk-xbhnt5se.js (1.30 MB)</div>
                        <div className="text-emerald-400 animate-pulse font-bold">
                            [12:02:24] ✅ Deploying to edge... Ready!
                        </div>
                    </div>
                    <div className="p-4 rounded-xl border border-[#2B2A29] bg-[#1A1918]/20 flex items-center justify-between text-[12.5px]">
                        <div className="space-y-0.5">
                            <span className="block text-[#D6D5C9] font-semibold">
                                Last Active Deployment
                            </span>
                            <span className="block text-xs text-[#7B7A79] font-mono">
                                Build ID: dep_xbh726e • 5 minutes ago
                            </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase bg-green-950/40 border border-green-900/30 text-green-400 rounded-xl px-2.5 py-0.5 select-none flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Success
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
