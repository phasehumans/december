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
        <div className="grid min-h-[430px] grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] xl:gap-12">
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
