import { RotateCw, Search } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ProfileRepositoriesSkeleton } from './ProfileSettingsSkeleton'
import { SettingsPageHeader } from './SettingsPageHeader'
import {
    boxSurfaceClass,
    listEmptyClass,
    outlineButtonClass,
    textLinkClass,
} from './settingsStyles'

import { ListBox } from '@/features/connections/components/ConnectionsUi'
import { type GithubRepo } from '@/features/profile/api/profile'
import {
    repoKey,
    useConnectedRepos,
    type RepoHostState,
} from '@/features/profile/hooks/useConnectedRepos'
import {
    isGithubConnectRequested,
    readGithubConnectError,
} from '@/features/profile/hooks/useGithubConnection'
import { useGitlabConnection } from '@/features/profile/hooks/useGitlabConnection'
import { ListArt, RelativeTime, type ListArtKind } from '@/features/sessions/components/ListParts'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

interface ProfileRepositoriesSettingsProps {
    isGithubConnected: boolean
    onConnectGithub: () => void
}

/** the page a repository opens on its host; only https links (B7) */
const safeRepoUrl = (url?: string | null) => (url && /^https:\/\//i.test(url) ? url : null)

const hostName = (repo: GithubRepo) => (repo.provider === 'GITLAB' ? 'GitLab' : 'GitHub')

const matchesSearch = (repo: GithubRepo, query: string) => {
    if (!query) return true
    return (
        repo.fullName.toLowerCase().includes(query) ||
        Boolean(repo.description && repo.description.toLowerCase().includes(query))
    )
}

/** one repository card (L1-B): a link to the repository, with no icons and no language */
const RepoCard: React.FC<{ repo: GithubRepo }> = ({ repo }) => {
    // a gitlab owner can hold subgroups (a/b), so read the fields
    const name = repo.name || repo.fullName
    const owner = repo.owner?.login || repo.fullName
    const href = safeRepoUrl(repo.htmlUrl)
    const body = (
        <>
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-white truncate">{name}</span>
                    <span className="text-[11.5px] text-[#8F8E8D] truncate">
                        {owner} · {hostName(repo)}
                    </span>
                </div>
                <span className="px-1.5 py-0.5 rounded border border-[#383736] text-[10px] text-[#8F8E8D] shrink-0">
                    {repo.private ? 'Private' : 'Public'}
                </span>
            </div>

            {repo.description && (
                <p className="text-[12px] text-[#8F8E8D] line-clamp-2 leading-relaxed my-2">
                    {repo.description}
                </p>
            )}

            <div className="flex items-center gap-3.5 pt-1 text-[11px] text-[#8F8E8D] mt-auto min-w-0">
                {repo.defaultBranch && <span className="truncate">{repo.defaultBranch}</span>}
                <span className="shrink-0">
                    <RelativeTime iso={repo.updatedAt} label="Updated" />
                </span>
            </div>
        </>
    )
    const cardClass = `group relative ${boxSurfaceClass} p-3.5 transition-colors duration-200 flex flex-col justify-between min-h-[96px] min-w-0 outline-none`

    if (!href) return <div className={cardClass}>{body}</div>
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${repo.fullName} on ${hostName(repo)}`}
            className={`${cardClass} hover:bg-[#242424] focus-visible:bg-[#242424] focus-visible:border-[#5A5A5A] cursor-pointer`}
        >
            {body}
        </a>
    )
}

/** the empty box of the page (E1-E5): the drawing, one title, then its buttons */
const RepoEmptyBox: React.FC<{
    art: ListArtKind
    title: string
    children?: React.ReactNode
}> = ({ art, title, children }) => (
    <ListBox>
        <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-8">
            <div className="h-[105px] w-[120px] text-[#8A8987]">
                <ListArt kind={art} strokePx={2.2} widthPx={120} />
            </div>
            <h3 className="text-[14px] font-medium text-[#D6D5C9]">{title}</h3>
            {children && (
                <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
            )}
        </div>
    </ListBox>
)

/** one grey line under the cards (L5-A): what did not load, and what to do about it */
const RepoNoteLine: React.FC<{
    text: string
    action?: { label: string; onClick: () => void }
}> = ({ text, action }) => (
    <div className="flex items-center justify-between gap-3 px-1 text-[12.5px] text-[#9A9998]">
        <span className="min-w-0">{text}</span>
        {action && (
            <button
                type="button"
                onClick={action.onClick}
                className={`${textLinkClass} shrink-0 text-[12.5px]`}
            >
                {action.label}
            </button>
        )}
    </div>
)

export const ProfileRepositoriesSettings: React.FC<ProfileRepositoriesSettingsProps> = ({
    isGithubConnected,
    onConnectGithub,
}) => {
    const [searchQuery, setSearchQuery] = useState('')

    const reposQuery = useConnectedRepos({ enabled: true, isGithubConnected })
    const gitlab = useGitlabConnection()
    // read once from the address, then the address is cleaned (B6)
    const [githubConnectError] = useState(readGithubConnectError)
    const [githubRequested] = useState(isGithubConnectRequested)
    const [searchParams, setSearchParams] = useSearchParams()

    useEffect(() => {
        if (!searchParams.has('github') && !searchParams.has('gitlab')) return
        const next = new URLSearchParams(searchParams)
        next.delete('github')
        next.delete('gitlab')
        setSearchParams(next, { replace: true })
    }, [searchParams, setSearchParams])

    const connectGitlab = () => {
        window.location.href = gitlab.connectUrl('/settings/repositories')
    }

    const anyConnected = isGithubConnected || gitlab.isConnected
    const canConnectGitlab = gitlab.isAvailable && !gitlab.isConnected
    const query = searchQuery.trim().toLowerCase()
    const shownRepos = reposQuery.repos.filter((repo) => matchesSearch(repo, query))
    // until the GitLab status is in, "not connected" cannot be told from "loading" (B4)
    const isLoading = reposQuery.isLoading || !reposQuery.isGitlabReady || isSkeletonPreviewActive()

    const hostLabel = { github: 'GitHub', gitlab: 'GitLab' } as const
    const hostStates: { host: keyof typeof hostLabel; state: RepoHostState }[] = [
        { host: 'github', state: reposQuery.githubState },
        { host: 'gitlab', state: reposQuery.gitlabState },
    ]
    const reconnect = (host: keyof typeof hostLabel) =>
        host === 'github' ? onConnectGithub() : connectGitlab()

    // L5-A: what did not load while something else did
    const noteLines: React.ReactNode[] = []
    if (!reposQuery.isError) {
        for (const { host, state } of hostStates) {
            if (state === 'reconnect') {
                noteLines.push(
                    <RepoNoteLine
                        key={`${host}-reconnect`}
                        text={`${hostLabel[host]} needs to be connected again.`}
                        action={{ label: 'Reconnect', onClick: () => reconnect(host) }}
                    />
                )
            } else if (state === 'error') {
                noteLines.push(
                    <RepoNoteLine
                        key={`${host}-error`}
                        text={`${hostLabel[host]} repositories could not load.`}
                        action={{ label: 'Try again', onClick: () => reposQuery.refetch() }}
                    />
                )
            }
        }
        for (const account of reposQuery.unavailableAccounts) {
            noteLines.push(
                <RepoNoteLine
                    key={`unavailable-${account}`}
                    text={`Repositories of ${account} could not load.`}
                    action={{ label: 'Add from GitHub', onClick: onConnectGithub }}
                />
            )
        }
        if (reposQuery.isTruncated) {
            noteLines.push(
                <RepoNoteLine key="truncated" text="Showing the first 1,000 repositories." />
            )
        }
    }

    const firstFailedHost = hostStates.find(({ state }) => state === 'reconnect')?.host

    const renderBody = () => {
        if (isLoading) return <ProfileRepositoriesSkeleton />

        if (!anyConnected) {
            return (
                <RepoEmptyBox
                    art="connect"
                    title={
                        canConnectGitlab
                            ? 'Connect GitHub or GitLab to see your repositories'
                            : 'Connect GitHub to see your repositories'
                    }
                >
                    <button type="button" onClick={onConnectGithub} className={outlineButtonClass}>
                        Connect GitHub
                    </button>
                    {canConnectGitlab && (
                        <button
                            type="button"
                            onClick={connectGitlab}
                            className={outlineButtonClass}
                        >
                            Connect GitLab
                        </button>
                    )}
                </RepoEmptyBox>
            )
        }

        // every connected host failed (E4, E5)
        if (reposQuery.isError) {
            if (firstFailedHost) {
                return (
                    <RepoEmptyBox
                        art="connect"
                        title={`${hostLabel[firstFailedHost]} needs to be connected again`}
                    >
                        <button
                            type="button"
                            onClick={() => reconnect(firstFailedHost)}
                            className={outlineButtonClass}
                        >
                            Reconnect {hostLabel[firstFailedHost]}
                        </button>
                    </RepoEmptyBox>
                )
            }
            return (
                <RepoEmptyBox art="loadError" title="Could not load repositories">
                    <button
                        type="button"
                        onClick={() => reposQuery.refetch()}
                        className={outlineButtonClass}
                    >
                        Try again
                    </button>
                </RepoEmptyBox>
            )
        }

        if (reposQuery.repos.length === 0) {
            // with a host that failed, the lines below say what is missing
            if (noteLines.length > 0) return null
            return (
                <RepoEmptyBox art="repositories" title="No repositories yet">
                    {isGithubConnected && (
                        <button
                            type="button"
                            onClick={onConnectGithub}
                            className={outlineButtonClass}
                        >
                            Add from GitHub
                        </button>
                    )}
                </RepoEmptyBox>
            )
        }

        if (shownRepos.length === 0) {
            return (
                <ListBox>
                    <div className={listEmptyClass}>No repositories match</div>
                </ListBox>
            )
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {shownRepos.map((repo) => (
                    <RepoCard key={repoKey(repo)} repo={repo} />
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9]">
            <SettingsPageHeader
                title="Repositories"
                subtitle={
                    <>
                        Use a repository in a prompt as{' '}
                        <span className="text-[#87B2F4]">@repos:name</span>.
                    </>
                }
            />

            <div className="flex flex-col gap-4">
                {/* nothing connected: the empty box holds the buttons, so no toolbar (L2-A) */}
                {anyConnected && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative w-full max-w-full sm:max-w-[280px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search repositories"
                                aria-label="Search repositories"
                                maxLength={200}
                                className="w-full pl-9 pr-3 py-1.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none focus:border-[#5A5A5A] transition-colors"
                            />
                        </div>

                        {/* phones keep the buttons on their own line under search (L4-B) */}
                        <div className="flex items-center gap-2">
                            <Tooltip position="top" content="Refresh repositories">
                                <button
                                    type="button"
                                    onClick={() => reposQuery.refetch()}
                                    aria-label="Refresh repositories"
                                    className="p-2 rounded-lg border border-[#383736] hover:bg-[#242323] text-[#949494] hover:text-[#D6D5C9] transition-colors cursor-pointer"
                                >
                                    <RotateCw
                                        className={`w-3.5 h-3.5 ${reposQuery.isRefetching ? 'animate-spin' : ''}`}
                                    />
                                </button>
                            </Tooltip>
                            <button
                                type="button"
                                onClick={onConnectGithub}
                                className={`${outlineButtonClass} flex-1 sm:flex-initial`}
                            >
                                {isGithubConnected ? 'Add from GitHub' : 'Connect GitHub'}
                            </button>
                            {canConnectGitlab && (
                                <button
                                    type="button"
                                    onClick={connectGitlab}
                                    className={`${outlineButtonClass} flex-1 sm:flex-initial`}
                                >
                                    Connect GitLab
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {githubConnectError && !githubRequested && (
                    <p role="alert" className="text-[12.5px] text-red-400">
                        {githubConnectError}
                    </p>
                )}
                {githubRequested && githubConnectError && (
                    <p className="text-[12.5px] text-[#9A9998]">{githubConnectError}</p>
                )}
                {gitlab.connectError && (
                    <p role="alert" className="text-[12.5px] text-red-400">
                        {gitlab.connectError}
                    </p>
                )}

                {renderBody()}

                {!isLoading && anyConnected && noteLines.length > 0 && (
                    <div className="flex flex-col gap-1.5">{noteLines}</div>
                )}
            </div>
        </div>
    )
}
