import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'

import {
    BackLink,
    ConfirmModal,
    DetailHeader,
    EmptyRow,
    FactsBox,
    ListBox,
    ListHeader,
    ListRow,
    ListRows,
    LogoTile,
    Pill,
    SearchInput,
    SecondaryButton,
    Spinner,
    matchesQuery,
} from './ConnectionsUi'

import type { BrandKey } from '../types'

import { profileAPI } from '@/features/profile/api/profile'
import { readGithubConnectError } from '@/features/profile/hooks/useGithubConnection'
import {
    GITLAB_STATUS_KEY,
    useGitlabConnection,
} from '@/features/profile/hooks/useGitlabConnection'
import { useProfileSettingsController } from '@/features/profile/hooks/useProfileSettingsController'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { apiErrorMessage } from '@/shared/lib/apiErrorMessage'

interface AppEntry {
    id: 'github' | 'gitlab'
    name: string
    brand: BrandKey
}

/** the apps December can connect today. gitlab shows once the server has its app (#645) */
const APPS: AppEntry[] = [
    { id: 'github', name: 'GitHub', brand: 'github' },
    { id: 'gitlab', name: 'GitLab', brand: 'gitlab' },
]

const GITHUB_INSTALLATIONS_URL = 'https://github.com/settings/installations'

const AppsSkeleton: React.FC = () => (
    <ListRows>
        {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 md:px-4 py-3">
                <Skeleton className="w-7 h-7 rounded-lg bg-white/[0.04]" />
                <Skeleton className="h-3 w-32 rounded bg-white/[0.04]" />
            </div>
        ))}
    </ListRows>
)

export const AppsTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    const { toItem } = useConnectionsNav()
    const queryClient = useQueryClient()
    const { profile, isProfileLoading, profileError, isGithubConnected, connectGithub } =
        useProfileSettingsController()
    const gitlab = useGitlabConnection()
    const [githubConnectError] = React.useState(readGithubConnectError)
    const [query, setQuery] = React.useState('')
    const [isConnecting, setIsConnecting] = React.useState(false)
    const [isConnectingGitlab, setIsConnectingGitlab] = React.useState(false)

    const handleConnect = () => {
        setIsConnecting(true)
        connectGithub()
    }

    const handleConnectGitlab = () => {
        setIsConnectingGitlab(true)
        window.location.href = gitlab.connectUrl()
    }

    if (itemId === 'github') {
        return (
            <GithubAppPage
                username={profile?.githubUsername}
                isAppInstalled={Boolean(profile?.githubAppInstall)}
                isConnected={isGithubConnected}
                isConnecting={isConnecting}
                onConnect={handleConnect}
            />
        )
    }

    if (itemId === 'gitlab' && gitlab.isAvailable) {
        return (
            <GitlabAppPage
                username={gitlab.username}
                connectError={gitlab.connectError}
                isConnected={gitlab.isConnected}
                isConnecting={isConnectingGitlab}
                onConnect={handleConnectGitlab}
            />
        )
    }

    const apps = APPS.filter((app) => app.id !== 'gitlab' || gitlab.isAvailable).filter((app) =>
        matchesQuery(query, app.name)
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Search apps" />
            </div>
            {githubConnectError && (
                <p role="alert" className="text-[12.5px] text-red-500 font-medium">
                    {githubConnectError}
                </p>
            )}
            {gitlab.connectError && (
                <p role="alert" className="text-[12.5px] text-red-500 font-medium">
                    {gitlab.connectError}
                </p>
            )}
            <ListBox>
                <ListHeader>
                    <span className="flex-1">Name</span>
                    <span className="w-[140px]">Account</span>
                    <span className="w-[96px]" />
                </ListHeader>
                {isProfileLoading && !profile ? (
                    <AppsSkeleton />
                ) : profileError && !profile ? (
                    <EmptyRow
                        action={
                            <SecondaryButton
                                onClick={() =>
                                    void queryClient.invalidateQueries({ queryKey: ['profile'] })
                                }
                            >
                                Try again
                            </SecondaryButton>
                        }
                    >
                        Could not load apps
                    </EmptyRow>
                ) : apps.length === 0 ? (
                    <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {apps.map((app) => {
                            const connected =
                                (app.id === 'github' && isGithubConnected) ||
                                (app.id === 'gitlab' && gitlab.isConnected)
                            const account =
                                app.id === 'gitlab' ? gitlab.username : profile?.githubUsername
                            const connecting =
                                app.id === 'gitlab' ? isConnectingGitlab : isConnecting
                            return (
                                <ListRow key={app.id} onClick={() => toItem('apps', app.id)}>
                                    <LogoTile brand={app.brand} name={app.name} />
                                    <span className="flex-1 min-w-0 truncate text-[#D6D5C9]">
                                        {app.name}
                                    </span>
                                    <span className="hidden md:block w-[140px] truncate text-[12.5px] text-[#7B7A79]">
                                        {connected ? account || '' : ''}
                                    </span>
                                    <span className="md:w-[96px] flex justify-end">
                                        {connected ? (
                                            <Pill tone="ok">Connected</Pill>
                                        ) : (
                                            <SecondaryButton
                                                small
                                                onClick={
                                                    app.id === 'gitlab'
                                                        ? handleConnectGitlab
                                                        : handleConnect
                                                }
                                                disabled={connecting}
                                            >
                                                {connecting ? (
                                                    <>
                                                        <Spinner />
                                                        Connecting
                                                    </>
                                                ) : (
                                                    'Connect'
                                                )}
                                            </SecondaryButton>
                                        )}
                                    </span>
                                </ListRow>
                            )
                        })}
                    </ListRows>
                )}
            </ListBox>
        </div>
    )
}

