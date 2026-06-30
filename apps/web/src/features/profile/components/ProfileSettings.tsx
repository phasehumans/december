import {
    ChevronLeft,
    UserCircle,
    SlidersHorizontal,
    CreditCard,
    Activity,
    FileClock,
    ArrowUpRight,
    Plug,
    FolderGit2,
    Server,
} from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useProfileSettingsController } from '../hooks/useProfileSettingsController'

import { ConnectCliModal } from './ConnectCliModal'
import { ProfileApiKeysSettings } from './ProfileApiKeysSettings'
import { ProfileBillingSettings } from './ProfileBillingSettings'
import { ProfileDeleteAccountModal } from './ProfileDeleteAccountModal'
import { ProfileGeneralSettings } from './ProfileGeneralSettings'
import { ProfileIntegrationsSettings } from './ProfileIntegrationsSettings'
import { ProfileRepositoriesSettings } from './ProfileRepositoriesSettings'
import { ProfileNameModal } from './ProfileNameModal'
import { ProfilePasswordModal } from './ProfilePasswordModal'
import { ProfileSettingsContent } from './ProfileSettingsContent'
import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'
import { ProfileSignOutAllSessionsModal } from './ProfileSignOutAllSessionsModal'
import { ProfileUsageSettings } from './ProfileUsageSettings'

import type { ProfileSettingsProps } from '@/features/profile/types'

