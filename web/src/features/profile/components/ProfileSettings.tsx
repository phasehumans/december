import React from 'react'
import { useProfileSettingsController } from '../hooks/useProfileSettingsController'
import { ProfileNameModal } from './ProfileNameModal'
import { ProfilePasswordModal } from './ProfilePasswordModal'
import { ProfileSettingsContent } from './ProfileSettingsContent'
import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'
import type { ProfileSettingsProps } from '@/features/profile/types'

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut }) => {
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

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans no-scrollbar md:p-16">
            <div className="relative z-10 mx-auto min-h-[520px] max-w-6xl">
                <div className="mb-12 flex items-end justify-between gap-4">
                    <div>
                        <h1 className="mb-2 text-3xl font-medium tracking-tight text-textMain">
                            Settings
                        </h1>
                        <p className="max-w-md text-sm text-neutral-500">
                            Manage your account settings
                        </p>
                    </div>
                    {isProfileFetching && !isProfileLoading && (
                        <div className="text-xs text-neutral-500">Syncing profile...</div>
                    )}
                </div>

                {(profileActionError || profileError) && (
                    <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {profileActionError ??
                            (profileError instanceof Error
                                ? profileError.message
                                : 'Failed to load profile')}
                    </div>
                )}

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