const GithubAppPage: React.FC<{
    username?: string
    isAppInstalled: boolean
    isConnected: boolean
    isConnecting: boolean
    onConnect: () => void
}> = ({ username, isAppInstalled, isConnected, isConnecting, onConnect }) => {
    const { toTab } = useConnectionsNav()
    return (
        <div className="flex flex-col">
            <BackLink label="Apps" onClick={() => toTab('apps')} />
            <DetailHeader title="GitHub" logo={<LogoTile brand="github" name="GitHub" large />}>
                {isConnected && <Pill tone="ok">Connected</Pill>}
                <span className="flex-1" />
                {isConnected ? (
                    <a
                        href={GITHUB_INSTALLATIONS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-[#282828] bg-[#202020] hover:bg-[#282828] px-3.5 py-1.5 text-[12.5px] font-medium text-[#D6D5C9] hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                        Configure on GitHub
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#7B7A79]" />
                    </a>
                ) : (
                    <SecondaryButton onClick={onConnect} disabled={isConnecting}>
                        {isConnecting ? (
                            <>
                                <Spinner />
                                Connecting
                            </>
                        ) : (
                            'Connect'
                        )}
                    </SecondaryButton>
                )}
            </DetailHeader>

            {isConnected && (
                <div>
                    <FactsBox
                        rows={[
                            { label: 'Account', value: username || 'GitHub account' },
                            {
                                label: 'GitHub App',
                                value: isAppInstalled ? 'Installed' : 'Not installed',
                            },
                        ]}
                    />
                </div>
            )}
        </div>
    )
}

const GitlabAppPage: React.FC<{
    username: string | null
    connectError: string | null
    isConnected: boolean
    isConnecting: boolean
    onConnect: () => void
}> = ({ username, connectError, isConnected, isConnecting, onConnect }) => {
    const { toTab } = useConnectionsNav()
    const queryClient = useQueryClient()
    const [isConfirming, setIsConfirming] = React.useState(false)
    const disconnect = useMutation({
        mutationFn: profileAPI.disconnectGitlab,
        onSuccess: async () => {
            queryClient.removeQueries({ queryKey: ['gitlab-repos'] })
            await queryClient.invalidateQueries({ queryKey: GITLAB_STATUS_KEY })
        },
    })

    return (
        <div className="flex flex-col">
            <BackLink label="Apps" onClick={() => toTab('apps')} />
            <DetailHeader title="GitLab" logo={<LogoTile brand="gitlab" name="GitLab" large />}>
                {isConnected && <Pill tone="ok">Connected</Pill>}
                <span className="flex-1" />
                {isConnected ? (
                    <SecondaryButton
                        onClick={() => setIsConfirming(true)}
                        disabled={disconnect.isPending}
                    >
                        {disconnect.isPending ? (
                            <>
                                <Spinner />
                                Disconnecting
                            </>
                        ) : (
                            'Disconnect'
                        )}
                    </SecondaryButton>
                ) : (
                    <SecondaryButton onClick={onConnect} disabled={isConnecting}>
                        {isConnecting ? (
                            <>
                                <Spinner />
                                Connecting
                            </>
                        ) : (
                            'Connect'
                        )}
                    </SecondaryButton>
                )}
            </DetailHeader>

            {isConnected && (
                <div>
                    <FactsBox rows={[{ label: 'Account', value: username || 'GitLab account' }]} />
                </div>
            )}
            {connectError && !isConnected && (
                <p role="alert" className="mt-3 text-[12.5px] text-red-500 font-medium">
                    {connectError}
                </p>
            )}
            {disconnect.isError && (
                <p role="alert" className="mt-3 text-[12.5px] text-red-500 font-medium">
                    {apiErrorMessage(disconnect.error, 'Could not disconnect')}
                </p>
            )}
            <ConfirmModal
                isOpen={isConfirming}
                title="Disconnect GitLab?"
                body="Sessions can no longer clone or push to your GitLab repositories."
                confirmLabel="Disconnect"
                onClose={() => setIsConfirming(false)}
                onConfirm={() => {
                    setIsConfirming(false)
                    disconnect.mutate()
                }}
            />
        </div>
    )
}
