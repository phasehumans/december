import { Rocket, RefreshCw, Github, ExternalLink } from 'lucide-react'
import React from 'react'

interface PublishTabProps {
    deploying: boolean
    deployed: boolean
    handleDeploy: () => void
    buildLogs: string[]
    deployError: string | null
    vercelDeploymentUrl: string | null
    vercelLastDeployedAt: string | null
    githubRepoName: string | null
    isVercelConnected: boolean
    isGithubConnected: boolean
    handleConnectGithub: () => void
    handleConnectVercel: () => void
    onSwitchToGithubTab: () => void
}

export const PublishTab: React.FC<PublishTabProps> = ({
    deploying,
    deployed,
    handleDeploy,
    buildLogs,
    deployError,
    vercelDeploymentUrl,
    vercelLastDeployedAt,
    githubRepoName,
    isVercelConnected,
    isGithubConnected,
    handleConnectGithub,
    handleConnectVercel,
    onSwitchToGithubTab,
}) => {
    // Determine connection states
    const showBothNotConnected = !isGithubConnected && !isVercelConnected
    const showGithubNotConnected = !isGithubConnected && isVercelConnected
    const showVercelNotConnected = isGithubConnected && !isVercelConnected

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
            <h1 className="text-[16px] font-medium mb-3">Publish Application</h1>
            <div className="flex flex-col gap-6 border-t border-[#242323] pt-6 w-full">
                {/* Connection/Deployment status UI */}
                {showBothNotConnected ? (
                    <div className="border border-dashed border-[#383736] rounded-xl py-14 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30 hover:border-[#4A4948] transition-colors w-full">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shadow-md">
                                <Github className="w-6 h-6 text-[#D6D5C9]" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shadow-md">
                                <Rocket className="w-6 h-6 text-[#D6D5C9]" />
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 text-center px-4">
                            <span className="text-[15px] font-semibold text-[#D6D5C9]">
                                Connect services to publish
                            </span>
                            <span className="text-[13px] text-[#7B7A79] max-w-[380px]">
                                Connect your GitHub and Vercel accounts to compile and deploy your
                                application live.
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <button
                                type="button"
                                onClick={handleConnectGithub}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] bg-[#171615] hover:bg-[#1E1D1B] text-[13px] font-medium text-[#D6D5C9] hover:text-white transition-all cursor-pointer"
                            >
                                <Github className="w-4 h-4" />
                                Connect GitHub
                            </button>
                            <button
                                type="button"
                                onClick={handleConnectVercel}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] bg-[#171615] hover:bg-[#1E1D1B] text-[13px] font-medium text-[#D6D5C9] hover:text-white transition-all cursor-pointer"
                            >
                                <Rocket className="w-4 h-4" />
                                Connect Vercel
                            </button>
                        </div>
                    </div>
                ) : showGithubNotConnected ? (
                    <div className="border border-dashed border-[#383736] rounded-xl py-14 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30 hover:border-[#4A4948] transition-colors w-full">
                        <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shadow-md">
                            <Github className="w-6 h-6 text-[#D6D5C9]" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5 text-center px-4">
                            <span className="text-[15px] font-semibold text-[#D6D5C9]">
                                Connect GitHub to deploy
                            </span>
                            <span className="text-[13px] text-[#7B7A79] max-w-[380px]">
                                Connect your GitHub account to sync your repository files and
                                activate deployment.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleConnectGithub}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] bg-[#171615] hover:bg-[#1E1D1B] text-[13px] font-medium text-[#D6D5C9] hover:text-white transition-all cursor-pointer mt-1"
                        >
                            <Github className="w-4 h-4" />
                            Connect GitHub
                        </button>
                    </div>
                ) : showVercelNotConnected ? (
                    <div className="border border-dashed border-[#383736] rounded-xl py-14 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30 hover:border-[#4A4948] transition-colors w-full">
                        <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shadow-md">
                            <Rocket className="w-6 h-6 text-[#D6D5C9]" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5 text-center px-4">
                            <span className="text-[15px] font-semibold text-[#D6D5C9]">
                                Connect Vercel to deploy
                            </span>
                            <span className="text-[13px] text-[#7B7A79] max-w-[380px]">
                                Connect your Vercel account to compile, build, and deploy your
                                application live.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleConnectVercel}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] bg-[#171615] hover:bg-[#1E1D1B] text-[13px] font-medium text-[#D6D5C9] hover:text-white transition-all cursor-pointer mt-1"
                        >
                            <Rocket className="w-4 h-4" />
                            Connect Vercel
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col w-full animate-in fade-in duration-200">
                        {/* Connected Header */}
                        <div className="flex items-center justify-between mb-6 w-full">
                            <div className="flex items-center gap-4 text-left">
                                <div className="w-10 h-10 rounded-lg bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shrink-0">
                                    <Rocket className="w-5 h-5 text-[#D6D5C9]" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                                        Vercel
                                    </span>
                                    <span className="text-[13px] text-[#7B7A79]">
                                        Deploy the active visual workspace to the live global edge
                                        sandbox.
                                    </span>
                                </div>
                            </div>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-[#2B2A29] bg-[#1E1D1B] text-[#D6D5C9]">
                                Connected
                            </span>
                        </div>

                        {/* Deployment Info Card */}
                        <div className="bg-[#1A1918] border border-[#2B2A29] p-5 rounded-xl flex flex-col gap-4 text-left mb-6 w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] text-[#7B7A79] font-medium uppercase tracking-[0.05em]">
                                    Production URL
                                </span>
                                {vercelDeploymentUrl ? (
                                    <span className="text-[10px] font-bold uppercase bg-[#1E1D1B] border border-[#383736] text-[#D6D5C9] rounded-xl px-2.5 py-0.5 select-none flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#D6D5C9]" />
                                        Success
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase bg-[#1E1D1B] border border-[#383736] text-[#7B7A79] rounded-xl px-2.5 py-0.5 select-none">
                                        No Deployment
                                    </span>
                                )}
                            </div>

                            {vercelDeploymentUrl ? (
                                <a
                                    href={`https://${vercelDeploymentUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-[15px] font-semibold text-[#D6D5C9] hover:text-white hover:underline w-fit transition-colors"
                                >
                                    {vercelDeploymentUrl}
                                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                                </a>
                            ) : (
                                <span className="text-[13px] text-[#7B7A79]">
                                    No deployments active yet. Click "Deploy to Production" to
                                    launch your app.
                                </span>
                            )}

                            {vercelLastDeployedAt && (
                                <div className="text-[12px] text-[#7B7A79] border-t border-[#242323] pt-3 flex justify-between items-center mt-1">
                                    <span>Last Deployed</span>
                                    <span className="font-medium text-[#D6D5C9]">
                                        {new Date(vercelLastDeployedAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Deploy Action and Helper Banner */}
                        <div className="flex flex-col gap-4 w-full">
                            <div className="flex flex-col gap-1.5 text-left w-full">
                                <button
                                    type="button"
                                    onClick={handleDeploy}
                                    disabled={deploying || !githubRepoName}
                                    className={`w-fit flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer ${
                                        deploying
                                            ? 'bg-[#242323] border border-[#383736] text-[#7B7A79] cursor-not-allowed'
                                            : !githubRepoName
                                              ? 'bg-[#242323] border border-[#383736] text-[#7B7A79] cursor-not-allowed'
                                              : 'bg-[#E8E7E4] text-[#171615] hover:bg-white'
                                    }`}
                                >
                                    {deploying ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin text-[#7B7A79]" />
                                            Deploying Build...
                                        </>
                                    ) : (
                                        <>
                                            <Rocket className="w-4 h-4 text-[#171615]" />
                                            Deploy to Production
                                        </>
                                    )}
                                </button>

                                {!githubRepoName && (
                                    <div className="text-[12.5px] text-[#7B7A79] bg-[#1A1918] border border-[#2B2A29] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left w-full mt-2">
                                        <span>
                                            Please link a GitHub repository first to activate
                                            deployment.
                                        </span>
                                        <button
                                            type="button"
                                            onClick={onSwitchToGithubTab}
                                            className="text-[12.5px] font-semibold text-[#D6D5C9] hover:text-white underline cursor-pointer"
                                        >
                                            Configure GitHub
                                        </button>
                                    </div>
                                )}
                            </div>

                            {deployError && (
                                <div className="text-[12.5px] text-red-400 bg-red-950/20 border border-red-900/30 px-3.5 py-2.5 rounded-xl text-left w-full">
                                    {deployError}
                                </div>
                            )}

                            {/* Build Logs Console */}
                            <div className="flex flex-col gap-2 border-t border-[#242323] pt-6 text-left w-full">
                                <span className="text-[13px] font-medium text-[#7B7A79]">
                                    Terminal Build Logs & History
                                </span>
                                <div className="h-44 bg-[#100E12] rounded-xl border border-[#2B2A29] p-4 font-mono text-[11px] text-[#D6D5C9] overflow-y-auto space-y-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                    {buildLogs.length > 0 ? (
                                        buildLogs.map((log, index) => <div key={index}>{log}</div>)
                                    ) : (
                                        <div className="text-neutral-500">
                                            [system] Ready to deploy. Click the deploy button above
                                            to trigger a build.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