import { getProfileTabFromSlug, getSlugForProfileTab } from '@/app/types'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Icons } from '@/shared/components/ui/Icons'

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut, onBack, onDocs }) => {
    const location = useLocation()
    const navigate = useNavigate()

    const activeTabMatch = location.pathname.match(/^\/(?:profile|settings)\/([^/]+)/)
    const activeTabSlug = activeTabMatch ? activeTabMatch[1] : undefined
    const activeTab = getProfileTabFromSlug(activeTabSlug)

    // Fallback for hash backward compatibility
    React.useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash === '#billing') {
            window.history.replaceState(null, '', window.location.pathname)
            navigate(`/settings/${getSlugForProfileTab('Billing')}`, { replace: true })
        }
    }, [navigate])
    const [usernameModalOpen, setUsernameModalOpen] = React.useState(false)
    const [tempUsername, setTempUsername] = React.useState('')
    const [deleteAccountModalOpen, setDeleteAccountModalOpen] = React.useState(false)
    const [signOutAllSessionsModalOpen, setSignOutAllSessionsModalOpen] = React.useState(false)
    const [connectCliModalOpen, setConnectCliModalOpen] = React.useState(false)

    const {
        profile,
        isProfileLoading,
        isProfileFetching,
        profileError,
        profileActionError,
        setProfileActionError,
        nameModalOpen,
        tempName,
        passwordModalOpen,
        showCurrentPass,
        showNewPass,
        currentPassword,
        newPassword,
        confirmPassword,
        setNameModalOpen,
        setTempName,
        setPasswordModalOpen,
        setShowCurrentPass,
        setShowNewPass,
        setCurrentPassword,
        setNewPassword,
        setConfirmPassword,
        updateNameMutation,
        updateUsernameMutation,
        updatePasswordMutation,
        updateNotificationMutation,
        isGithubConnected,
        isVercelConnected,
        isSupabaseConnected,
        isNotionConnected,
        emailNotifications,
        productUpdates,
        securityAlerts,
        chatSuggestions,
        generationSound,
        resolvedName,
        openNameModal,
        openPasswordModal,
        handleSaveName,
        handleUpdatePassword,
        handleNotificationToggle,
        handleChatSuggestionsToggle,
        handleGenerationSoundChange,
        connectGithub,
        connectVercel,
        connectSupabase,
        connectNotion,
    } = useProfileSettingsController()

    const profileErrorMessage =
        profileActionError ??
        (profileError instanceof Error
            ? profileError.message
            : profileError
              ? 'Failed to load profile'
              : null)

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px]">
            <div className="flex w-full h-full bg-[#141414] rounded-lg border border-[#242323] overflow-hidden">
                {/* Settings Sidebar */}
                <div className="w-[220px] shrink-0 border-r border-[#242323] flex flex-col py-4">
                    <div className="px-4 mb-6">
                        <button
                            onClick={onBack}
                            className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#191919] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Home
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-[2px]">
                        <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mb-1">
                            Settings
                        </div>

                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Account')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Account'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <UserCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Account
                        </button>
                        <button
                            onClick={() =>
                                navigate(`/settings/${getSlugForProfileTab('Preferences')}`)
                            }
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Preferences'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Preferences
                        </button>
                        <button
                            onClick={() =>
                                navigate(`/settings/${getSlugForProfileTab('Integrations')}`)
                            }
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Integrations'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Plug className="w-[18px] h-[18px] rotate-45" strokeWidth={1.5} />
                            Integrations
                        </button>
                        <button
                            onClick={() =>
                                navigate(`/settings/${getSlugForProfileTab('MCP Server')}`)
                            }
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'MCP Server'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Server className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            MCP Server
                        </button>
                        <button
                            onClick={() =>
                                navigate(`/settings/${getSlugForProfileTab('Repositories')}`)
                            }
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Repositories'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <FolderGit2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Repositories
                        </button>
                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Billing')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Billing'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <CreditCard className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Credits
                        </button>
                        <button
                            onClick={() => navigate(`/settings/${getSlugForProfileTab('Usage')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Usage'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Activity className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Usage
                        </button>
                        {/* <button
                            onClick={() => navigate(`/profile/${getSlugForProfileTab('API Keys')}`)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'API Keys'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <KeyRound className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            API Keys
                        </button> */}

                        <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mt-4 mb-1">
                            Resources
                        </div>
                        <a
                            href="https://github.com/phasehumans/december/tree/main/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-3 py-1.5 rounded-xl text-[#D6D5C9] hover:bg-[#191919] text-[13px] font-medium transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <Icons.DocsBook className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Documentation
                            </div>
                            <ArrowUpRight
                                className="w-[14px] h-[14px] text-[#D6D5C9]"
                                strokeWidth={1.5}
                            />
                        </a>
                        <a
                            href="https://github.com/phasehumans/december/blob/main/CHANGELOG.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-3 py-1.5 rounded-xl text-[#D6D5C9] hover:bg-[#191919] text-[13px] font-medium transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <FileClock className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Changelog
                            </div>
                            <ArrowUpRight
                                className="w-[14px] h-[14px] text-[#D6D5C9]"
                                strokeWidth={1.5}
                            />
                        </a>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#141414] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                    <div className="w-full flex justify-center px-8 md:px-16 py-8 md:py-12 relative z-10">
                        <div className="flex flex-col items-end gap-2 absolute top-12 right-16">
                            {profileErrorMessage && (
                                <ErrorAlert
                                    message={profileErrorMessage}
                                    onClear={() => setProfileActionError(null)}
                                />
                            )}
                        </div>

                        {isProfileLoading && !profile ? (
                            <ProfileSettingsSkeleton activeTab={activeTab} />
                        ) : activeTab === 'Account' ? (
                            <ProfileSettingsContent
                                profile={profile}
                                resolvedName={resolvedName}
                                hasProfile={Boolean(profile)}
                                isGithubConnected={isGithubConnected}
                                emailNotifications={emailNotifications}
                                productUpdates={productUpdates}
                                securityAlerts={securityAlerts}
                                isNotificationPending={updateNotificationMutation.isPending}
                                onOpenNameModal={openNameModal}
                                onOpenUsernameModal={() => {
                                    setTempUsername(profile?.username || '')
                                    setUsernameModalOpen(true)
                                }}
                                onOpenPasswordModal={openPasswordModal}
                                onNotificationToggle={handleNotificationToggle}
                                onConnectGithub={connectGithub}
                                onSignOut={onSignOut}
                                onOpenDeleteAccountModal={() => setDeleteAccountModalOpen(true)}
                                onOpenSignOutAllSessionsModal={() =>
                                    setSignOutAllSessionsModalOpen(true)
                                }
                            />
                        ) : activeTab === 'Preferences' ? (
                            <ProfileGeneralSettings
                                chatSuggestions={chatSuggestions}
                                generationSound={generationSound}
                                onChatSuggestionsToggle={handleChatSuggestionsToggle}
                                onGenerationSoundChange={handleGenerationSoundChange}
                            />
                        ) : activeTab === 'Billing' ? (
                            <ProfileBillingSettings profile={profile} />
                        ) : activeTab === 'Usage' ? (
                            <ProfileUsageSettings />
                        ) : activeTab === 'API Keys' ? (
                            <ProfileApiKeysSettings />
                        ) : activeTab === 'Integrations' ? (
                            <ProfileIntegrationsSettings
                                isGithubConnected={isGithubConnected}
                                isVercelConnected={isVercelConnected}
                                isSupabaseConnected={isSupabaseConnected}
                                isNotionConnected={isNotionConnected}
                                onConnectGithub={connectGithub}
                                onConnectVercel={connectVercel}
                                onConnectSupabase={connectSupabase}
                                onConnectNotion={connectNotion}
                            />
                        ) : activeTab === 'Repositories' ? (
                            <ProfileRepositoriesSettings
                                isGithubConnected={isGithubConnected}
                                onConnectGithub={connectGithub}
                            />
                        ) : (
                            <div className="flex flex-col gap-6">
                                <h1 className="text-[20px] font-medium text-[#D6D5C9]">
                                    {activeTab}
                                </h1>
                            </div>
                        )}
                    </div>
                </div>
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

            <ProfileNameModal
                isOpen={usernameModalOpen}
                value={tempUsername}
                isPending={updateUsernameMutation.isPending}
                title="Change Username"
                label="Username"
                errorMessage={usernameModalOpen ? profileActionError : null}
                onClose={() => {
                    setUsernameModalOpen(false)
                    setProfileActionError(null)
                }}
                onChange={setTempUsername}
                onSave={() => {
                    if (tempUsername.trim()) {
                        updateUsernameMutation.mutate(
                            { username: tempUsername.trim() },
                            {
                                onSuccess: () => {
                                    setUsernameModalOpen(false)
                                },
                            }
                        )
                    }
                }}
            />

            <ProfilePasswordModal
                isOpen={passwordModalOpen}
                isPending={updatePasswordMutation.isPending}
                currentPassword={currentPassword}
                newPassword={newPassword}
                confirmPassword={confirmPassword}
                showCurrentPass={showCurrentPass}
                showNewPass={showNewPass}
                errorMessage={passwordModalOpen ? profileActionError : null}
                onClose={() => {
                    setPasswordModalOpen(false)
                    setProfileActionError(null)
                }}
                onUpdatePassword={handleUpdatePassword}
                onCurrentPasswordChange={setCurrentPassword}
                onNewPasswordChange={setNewPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onToggleShowCurrentPass={() => setShowCurrentPass((prev) => !prev)}
                onToggleShowNewPass={() => setShowNewPass((prev) => !prev)}
                hasPassword={profile?.hasPassword}
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

            <ConnectCliModal
                isOpen={connectCliModalOpen}
                onClose={() => setConnectCliModalOpen(false)}
                userId={profile?.id}
            />
        </div>
    )
}
