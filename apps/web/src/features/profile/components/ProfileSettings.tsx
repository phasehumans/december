import {
    ChevronLeft,
    UserCircle,
    CreditCard,
    FileClock,
    ArrowUpRight,
    KeyRound,
    FileText,
    BarChart3,
    Lock,
    MessageSquare,
    Plus,
    Settings2,
    Box,
    Users,
} from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useProfileSettingsController } from '../hooks/useProfileSettingsController'
import { SettingsTopBarContext, type SettingsTopBarAction } from '../lib/settingsTopBar'

import { ProfileBillingSettings } from './ProfileBillingSettings'
import { ProfileDefaultsSettings } from './ProfileDefaultsSettings'
import { ProfileDeleteAccountModal } from './ProfileDeleteAccountModal'
import { ProfileFeedbackModal } from './ProfileFeedbackModal'
import { ProfileMembersSettings } from './ProfileMembersSettings'
import { ProfileModelKeysSettings } from './ProfileModelKeysSettings'
import { ProfileNameModal } from './ProfileNameModal'
import { ProfilePullRequestSettings } from './ProfilePullRequestSettings'
import { ProfileRepositoriesSettings } from './ProfileRepositoriesSettings'
import { ProfileSandboxSettings } from './ProfileSandboxSettings'
import { ProfileSecretsSettings } from './ProfileSecretsSettings'
import { ProfileSettingsContent } from './ProfileSettingsContent'
import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'
import { ProfileSignOutAllSessionsModal } from './ProfileSignOutAllSessionsModal'
import { ProfileUsageSettings } from './ProfileUsageSettings'

import type { ProfileSettingsProps } from '@/features/profile/types'

import { useAppStore } from '@/app/store'
import { getProfileTabFromSlug, getSlugForProfileTab, type ProfileTab } from '@/app/types'
import { ConnectionsPage } from '@/features/connections/components/ConnectionsPage'
import { CONNECTIONS_BASE_PATH } from '@/features/connections/lib/paths'
import {
    MobileBackButton,
    MobileIconButton,
    MobileTopBar,
} from '@/features/navigation/components/MobileTopBar'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Icons } from '@/shared/components/ui/Icons'
import { getWebUrl } from '@/shared/config/env'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

const navIconClass = 'w-[18px] h-[18px]'

const navItemClass = (active: boolean) =>
    cn(
        'flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium text-[#D6D5C9] transition-colors whitespace-nowrap shrink-0 cursor-pointer',
        active ? 'bg-[#242323]' : 'hover:bg-[#191919]'
    )

interface SettingsNavItem {
    label: string
    to: string
    tabs: ProfileTab[]
    icon: React.ReactNode
}

// the settings list: one flat list, in one order on desktop and phones. a new page joins
// here, and SETTINGS_ROWS in MobileSettingsLevel for phones
const NAV_ITEMS: SettingsNavItem[] = [
    {
        label: 'Account',
        to: `/settings/${getSlugForProfileTab('Account')}`,
        tabs: ['Account'],
        icon: <UserCircle className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Defaults',
        to: `/settings/${getSlugForProfileTab('Defaults')}`,
        tabs: ['Defaults'],
        icon: <Settings2 className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Repositories',
        to: `/settings/${getSlugForProfileTab('Repositories')}`,
        tabs: ['Repositories'],
        icon: <Icons.Github className={navIconClass} />,
    },
    {
        label: 'Pull requests',
        to: `/settings/${getSlugForProfileTab('PullRequests')}`,
        tabs: ['PullRequests'],
        // the same icon as Pull requests in the main sidebar
        icon: <Icons.GitPullRequest className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Sandbox',
        to: `/settings/${getSlugForProfileTab('Sandbox')}`,
        tabs: ['Sandbox'],
        icon: <Box className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Connections',
        to: CONNECTIONS_BASE_PATH,
        tabs: ['Connections'],
        icon: <Icons.Connections className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Secrets',
        to: `/settings/${getSlugForProfileTab('Secrets')}`,
        tabs: ['Secrets'],
        icon: <Lock className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'API keys',
        to: `/settings/${getSlugForProfileTab('Models')}`,
        tabs: ['Models'],
        // the key, the same icon as "Your keys" in the model switch of the prompt box
        icon: <KeyRound className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Billing',
        to: `/settings/${getSlugForProfileTab('Billing')}`,
        tabs: ['Billing'],
        icon: <CreditCard className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Usage',
        to: `/settings/${getSlugForProfileTab('Usage')}`,
        tabs: ['Usage', 'Analytics'],
        icon: <BarChart3 className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Members',
        to: `/settings/${getSlugForProfileTab('Members')}`,
        tabs: ['Members'],
        icon: <Users className={navIconClass} strokeWidth={1.5} />,
    },
]

