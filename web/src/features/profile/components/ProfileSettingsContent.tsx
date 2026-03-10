import React from 'react'
import { ProfileSettingsPrimaryColumn } from './ProfileSettingsPrimaryColumn'
import { ProfileSettingsSecondaryColumn } from './ProfileSettingsSecondaryColumn'

interface ProfileSettingsContentProps {
    resolvedName: string
    hasProfile: boolean
    isGithubConnected: boolean
    emailNotifications: boolean
    isNotificationPending: boolean
    onOpenNameModal: () => void
    onOpenPasswordModal: () => void
    onNotificationToggle: (value: boolean) => void
    onConnectGithub: () => void
    onSignOut: () => void
}

export const ProfileSettingsContent: React.FC<ProfileSettingsContentProps> = ({
    resolvedName,
    hasProfile,
    isGithubConnected,
    emailNotifications,
    isNotificationPending,
    onOpenNameModal,
    onOpenPasswordModal,
    onNotificationToggle,
    onConnectGithub,
    onSignOut,
}) => {
    return (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
            <ProfileSettingsPrimaryColumn
                resolvedName={resolvedName}
                hasProfile={hasProfile}
                emailNotifications={emailNotifications}
                isNotificationPending={isNotificationPending}
                onOpenNameModal={onOpenNameModal}
                onOpenPasswordModal={onOpenPasswordModal}
                onNotificationToggle={onNotificationToggle}
            />

            <ProfileSettingsSecondaryColumn
                isGithubConnected={isGithubConnected}
                onConnectGithub={onConnectGithub}
                onSignOut={onSignOut}
            />
        </div>
    )
}
