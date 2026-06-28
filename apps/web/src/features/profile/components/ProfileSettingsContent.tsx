import React from 'react'
import { X, Settings, Calendar } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import bannerImg from '../../../../public/banner.png'
import { profileAPI } from '@/features/profile/api/profile'
import { Skeleton } from '@/shared/components/ui/Skeleton'

import type { Profile } from '../types'

interface ProfileSettingsContentProps {
    profile?: Profile
    resolvedName: string
    hasProfile: boolean
    isGithubConnected: boolean
    emailNotifications: boolean
    productUpdates: boolean
    securityAlerts: boolean
    isNotificationPending: boolean
    onOpenNameModal: () => void
    onOpenUsernameModal: () => void
    onOpenPasswordModal: () => void
    onNotificationToggle: (
        field: 'notifyProjectActivity' | 'notifyProductUpdates' | 'notifySecurityAlerts',
        value: boolean
    ) => void
    onConnectGithub: () => void
    onSignOut: () => void
    onOpenSignOutAllSessionsModal: () => void
    onOpenDeleteAccountModal: () => void
}

export const ProfileSettingsContent: React.FC<ProfileSettingsContentProps> = (props) => {
    const {
        profile,
        resolvedName,
        hasProfile,
        isGithubConnected,
        emailNotifications,
        productUpdates,
        securityAlerts,
        isNotificationPending,
        onOpenNameModal,
        onOpenUsernameModal,
        onOpenPasswordModal,
        onNotificationToggle,
        onConnectGithub,
        onSignOut,
        onOpenSignOutAllSessionsModal,
        onOpenDeleteAccountModal,
    } = props

    const queryClient = useQueryClient()
    const updateAvatarMutation = useMutation({
        mutationFn: profileAPI.updateAvatarUrl,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

    const userName = profile?.name || resolvedName || 'User'
    const userUsername = profile?.username || ''
    const displayUsername = userUsername || userName.toLowerCase().replace(/\s+/g, '_')

    const handleChangeAvatar = () => {
        const randomSeed = Math.random().toString(36).substring(2, 8)
        const newUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${randomSeed}&backgroundColor=2B2A29`
        updateAvatarMutation.mutate({ avatarUrl: newUrl })
    }

    const currentAvatarUrl =
        profile?.avatarUrl ||
        `https://api.dicebear.com/7.x/notionists/svg?seed=${userName}&backgroundColor=2B2A29`

    const joinDateStr = profile?.createdAt
        ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
              new Date(profile.createdAt)
          )
        : ''

    const isLoading = !hasProfile && !resolvedName

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            {/* Profile Banner Card */}
            <div className="w-full bg-[#141414] rounded-2xl shadow-2xl relative overflow-hidden flex flex-col mb-8 border border-[#2B2A29]">
                {/* Banner with Image */}
                <div className="relative h-[160px] w-full bg-[#100E12] flex items-center justify-center overflow-hidden">
                    <img
                        src={bannerImg}
                        alt="Profile Banner"
                        className="absolute inset-0 w-full h-full object-cover object-bottom"
                    />

                    <button
                        className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-colors"
                        onClick={() => {}}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Info Section */}
                <div className="px-8 pb-8 relative">
                    {/* Avatar */}
                    <button
                        onClick={handleChangeAvatar}
                        disabled={isLoading || updateAvatarMutation.isPending}
                        className="absolute -top-[48px] left-8 w-[96px] h-[96px] rounded-full border-[5px] border-[#141414] bg-[#2B2A29] overflow-hidden flex items-center justify-center shadow-xl hover:scale-105 hover:border-[#242323] transition-all cursor-pointer group"
                        title="Change Avatar"
                    >
                        {isLoading || updateAvatarMutation.isPending ? (
                            <Skeleton className="w-full h-full rounded-full bg-white/[0.06]" />
                        ) : (
                            <img
                                src={currentAvatarUrl}
                                alt={userName}
                                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                            />
                        )}
                    </button>

                    {/* Actions */}
                    <div className="flex justify-end pt-4 gap-3">
                        {isLoading ? (
                            <Skeleton className="h-8 w-36 rounded-full bg-white/[0.04]" />
                        ) : (
                            <button
                                onClick={() => {}}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#191919] transition-colors"
                            >
                                Account settings
                                <Settings className="w-3.5 h-3.5 text-[#7B7A79]" />
                            </button>
                        )}
                    </div>

                    {/* User Details — Name + Username */}
                    <div className="flex flex-col mt-2">
                        {isLoading ? (
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-7 w-48 bg-white/[0.06] rounded-md" />
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-4 w-20 bg-white/[0.04] rounded-md" />
                                    <Skeleton className="h-4 w-32 bg-white/[0.04] rounded-md" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-[22px] font-bold text-[#D6D5C9] mb-0.5">
                                    {userName}
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-[14px] text-[#7B7A79]">
                                        @{displayUsername}
                                    </span>
                                    {joinDateStr && (
                                        <span className="text-[13px] text-[#7B7A79] flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Joined {joinDateStr}
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

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
                                {profile?.username || 'username'}
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
                                {profile?.email || 'No email set'}
                            </span>
                        </div>
                    </div>

                    {/* Change Password Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Password</span>
                            {profile?.hasPassword ? (
                                <span className="text-[13px] text-[#7B7A79]">••••••••</span>
                            ) : (
                                <span className="text-[13px] text-[#8F8E8D]">
                                    No password set (Oauth-only user)
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onOpenPasswordModal}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        >
                            {profile?.hasPassword ? 'Change password' : 'Set password'}
                        </button>
                    </div>
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
                                Get notification updates when someone interacts with your projects
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() =>
                                onNotificationToggle('notifyProjectActivity', !emailNotifications)
                            }
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
                                Get notification updates about new features and improvements
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() =>
                                onNotificationToggle('notifyProductUpdates', !productUpdates)
                            }
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
                                Get notification updates for important security notices
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() =>
                                onNotificationToggle('notifySecurityAlerts', !securityAlerts)
                            }
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
                            You are signed in as {profile?.username || profile?.name || 'User'}
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