const NAV_LINKS = [
    {
        label: 'Changelog',
        path: '/docs/changelog',
        icon: <FileClock className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Privacy Policy',
        path: '/privacy',
        icon: <FileText className={navIconClass} strokeWidth={1.5} />,
    },
    {
        label: 'Terms of Service',
        path: '/terms',
        icon: <FileText className={navIconClass} strokeWidth={1.5} />,
    },
]

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut, onBack }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const isAuthRestored = useAppStore((s) => s.isAuthRestored)
    const openMobileSheet = useAppStore((s) => s.openMobileSheet)
    const isPhone = useIsPhone()

    const activeTabMatch = location.pathname.match(
        /^\/(?:profile|settings|integrations|connections|connectors)(?:\/([^/]+))?/
    )
    let activeTabSlug = activeTabMatch ? activeTabMatch[1] : undefined
    if (
        !activeTabSlug &&
        (location.pathname.startsWith('/integrations') ||
            location.pathname.startsWith('/connections') ||
            location.pathname.startsWith('/connectors'))
    ) {
        activeTabSlug = 'integrations'
    }

    React.useEffect(() => {
        if (activeTabSlug === 'privacy' || activeTabSlug === 'terms') {
            const landingUrl = getWebUrl()
            window.open(`${landingUrl}/${activeTabSlug}`, '_blank', 'noopener,noreferrer')
            navigate('/settings', { replace: true })
        }
    }, [activeTabSlug, navigate])

    // connections is a page of settings. its old urls open it too, and the page redirects them
    const isConnections =
        /^\/(?:integrations|connections|connectors)(?:\/|$)/.test(location.pathname) ||
        ['connections', 'integrations'].includes(activeTabSlug ?? '')
    const activeTab = isConnections ? 'Connections' : getProfileTabFromSlug(activeTabSlug)
    const isPublicTab = activeTabSlug === 'privacy' || activeTabSlug === 'terms'

    React.useEffect(() => {
        if (isAuthRestored && !isAuthenticated && !isPublicTab) {
            navigate('/', { replace: true })
        }
    }, [isAuthRestored, isAuthenticated, isPublicTab, navigate])

    const isMobileRoot =
        !activeTabSlug &&
        !location.pathname.startsWith('/integrations') &&
        !location.pathname.startsWith('/connections') &&
        !location.pathname.startsWith('/connectors')

    // phones have no settings list page: the list is a level of the menu sheet (A1)
    React.useEffect(() => {
        if (!isPhone || !isMobileRoot || !isAuthenticated) return
        navigate('/', { replace: true })
        openMobileSheet('settings')
    }, [isPhone, isMobileRoot, isAuthenticated, navigate, openMobileSheet])

    // fallback for hash backward compatibility
    React.useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash === '#billing') {
            window.history.replaceState(null, '', window.location.pathname)
            navigate(`/settings/${getSlugForProfileTab('Billing')}`, { replace: true })
        }
    }, [navigate])
    const [deleteAccountModalOpen, setDeleteAccountModalOpen] = React.useState(false)
    const [signOutAllSessionsModalOpen, setSignOutAllSessionsModalOpen] = React.useState(false)
    const [feedbackModalOpen, setFeedbackModalOpen] = React.useState(false)
    const [topBarAction, setTopBarAction] = React.useState<SettingsTopBarAction | null>(null)

    const {
        profile,
        isProfileLoading,
        isProfileFetching,
        profileError,
        profileActionError,
        setProfileActionError,
        nameModalOpen,
        tempName,
        setNameModalOpen,
        setTempName,
        updateNameMutation,
        isGithubConnected,
        resolvedName,
        openNameModal,
        handleSaveName,
        handleNotificationChange,
        connectGithub,
    } = useProfileSettingsController()

    const profileErrorMessage =
        profileActionError ??
        (profileError instanceof Error
            ? profileError.message
            : profileError
              ? 'Failed to load profile'
              : null)

    const renderTabContent = () => {
        // these pages keep their values in the browser, so they do not wait for the profile
        if (activeTab === 'Defaults') return <ProfileDefaultsSettings />
        if (activeTab === 'PullRequests') return <ProfilePullRequestSettings />
        if (activeTab === 'Sandbox') return <ProfileSandboxSettings />
        if (activeTab === 'Members') {
            return (
                <ProfileMembersSettings
                    ownerName={profile?.name || resolvedName}
                    ownerEmail={profile?.email || ''}
                />
            )
        }

        if (isProfileLoading && !profile) {
            return <ProfileSettingsSkeleton activeTab={activeTab} />
        }

        if (isSkeletonPreviewActive()) {
            switch (activeTab) {
                case 'Repositories':
                    return (
                        <ProfileRepositoriesSettings
                            isGithubConnected={isGithubConnected}
                            onConnectGithub={connectGithub}
                        />
                    )
                case 'Secrets':
                    return <ProfileSecretsSettings />
                case 'Models':
                    return <ProfileModelKeysSettings />
                case 'Billing':
                    return <ProfileBillingSettings profile={profile} />
                case 'Usage':
                case 'Analytics':
                    return <ProfileUsageSettings />
                default:
                    return <ProfileSettingsSkeleton activeTab={activeTab} />
            }
        }

        switch (activeTab) {
            case 'Account':
                return (
                    <ProfileSettingsContent
                        profile={profile}
                        resolvedName={resolvedName}
                        onOpenNameModal={openNameModal}
                        onNotificationChange={handleNotificationChange}
                        onSignOut={onSignOut}
                        onOpenDeleteAccountModal={() => setDeleteAccountModalOpen(true)}
                        onOpenSignOutAllSessionsModal={() => setSignOutAllSessionsModalOpen(true)}
                    />
                )
            case 'Billing':
                return <ProfileBillingSettings profile={profile} />
            case 'Usage':
            case 'Analytics':
                return <ProfileUsageSettings />
            case 'Repositories':
                return (
                    <ProfileRepositoriesSettings
                        isGithubConnected={isGithubConnected}
                        onConnectGithub={connectGithub}
                    />
                )
            case 'Secrets':
                return <ProfileSecretsSettings />
            case 'Models':
                return <ProfileModelKeysSettings />
            default:
                return (
                    <div className="flex flex-col gap-6">
                        <h1 className="text-[20px] font-medium text-[#D6D5C9]">{activeTab}</h1>
                    </div>
                )
        }
    }

    if (!isPublicTab && (!isAuthRestored || !isAuthenticated)) {
        return null
    }

    return (
        <SettingsTopBarContext.Provider value={setTopBarAction}>
            <div className="flex w-full h-full bg-[#141414] md:bg-[#100E12] overflow-hidden p-0 md:p-[8px] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                <div className="flex flex-col md:flex-row w-full h-full bg-[#141414] rounded-none md:rounded-lg border-0 md:border md:border-[#242323] overflow-hidden no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                    {/* Desktop sidebar: visible only on md: and up */}
                    <div className="hidden md:flex w-[220px] shrink-0 border-r border-[#242323] flex-col py-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        <div className="px-4 mb-6">
                            <button
                                onClick={onBack}
                                className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#191919] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4 mr-2" />
                                Back
                            </button>
                        </div>

                        <div className="flex flex-col gap-[2px] px-3 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                            {NAV_ITEMS.map((item) => (
                                <button
                                    key={item.label}
                                    onClick={() => navigate(item.to)}
                                    className={navItemClass(item.tabs.includes(activeTab))}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            ))}

                            {/* links: the one gap in the list sets them apart */}
                            <div className="h-3 shrink-0" />
                            {NAV_LINKS.map((link) => (
                                <a
                                    key={link.label}
                                    href={`${getWebUrl()}${link.path}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        window.open(
                                            `${getWebUrl()}${link.path}`,
                                            '_blank',
                                            'noopener,noreferrer'
                                        )
                                    }}
                                    className={cn(navItemClass(false), 'justify-between')}
                                >
                                    <span className="flex items-center gap-3">
                                        {link.icon}
                                        {link.label}
                                    </span>
                                    <ArrowUpRight
                                        className="w-[14px] h-[14px] text-[#7B7A79]"
                                        strokeWidth={1.5}
                                    />
                                </a>
                            ))}
                            <button
                                onClick={() => setFeedbackModalOpen(true)}
                                className={navItemClass(false)}
                            >
                                <MessageSquare className={navIconClass} strokeWidth={1.5} />
                                Send feedback
                            </button>
                        </div>
                    </div>

                    {activeTab === 'Connections' ? (
                        // the connections page brings its own top bar, tabs and scrolling
                        <div className="flex-1 min-w-0 min-h-0">
                            <ConnectionsPage />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                            {/* Mobile top bar: "‹ Settings" opens the Settings level of the menu sheet */}
                            <MobileTopBar
                                left={
                                    <MobileBackButton
                                        label="Back"
                                        onClick={() => openMobileSheet('settings')}
                                    />
                                }
                                right={
                                    topBarAction && (
                                        <MobileIconButton
                                            onClick={topBarAction.onClick}
                                            label={topBarAction.label}
                                            filled
                                        >
                                            <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
                                        </MobileIconButton>
                                    )
                                }
                            />

                            {/* Mobile Content: Active Tab Content directly rendered */}
                            <div
                                className={cn(
                                    'md:hidden flex-col p-4 pb-6 w-full no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]',
                                    isMobileRoot ? 'hidden' : 'flex'
                                )}
                            >
                                {profileErrorMessage && (
                                    <div className="mb-4">
                                        <ErrorAlert
                                            message={profileErrorMessage}
                                            onClear={() => setProfileActionError(null)}
                                        />
                                    </div>
                                )}
                                {renderTabContent()}
                            </div>

                            {/* Desktop Content Render: always visible on md: and up */}
                            <div className="hidden md:flex flex-1 justify-center px-6 md:px-16 pt-8 md:pt-16 pb-6 md:pb-8 relative z-10 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                                <div className="flex flex-col items-end gap-2 absolute top-8 md:top-16 right-6 md:right-16">
                                    {profileErrorMessage && (
                                        <ErrorAlert
                                            message={profileErrorMessage}
                                            onClear={() => setProfileActionError(null)}
                                        />
                                    )}
                                </div>
                                {renderTabContent()}
                            </div>
                        </div>
                    )}
                </div>

                <ProfileNameModal
                    isOpen={nameModalOpen}
                    value={tempName}
                    isPending={updateNameMutation.isPending}
                    errorMessage={nameModalOpen ? profileActionError : null}
                    onClose={() => {
                        setNameModalOpen(false)
                        setProfileActionError(null)
                    }}
                    onChange={setTempName}
                    onSave={handleSaveName}
                />

                <ProfileDeleteAccountModal
                    isOpen={deleteAccountModalOpen}
                    onClose={() => setDeleteAccountModalOpen(false)}
                    onConfirm={async () => {
                        try {
                            const { profileAPI } = await import('@/features/profile/api/profile')
                            await profileAPI.deleteAccount()
                            setDeleteAccountModalOpen(false)
                            onSignOut()
                        } catch (error) {
                            console.error('Failed to delete account', error)
                        }
                    }}
                />

                <ProfileSignOutAllSessionsModal
                    isOpen={signOutAllSessionsModalOpen}
                    onClose={() => setSignOutAllSessionsModalOpen(false)}
                    onConfirm={async () => {
                        try {
                            const { profileAPI } = await import('@/features/profile/api/profile')
                            await profileAPI.signoutAll()
                            setSignOutAllSessionsModalOpen(false)
                            onSignOut()
                        } catch (error) {
                            console.error('Failed to sign out of all sessions', error)
                        }
                    }}
                />

                <ProfileFeedbackModal
                    isOpen={feedbackModalOpen}
                    onClose={() => setFeedbackModalOpen(false)}
                />
            </div>
        </SettingsTopBarContext.Provider>
    )
}
