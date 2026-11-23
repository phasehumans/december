import { ArrowUpRight } from 'lucide-react'
import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'

import {
    BackLink,
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
    SoonPill,
    Spinner,
    matchesQuery,
} from './ConnectionsUi'

import type { BrandKey } from '../types'

import { useProfileSettingsController } from '@/features/profile/hooks/useProfileSettingsController'
import { Skeleton } from '@/shared/components/ui/Skeleton'

interface AppEntry {
    id: string
    name: string
    brand: BrandKey
    available: boolean
}

const APPS: AppEntry[] = [
    { id: 'github', name: 'GitHub', brand: 'github', available: true },
    { id: 'gitlab', name: 'GitLab', brand: 'gitlab', available: false },
    { id: 'slack', name: 'Slack', brand: 'slack', available: false },
    { id: 'linear', name: 'Linear', brand: 'linear', available: false },
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
    const { profile, isProfileLoading, profileError, isGithubConnected, connectGithub } =
        useProfileSettingsController()
    const [query, setQuery] = React.useState('')
    const [isConnecting, setIsConnecting] = React.useState(false)

    const handleConnect = () => {
        setIsConnecting(true)
        connectGithub()
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

    // github is the only app that can connect today, so it already sits first
    const apps = APPS.filter((app) => matchesQuery(query, app.name))

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Search apps" />
            </div>
            {profileError && !profile && (
                <p className="text-[12.5px] text-red-500 font-medium">Could not load apps</p>
            )}
            <ListBox>
                <ListHeader>
                    <span className="flex-1">Name</span>
                    <span className="w-[140px]">Account</span>
                    <span className="w-[96px]" />
                </ListHeader>
                {isProfileLoading && !profile ? (
                    <AppsSkeleton />
                ) : apps.length === 0 ? (
                    <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {apps.map((app) => {
                            const connected = app.id === 'github' && isGithubConnected
                            return (
                                <ListRow
                                    key={app.id}
                                    dim={!app.available}
                                    onClick={
                                        app.available ? () => toItem('apps', app.id) : undefined
                                    }
                                >
                                    <LogoTile brand={app.brand} name={app.name} />
                                    <span className="flex-1 min-w-0 truncate text-[#D6D5C9]">
                                        {app.name}
                                    </span>
                                    <span className="hidden md:block w-[140px] truncate text-[12.5px] text-[#7B7A79]">
                                        {connected ? profile?.githubUsername || '' : ''}
                                    </span>
                                    <span className="md:w-[96px] flex justify-end">
                                        {!app.available ? (
                                            <SoonPill />
                                        ) : connected ? (
                                            <Pill tone="ok">Connected</Pill>
                                        ) : (
                                            <SecondaryButton
                                                small
                                                onClick={handleConnect}
                                                disabled={isConnecting}
                                            >
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
