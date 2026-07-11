import { Github, Lock, Globe, ExternalLink, CheckCircle, Loader2 } from 'lucide-react'
import React from 'react'

import { PremiumInput } from './SettingsFormControls'

import type { Profile } from '@/features/profile/api/profile'

interface GithubTabProps {
    profile: Profile | null
    project: any
    githubRepoName: string
    setGithubRepoName: (val: string) => void
    githubIsPrivate: boolean
    setGithubIsPrivate: (val: boolean) => void
    isCreatingRepo: boolean
    githubSyncError: string | null
    githubSyncSuccess: boolean
    githubCommitMsg: string
    setGithubCommitMsg: (val: string) => void
    isSyncingRepo: boolean
    handleConnectGithub: () => void
    handleCreateGithubRepo: (e: React.FormEvent) => void
    handleSyncGithubRepo: () => void
}

export const GithubTab: React.FC<GithubTabProps> = ({
    profile,
    project,
    githubRepoName,
    setGithubRepoName,
    githubIsPrivate,
    setGithubIsPrivate,
    isCreatingRepo,
    githubSyncError,
    githubSyncSuccess,
    githubCommitMsg,
    setGithubCommitMsg,
    isSyncingRepo,
    handleConnectGithub,
    handleCreateGithubRepo,
    handleSyncGithubRepo,
}) => {
    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
            <h1 className="text-[16px] font-medium mb-3">GitHub Integration</h1>
            <div className="flex flex-col border-t border-[#242323] pt-6 w-full">
                {!profile ? (
                    <div className="text-[13px] text-[#7B7A79] text-left">
                        Loading integration details...
                    </div>
                ) : !profile.githubConnected ? (
                    <div className="border border-dashed border-[#383736] rounded-xl py-14 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30 hover:border-[#4A4948] transition-colors w-full">
                        <div className="w-14 h-14 rounded-2xl bg-[#191919] border border-[#383736] flex items-center justify-center shadow-md">
                            <Github className="w-7 h-7 text-[#D6D5C9]" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5 text-center px-4">
                            <span className="text-[15px] font-semibold text-[#D6D5C9]">
                                Connect GitHub to link repository
                            </span>
                            <span className="text-[13px] text-[#7B7A79] max-w-[360px]">
                                Link a GitHub repository to this project to export and sync your
                                generated code automatically.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleConnectGithub}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] bg-[#141414] hover:bg-[#191919] text-[13px] font-medium text-[#D6D5C9] hover:text-white transition-all cursor-pointer mt-1"
                        >
                            <Github className="w-4 h-4" />
                            Connect GitHub
                        </button>
                    </div>
                ) : project && !project.githubRepoName ? (
                    <div className="flex flex-col w-full animate-in fade-in duration-200">
                        <div className="flex items-center gap-4 mb-6 text-left">
                            <div className="w-10 h-10 rounded-lg bg-[#191919] border border-[#383736] flex items-center justify-center shrink-0">
                                <Github className="w-5 h-5 text-[#D6D5C9]" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[14px] font-medium text-[#D6D5C9]">
                                    GitHub
                                </span>
                                <span className="text-[13px] text-[#7B7A79]">
                                    Link a GitHub repository to this project to export and sync your
                                    generated code automatically.
                                </span>
                            </div>
                        </div>

                        <form
                            onSubmit={handleCreateGithubRepo}
                            className="flex flex-col gap-5 w-full"
                        >
                            <div className="flex flex-col gap-1.5 text-left">
                                <label className="text-[13px] font-medium text-[#7B7A79]">
                                    Repository Name
                                </label>
                                <div className="flex items-center bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2.5 focus-within:border-[#4A4948] transition-colors w-full">
                                    <span className="text-[13px] text-[#7B7A79] mr-1 select-none font-medium">
                                        {profile.githubUsername}/
                                    </span>
                                    <input
                                        type="text"
                                        value={githubRepoName}
                                        onChange={(e) => setGithubRepoName(e.target.value)}
                                        placeholder="my-awesome-project"
                                        className="flex-1 bg-transparent text-[13px] text-[#D6D5C9] outline-none border-none p-0 placeholder-[#555453]"
                                        required
                                    />
                                </div>
                            </div>

                            <div
                                onClick={() => setGithubIsPrivate(!githubIsPrivate)}
                                className="flex items-start gap-3 bg-[#1A1918] border border-[#2B2A29] p-4 rounded-xl hover:border-[#383736] transition-colors cursor-pointer select-none w-full"
                            >
                                <input
                                    type="checkbox"
                                    id="private-repo"
                                    checked={githubIsPrivate}
                                    onChange={(e) => {
                                        e.stopPropagation()
                                        setGithubIsPrivate(e.target.checked)
                                    }}
                                    className="w-4 h-4 rounded border-[#383736] bg-[#100E12] text-[#D6D5C9] focus:ring-0 focus:ring-offset-0 cursor-pointer mt-0.5 accent-[#D6D5C9]"
                                />
                                <div className="flex flex-col text-left">
                                    <label
                                        htmlFor="private-repo"
                                        className="text-[13px] font-semibold text-[#D6D5C9] cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Private Repository
                                    </label>
                                    <span className="text-[12.5px] text-[#7B7A79] mt-0.5">
                                        Only you and invited collaborators can view this repository.
                                    </span>
                                </div>
                            </div>

                            {githubSyncError && (
                                <div className="text-[12.5px] text-red-400 bg-red-950/20 border border-red-900/30 px-3.5 py-2.5 rounded-xl text-left w-full">
                                    {githubSyncError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isCreatingRepo || !githubRepoName.trim()}
                                className="w-fit flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8E7E4] text-[#141414] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-semibold transition-colors cursor-pointer"
                            >
                                {isCreatingRepo ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-[#141414]" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create & Sync'
                                )}
                            </button>
                        </form>
                    </div>
                ) : project ? (
                    <div className="flex flex-col w-full animate-in fade-in duration-200">
                        <div className="flex items-center justify-between mb-6 w-full">
                            <div className="flex items-center gap-4 text-left font-medium">
                                <div className="w-10 h-10 rounded-lg bg-[#191919] border border-[#383736] flex items-center justify-center shrink-0">
                                    <Github className="w-5 h-5 text-[#D6D5C9]" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                                        GitHub
                                    </span>
                                    <span className="text-[13px] text-[#7B7A79]">
                                        Export and sync your generated code automatically.
                                    </span>
                                </div>
                            </div>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-[#2B2A29] bg-[#191919] text-[#D6D5C9]">
                                Active
                            </span>
                        </div>

                        <div className="bg-[#1A1918] border border-[#2B2A29] p-5 rounded-xl flex flex-col gap-4 text-left mb-6 w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] text-[#7B7A79] font-medium uppercase tracking-[0.05em]">
                                    Linked Repository
                                </span>
                                {githubIsPrivate ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#2B2A29] bg-[#191919] text-[11px] text-[#7B7A79]">
                                        <Lock className="w-3 h-3" />
                                        Private
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#2B2A29] bg-[#191919] text-[11px] text-[#7B7A79]">
                                        <Globe className="w-3 h-3" />
                                        Public
                                    </span>
                                )}
                            </div>

                            <a
                                href={
                                    project.githubRepoUrl ??
                                    `https://github.com/${project.githubRepoOwner}/${project.githubRepoName}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-[15px] font-semibold text-[#D6D5C9] hover:text-white hover:underline w-fit transition-colors"
                            >
                                <Github className="w-4 h-4 text-[#7B7A79]" />
                                {project.githubRepoOwner}/{project.githubRepoName}
                                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                            </a>

                            <div className="text-[12px] text-[#7B7A79] border-t border-[#242323] pt-3 flex justify-between items-center mt-1">
                                <span>Last Synced</span>
                                <span className="font-medium text-[#D6D5C9]">
                                    {project.githubLastSyncedAt
                                        ? new Date(project.githubLastSyncedAt).toLocaleString()
                                        : 'Never'}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 w-full">
                            <div className="flex flex-col gap-1.5 text-left w-full">
                                <label className="text-[13px] font-medium text-[#7B7A79]">
                                    Commit Message
                                </label>
                                <PremiumInput
                                    value={githubCommitMsg}
                                    onChange={(e) => setGithubCommitMsg(e.target.value)}
                                    placeholder="feat: sync project changes"
                                />
                            </div>

                            {githubSyncError && (
                                <div className="text-[12.5px] text-red-400 bg-red-950/20 border border-red-900/30 px-3.5 py-2.5 rounded-xl text-left w-full">
                                    {githubSyncError}
                                </div>
                            )}

                            {githubSyncSuccess && (
                                <div className="text-[12.5px] text-[#D6D5C9] bg-[#191919] border border-[#383736] px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-left w-full">
                                    <CheckCircle className="w-4 h-4 shrink-0 text-[#7B7A79]" />
                                    Latest changes pushed successfully!
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleSyncGithubRepo}
                                disabled={isSyncingRepo}
                                className="w-fit flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8E7E4] text-[#141414] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-semibold transition-colors cursor-pointer"
                            >
                                {isSyncingRepo ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-[#141414]" />
                                        Pushing...
                                    </>
                                ) : (
                                    <>
                                        <Github className="w-4 h-4 text-[#141414]" />
                                        Push Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-[13px] text-[#7B7A79] text-left">
                        Loading integration details...
                    </div>
                )}
            </div>
        </div>
    )
}
