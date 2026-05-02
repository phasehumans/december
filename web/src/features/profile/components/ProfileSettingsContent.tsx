import React from 'react'
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
}

export const ProfileSettingsContent: React.FC<ProfileSettingsContentProps> = ({
    profile,
    resolvedName,
    onOpenNameModal,
    onOpenUsernameModal,
    onSignOut,
}) => {
    return (
        <div className="flex flex-col max-w-[640px] text-[#D6D5C9]">
            <h1 className="text-[16px] font-medium mb-8">Account</h1>

            <div className="flex flex-col gap-6">
                {/* Avatar Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#2B2A29] flex items-center justify-center">
                            <UserCircle className="w-5 h-5 text-[#7B7A79]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[14px] text-[#D6D5C9]">
                                {profile?.name || resolvedName}
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                {profile?.githubUsername || 'phasehuman'}
                            </span>
                        </div>
                    </div>
                    <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors">
                        Change avatar
                    </button>
                </div>

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
                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors"
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
                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors"
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

            {/* Your Subscription */}
            <div className="flex flex-col pt-10">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-6">Your Subscription</h2>

                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[14px] text-[#D6D5C9] flex items-center gap-2">
                            Unlock the most powerful search experience with Phasehumans
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-[#22333B] text-[#55A69C] uppercase font-bold tracking-wider">
                                Pro
                            </span>
                        </span>
                        <span className="text-[13px] text-[#7B7A79]">
                            Get the most out of Phasehumans with Pro.{' '}
                            <a href="#" className="text-[#55A69C] hover:underline">
                                Learn more
                            </a>
                        </span>
                    </div>
                    <button className="px-4 py-1.5 rounded-lg bg-[#E8E7E4] text-[#171615] font-medium text-[13px] hover:bg-white transition-colors">
                        Upgrade plan
                    </button>
                </div>
            </div>

            {/* Security */}
            <div className="flex flex-col pt-10">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-6">Security</h2>

                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[14px] text-[#D6D5C9]">
                            Two-factor authentication
                        </span>
                        <span className="text-[13px] text-[#7B7A79]">
                            Add an extra layer of security to your account
                        </span>
                    </div>
                    <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors">
                        Set up
                    </button>
                </div>
            </div>

            {/* System */}
            <div className="flex flex-col pt-10">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-6">System</h2>

                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#D6D5C9]">Support</span>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors">
                            Contact
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#D6D5C9]">
                            You are signed in as {profile?.githubUsername || 'phasehuman'}
                        </span>
                        <button
                            onClick={onSignOut}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors"
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
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors">
                            Sign out of all sessions
                        </button>
                    </div>

                    <div className="flex items-center justify-between pb-8">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Delete account</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Permanently delete your account and data
                            </span>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors">
                            Learn more
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
