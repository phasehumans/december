import React, { useState } from 'react'
import { UserCircle } from 'lucide-react'
import type { Profile } from '../types'

interface ProfileSettingsContentProps {
    profile?: Profile
    resolvedName: string
    hasProfile: boolean
    isGithubConnected: boolean
    emailNotifications: boolean
    isNotificationPending: boolean
    onOpenNameModal: () => void
    onOpenUsernameModal: () => void
    onOpenPasswordModal: () => void
    onNotificationToggle: (value: boolean) => void
    onConnectGithub: () => void
    onSignOut: () => void
    onOpenSignOutAllSessionsModal: () => void
    onOpenDeleteAccountModal: () => void
}

export const ProfileSettingsContent: React.FC<ProfileSettingsContentProps> = ({
    profile,
    resolvedName,
    hasProfile,
    isGithubConnected,
    emailNotifications,
    isNotificationPending,
    onOpenNameModal,
    onOpenUsernameModal,
    onOpenPasswordModal,
    onNotificationToggle,
    onConnectGithub,
    onSignOut,
    onOpenSignOutAllSessionsModal,
    onOpenDeleteAccountModal,
}) => {
    // Dummy states for the UI-only toggles
    const [productUpdates, setProductUpdates] = useState(true)
    const [securityAlerts, setSecurityAlerts] = useState(true)

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            {/* Account */}
            <div className="flex flex-col mb-6">
                <h1 className="text-[16px] font-medium mb-3">Account</h1>
                <div className="flex flex-col gap-2 border-t border-[#242323] pt-4">
                    {/* Full Name Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Full Name</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                {profile?.name || resolvedName}
                            </span>
                        </div>
                        <button
                            onClick={onOpenNameModal}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        >
                            Change full name
                        </button>
                    </div>

                    {/* Username Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Username</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                {profile?.githubUsername || 'phasehuman'}
                            </span>
                        </div>
                        <button
                            onClick={onOpenUsernameModal}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        >
                            Change username
                        </button>
                    </div>

                    {/* Email Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Email</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                {profile?.email || 'dev.chaitanyasonawane@gmail.com'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Your Subscription */}
            <div className="flex flex-col mb-6">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-3">Your Subscription</h2>
                <div className="flex items-center justify-between border-t border-[#242323] pt-4">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[14px] text-[#D6D5C9] flex items-center gap-2">
                            Unlock the most powerful search experience with December
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-[#242323] text-[#D6D5C9] uppercase font-bold tracking-wider">
                                Pro
                            </span>
                        </span>
                        <span className="text-[13px] text-[#7B7A79]">
                            Get the most out of December with Pro.{' '}
                            <a
                                href="#"
                                className="text-[#7B7A79] hover:text-[#D6D5C9] hover:underline transition-colors"
                            >
                                Learn more
                            </a>
                        </span>
                    </div>
                    <button className="px-4 py-1.5 rounded-lg bg-[#E8E7E4] text-[#171615] font-medium text-[13px] hover:bg-white transition-colors">
                        Upgrade plan
                    </button>
                </div>
            </div>

            {/* Notifications */}
            <div className="flex flex-col mb-6">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-3">Notifications</h2>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Project activity</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates when someone interacts with your projects
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => onNotificationToggle(!emailNotifications)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                emailNotifications
                                    ? 'bg-[#242323]'
                                    : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    emailNotifications
                                        ? 'translate-x-4 bg-[#D6D5C9]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Product updates</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates about new features and improvements
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setProductUpdates(!productUpdates)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                productUpdates ? 'bg-[#242323]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    productUpdates
                                        ? 'translate-x-4 bg-[#D6D5C9]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Security alerts</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates for important security notices
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setSecurityAlerts(!securityAlerts)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                securityAlerts ? 'bg-[#242323]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    securityAlerts
                                        ? 'translate-x-4 bg-[#D6D5C9]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* System */}
            <div className="flex flex-col mb-6">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-3">System</h2>
                <div className="flex flex-col gap-2 border-t border-[#242323] pt-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#D6D5C9]">
                            You are signed in as {profile?.githubUsername || 'phasehuman'}
                        </span>
                        <button
                            onClick={onSignOut}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        >
                            Sign out
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Sign out of all sessions
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Devices or browsers where you are signed in
                            </span>
                        </div>
                        <button
                            onClick={onOpenSignOutAllSessionsModal}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        >
                            Sign out of all sessions
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Delete account</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Permanently delete your account and data
                            </span>
                        </div>
                        <button
                            onClick={onOpenDeleteAccountModal}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
