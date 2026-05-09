import React from 'react'
import {
    ChevronLeft,
    UserCircle,
    SlidersHorizontal,
    CreditCard,
    Activity,
    KeyRound,
    BookText,
    FileClock,
    ArrowUpRight,
    Plug,
} from 'lucide-react'

import { Icons } from '@/shared/components/ui/Icons'

import { useProfileSettingsController } from '../hooks/useProfileSettingsController'

import { ProfileNameModal } from './ProfileNameModal'
import { ProfilePasswordModal } from './ProfilePasswordModal'
import { ProfileSettingsContent } from './ProfileSettingsContent'
import { ProfileGeneralSettings } from './ProfileGeneralSettings'
import { ProfileBillingSettings } from './ProfileBillingSettings'
import { ProfileUsageSettings } from './ProfileUsageSettings'
import { ProfileApiKeysSettings } from './ProfileApiKeysSettings'
import { ProfileIntegrationsSettings } from './ProfileIntegrationsSettings'
import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'
import { ProfileDeleteAccountModal } from './ProfileDeleteAccountModal'
import { ProfileSignOutAllSessionsModal } from './ProfileSignOutAllSessionsModal'

import type { ProfileSettingsProps } from '@/features/profile/types'

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut, onBack, onDocs }) => {
    const [activeTab, setActiveTab] = React.useState(() => {
        if (typeof window !== 'undefined' && window.location.hash === '#billing') {
            window.history.replaceState(null, '', window.location.pathname)
            return 'Billing'
        }
        return 'Account'
    })
    const [usernameModalOpen, setUsernameModalOpen] = React.useState(false)
    const [tempUsername, setTempUsername] = React.useState('')
    const [deleteAccountModalOpen, setDeleteAccountModalOpen] = React.useState(false)
    const [signOutAllSessionsModalOpen, setSignOutAllSessionsModalOpen] = React.useState(false)

    const {
        profile,
        isProfileLoading,
        isProfileFetching,
        profileError,
        profileActionError,
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
        emailNotifications,
        resolvedName,
        openNameModal,
        openPasswordModal,
        handleSaveName,
        handleUpdatePassword,
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

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px]">
            <div className="flex w-full h-full bg-[#171615] rounded-lg border border-[#242323] overflow-hidden">
                {/* Settings Sidebar */}
                <div className="w-[220px] shrink-0 border-r border-[#242323] flex flex-col py-4">
                    <div className="px-4 mb-6">
                        <button
                            onClick={onBack}
                            className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#1E1D1B] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors"
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
                            onClick={() => setActiveTab('Account')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Account'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                            }`}
                        >
                            <UserCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Account
                        </button>
                        <button
                            onClick={() => setActiveTab('Preferences')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Preferences'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                            }`}
                        >
                            <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Preferences
                        </button>
                        <button
                            onClick={() => setActiveTab('Integrations')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Integrations'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                            }`}
                        >
                            <Plug className="w-[18px] h-[18px] rotate-45" strokeWidth={1.5} />
                            Integrations
                        </button>
                        <button
                            onClick={() => setActiveTab('Billing')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Billing'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                            }`}
                        >
                            <CreditCard className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Billing
                        </button>
                        <button
                            onClick={() => setActiveTab('Usage')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Usage'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                            }`}
                        >
                            <Activity className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Usage
                        </button>
                        {/* <button
                            onClick={() => setActiveTab('API Keys')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'API Keys'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                            }`}
                        >
                            <KeyRound className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            API Keys
                        </button> */}

                        <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mt-4 mb-1">
                            Resources
                        </div>
                        <button
                            onClick={onDocs}
                            className="flex items-center justify-between px-3 py-1.5 rounded-xl text-[#D6D5C9] hover:bg-[#1E1D1B] text-[13px] font-medium transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <Icons.DocsBook className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Documentation
                            </div>
                            <ArrowUpRight
                                className="w-[14px] h-[14px] text-[#D6D5C9]"
                                strokeWidth={1.5}
                            />
                        </button>
                        <button
                            onClick={onDocs}
                            className="flex items-center justify-between px-3 py-1.5 rounded-xl text-[#D6D5C9] hover:bg-[#1E1D1B] text-[13px] font-medium transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <FileClock className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Changelog
                            </div>
                            <ArrowUpRight
                                className="w-[14px] h-[14px] text-[#D6D5C9]"
                                strokeWidth={1.5}
                            />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#171615] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                    <div className="w-full flex justify-center px-8 md:px-16 py-8 md:py-12 relative z-10">
                        <div className="flex flex-col items-end gap-2 absolute top-12 right-16">
                            {isProfileFetching && !isProfileLoading && (
                                <div className="text-xs text-neutral-500">Syncing profile...</div>
                            )}
                            {profileErrorMessage && (
                                <div className="max-w-[26rem] truncate rounded-full border border-red-500/35 bg-red-500/15 px-4 py-1 text-xs font-medium text-red-200">
                                    {profileErrorMessage}
                                </div>
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
                                isNotificationPending={updateNotificationMutation.isPending}
                                onOpenNameModal={openNameModal}
                                onOpenUsernameModal={() => {
                                    setTempUsername(profile?.githubUsername || 'phasehuman')
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
                            <ProfileGeneralSettings />
                        ) : activeTab === 'Billing' ? (
                            <ProfileBillingSettings />
                        ) : activeTab === 'Usage' ? (
                            <ProfileUsageSettings />
                        ) : activeTab === 'API Keys' ? (
                            <ProfileApiKeysSettings />
                        ) : activeTab === 'Integrations' ? (
                            <ProfileIntegrationsSettings
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
                onClose={() => setNameModalOpen(false)}
                onChange={setTempName}
                onSave={handleSaveName}
            />

            <ProfileNameModal
                isOpen={usernameModalOpen}
                value={tempUsername}
                isPending={updateUsernameMutation.isPending}
                title="Change Username"
                label="Username"
                onClose={() => setUsernameModalOpen(false)}
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
                onClose={() => setPasswordModalOpen(false)}
                onUpdatePassword={handleUpdatePassword}
                onCurrentPasswordChange={setCurrentPassword}
                onNewPasswordChange={setNewPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onToggleShowCurrentPass={() => setShowCurrentPass((prev) => !prev)}
                onToggleShowNewPass={() => setShowNewPass((prev) => !prev)}
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
