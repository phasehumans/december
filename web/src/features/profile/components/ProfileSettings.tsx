import React from 'react'
import {
    ChevronLeft,
    UserCircle,
    Settings,
    Palette,
    Bot,
    Keyboard,
    Bell,
    Monitor,
    Plug,
    Building2,
    BookOpen,
    Code2,
    ExternalLink,
} from 'lucide-react'

import { useProfileSettingsController } from '../hooks/useProfileSettingsController'

import { ProfileNameModal } from './ProfileNameModal'
import { ProfilePasswordModal } from './ProfilePasswordModal'
import { ProfileSettingsContent } from './ProfileSettingsContent'
import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'

import type { ProfileSettingsProps } from '@/features/profile/types'

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut, onBack }) => {
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
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden">
            <div className="flex w-full h-full bg-[#171615] rounded-[24px] border border-white/5 m-2 md:m-4 overflow-hidden">
                {/* Settings Sidebar */}
                <div className="w-[240px] shrink-0 border-r border-white/5 flex flex-col py-4">
                    <div className="px-4 mb-6">
                        <button
                            onClick={onBack}
                            className="flex items-center text-[#969593] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Home
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-[2px]">
                        <div className="px-3 py-2 text-[11px] font-medium text-[#969593] mb-1">
                            Account
                        </div>

                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#252422] text-[#D6D5D4] text-[13px] font-medium">
                            <UserCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Account
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Settings className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Preferences
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Palette className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Personalisation
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Bot className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Assistant
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Keyboard className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Shortcuts
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Notifications
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Monitor className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Computer
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Plug className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Connectors
                        </button>

                        <div className="px-3 py-2 text-[11px] font-medium text-[#969593] mt-4 mb-1">
                            Enterprise
                        </div>
                        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors">
                            <Building2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Upgrade to Enterprise
                        </button>
                        <button className="flex items-center justify-between px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors group">
                            <div className="flex items-center gap-3">
                                <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                Learn more
                            </div>
                            <ExternalLink
                                className="w-3.5 h-3.5 text-[#969593]"
                                strokeWidth={1.5}
                            />
                        </button>

                        <div className="px-3 py-2 text-[11px] font-medium text-[#969593] mt-4 mb-1">
                            API
                        </div>
                        <button className="flex items-center justify-between px-3 py-2 rounded-xl text-[#969593] hover:bg-white/[0.04] hover:text-[#D6D5D4] text-[13px] font-medium transition-colors group">
                            <div className="flex items-center gap-3">
                                <Code2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
                                API Platform
                            </div>
                            <ExternalLink
                                className="w-3.5 h-3.5 text-[#969593]"
                                strokeWidth={1.5}
                            />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div className="max-w-4xl mx-auto px-8 md:px-16 py-12 md:py-20 relative z-10">
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
                            <ProfileSettingsSkeleton />
                        ) : (
                            <ProfileSettingsContent
                                resolvedName={resolvedName}
                                hasProfile={Boolean(profile)}
                                isGithubConnected={isGithubConnected}
                                emailNotifications={emailNotifications}
                                isNotificationPending={updateNotificationMutation.isPending}
                                onOpenNameModal={openNameModal}
                                onOpenPasswordModal={openPasswordModal}
                                onNotificationToggle={handleNotificationToggle}
                                onConnectGithub={connectGithub}
                                onSignOut={onSignOut}
                            />
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
        </div>
    )
}
