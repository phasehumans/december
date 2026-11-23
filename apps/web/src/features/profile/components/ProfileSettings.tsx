import {
    ChevronLeft,
    UserCircle,
    CreditCard,
    FileClock,
    ArrowUpRight,
    KeyRound,
    FileText,
    Activity,
    Cpu,
} from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useProfileSettingsController } from '../hooks/useProfileSettingsController'

import { MobileSettingsList } from './MobileSettingsList'
import { ProfileBillingSettings } from './ProfileBillingSettings'
import { ProfileDeleteAccountModal } from './ProfileDeleteAccountModal'
import { ProfileModelKeysSettings } from './ProfileModelKeysSettings'
import { ProfileNameModal } from './ProfileNameModal'
import { ProfileRepositoriesSettings } from './ProfileRepositoriesSettings'
import { ProfileSecretsSettings } from './ProfileSecretsSettings'
import { ProfileSettingsContent } from './ProfileSettingsContent'
import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'
import { ProfileSignOutAllSessionsModal } from './ProfileSignOutAllSessionsModal'
import { ProfileUsageSettings } from './ProfileUsageSettings'

import type { ProfileSettingsProps } from '@/features/profile/types'

import { useAppStore } from '@/app/store'
import { getProfileTabFromSlug, getSlugForProfileTab } from '@/app/types'
import { ConnectionsPage } from '@/features/connections/components/ConnectionsPage'
import { CONNECTIONS_BASE_PATH } from '@/features/connections/lib/paths'
import { MobileBackButton, MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Icons } from '@/shared/components/ui/Icons'
import { getWebUrl } from '@/shared/config/env'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { cn } from '@/shared/lib/utils'

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut, onBack }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const isAuthRestored = useAppStore((s) => s.isAuthRestored)

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
        ['connections', 'integrations', 'repositories'].includes(activeTabSlug ?? '')
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

    // fallback for hash backward compatibility
    React.useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash === '#billing') {
            window.history.replaceState(null, '', window.location.pathname)
            navigate(`/settings/${getSlugForProfileTab('Billing')}`, { replace: true })
        }
    }, [navigate])
    const [deleteAccountModalOpen, setDeleteAccountModalOpen] = React.useState(false)
    const [signOutAllSessionsModalOpen, setSignOutAllSessionsModalOpen] = React.useState(false)

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
        updateNotificationMutation,
        isGithubConnected,
        emailNotifications,
        productUpdates,
        securityAlerts,
        resolvedName,
        openNameModal,
        handleSaveName,
        handleNotificationToggle,
        connectGithub,
    } = useProfileSettingsController()

    const profileErrorMessage =
        profileActionError ??
        (profileError instanceof Error
            ? profileError.message
            : profileError
              ? 'Failed to load profile'
              : null)

    const hasProfile = Boolean(profile)

    const renderTabContent = () => {
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
                        hasProfile={hasProfile}
                        isGithubConnected={isGithubConnected}
                        emailNotifications={emailNotifications}
                        productUpdates={productUpdates}
                        securityAlerts={securityAlerts}
                        isNotificationPending={updateNotificationMutation.isPending}
                        onOpenNameModal={openNameModal}
                        onNotificationToggle={handleNotificationToggle}
                        onConnectGithub={connectGithub}
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
                        <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mb-1">
                            Settings
                        </div>

                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Account')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                activeTab === 'Account'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <UserCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Account
                        </button>

                        <button
                            onClick={() => navigate(CONNECTIONS_BASE_PATH)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                activeTab === 'Connections'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Icons.Connections className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Connections
                        </button>
                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Secrets')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                activeTab === 'Secrets'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <KeyRound className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Secrets
                        </button>
                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Models')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                activeTab === 'Models'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Cpu className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Model keys
                        </button>
                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Billing')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                activeTab === 'Billing'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <CreditCard className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Billing
                        </button>
                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Usage')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                activeTab === 'Usage' || activeTab === 'Analytics'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Activity className="w-[18px] h-[18px]" strokeWidth={1.75} />
                            Usage
                        </button>

                        <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mt-4 mb-1">
                            Resources
                        </div>
                        <a
                            href={`${getWebUrl()}/privacy`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                e.preventDefault()
                                window.open(
                                    `${getWebUrl()}/privacy`,
                                    '_blank',
                                    'noopener,noreferrer'
                                )
                            }}
                            className="flex items-center justify-between px-3 py-1.5 rounded-[10px] text-[#D6D5C9] hover:bg-[#191919] text-[13px] font-medium transition-colors group whitespace-nowrap shrink-0 cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Privacy Policy
                            </div>
                            <ArrowUpRight
                                className="w-[14px] h-[14px] text-[#7B7A79]"
                                strokeWidth={1.5}
                            />
                        </a>
                        <a
                            href={`${getWebUrl()}/terms`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                e.preventDefault()
                                window.open(`${getWebUrl()}/terms`, '_blank', 'noopener,noreferrer')
                            }}
                            className="flex items-center justify-between px-3 py-1.5 rounded-[10px] text-[#D6D5C9] hover:bg-[#191919] text-[13px] font-medium transition-colors group whitespace-nowrap shrink-0 cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Terms of Service
                            </div>
                            <ArrowUpRight
                                className="w-[14px] h-[14px] text-[#7B7A79]"
                                strokeWidth={1.5}
                            />
                        </a>
                        <a
                            href={`${getWebUrl()}/docs/changelog`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-3 py-1.5 rounded-[10px] text-[#D6D5C9] hover:bg-[#191919] text-[13px] font-medium transition-colors group whitespace-nowrap shrink-0"
                        >
                            <div className="flex items-center gap-3">
                                <FileClock className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Changelog
                            </div>
                            <ArrowUpRight
                                className="w-[14px] h-[14px] text-[#7B7A79]"
                                strokeWidth={1.5}
                            />
                        </a>
                    </div>
                </div>

                {activeTab === 'Connections' ? (
                    // the connections page brings its own top bar, tabs and scrolling
                    <div className="flex-1 min-w-0 min-h-0">
                        <ConnectionsPage />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        {/* Mobile top bar: list page at /settings, "‹ Settings" on a page */}
                        {isMobileRoot ? (
                            <MobileTopBar title="Settings" />
                        ) : (
                            <MobileTopBar
                                left={
                                    <MobileBackButton
                                        label="Settings"
                                        onClick={() => navigate('/settings')}
                                    />
                                }
                            />
                        )}

                        {isMobileRoot && (
                            <MobileSettingsList
                                onOpenPage={(slug) => navigate(`/settings/${slug}`)}
                                onSignOut={onSignOut}
                            />
                        )}

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
                        <div className="hidden md:flex flex-1 justify-center px-6 md:px-16 pt-8 md:pt-12 pb-6 md:pb-8 relative z-10 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                            <div className="flex flex-col items-end gap-2 absolute top-8 md:top-12 right-6 md:right-16">
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
        </div>
    )
}
