import React from 'react'
import { Figma, Github, Triangle, Network } from 'lucide-react'

interface ProfileIntegrationsSettingsProps {
    isGithubConnected: boolean
    onConnectGithub: () => void
}

const mockRepos = [
    { name: 'phasehumans/web-app', updated: '2 hours ago' },
    { name: 'phasehumans/core-api', updated: '5 hours ago' },
    { name: 'phasehumans/documentation', updated: '1 day ago' },
]

export const ProfileIntegrationsSettings: React.FC<ProfileIntegrationsSettingsProps> = ({
    isGithubConnected,
    onConnectGithub,
}) => {
    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            {/* Integrations Header */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Integrations</h1>

                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Figma */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[#1E1D1B] border border-[#383736] flex items-center justify-center">
                                <Figma className="w-5 h-5 text-[#D6D5C9]" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[14px] text-[#D6D5C9]">Figma</span>
                                <span className="text-[13px] text-[#7B7A79]">
                                    Paste links from Figma into phasehumans.
                                </span>
                            </div>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Connect
                        </button>
                    </div>

                    {/* GitHub */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-[#1E1D1B] border border-[#383736] flex items-center justify-center">
                                    <Github className="w-5 h-5 text-[#D6D5C9]" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[14px] text-[#D6D5C9]">GitHub</span>
                                    <span className="text-[13px] text-[#7B7A79]">
                                        Connect your GitHub account to import repositories.
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={onConnectGithub}
                                className={`px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] transition-colors ${
                                    isGithubConnected
                                        ? 'bg-[#242323] text-[#7B7A79] hover:bg-[#2B2A29]'
                                        : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                }`}
                            >
                                {isGithubConnected ? 'Connected' : 'Connect'}
                            </button>
                        </div>

                        {/* GitHub Repositories Dropdown */}
                        {isGithubConnected && (
                            <div className="flex flex-col ml-[56px] mt-2">
                                <h3 className="text-[13px] font-medium text-[#D6D5C9] mb-3">
                                    Recent Repositories
                                </h3>
                                <div className="flex flex-col border border-[#242323] rounded-lg overflow-hidden bg-[#100E12]">
                                    {mockRepos.map((repo, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between py-2.5 px-4 border-b border-[#242323] last:border-b-0 hover:bg-[#171615] transition-colors"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-medium text-[#D6D5C9]">
                                                    {repo.name}
                                                </span>
                                                <span className="text-[11px] text-[#7B7A79]">
                                                    Updated {repo.updated}
                                                </span>
                                            </div>
                                            <button className="px-3 py-1 rounded-md border border-[#383736] text-[12px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                                                Import
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Environment Variables */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Environment Variables</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[#1E1D1B] border border-[#383736] flex items-center justify-center">
                                <Triangle className="w-4 h-4 text-[#D6D5C9] fill-current" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[14px] text-[#D6D5C9]">
                                    Environment Variables
                                </span>
                                <span className="text-[13px] text-[#7B7A79]">
                                    View and manage environment variables on Vercel.
                                </span>
                            </div>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Open in Vercel
                        </button>
                    </div>
                </div>
            </div>

            {/* MCP Connections */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">MCP Connections</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    <div className="w-full rounded-xl border border-dashed border-[#383736] py-16 flex flex-col items-center justify-center gap-4 transition-colors hover:border-[#4A4948] bg-[#100E12]/30">
                        <Network className="w-5 h-5 text-[#7B7A79]" />
                        <span className="text-[14px] text-[#7B7A79]">No MCPs connected</span>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors mt-1">
                            Add MCP
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
