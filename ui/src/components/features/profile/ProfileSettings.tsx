import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { profileAPI } from '@/api/profile'
import { Icons } from '../../ui/Icons'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Switch } from '../../ui/Switch'
import { Badge } from '../../ui/Badge'
import { Skeleton } from '../../ui/Skeleton'
import { SettingsSection } from '../../settings/SettingsSection'
import { SettingsRow } from '../../settings/SettingsRow'

interface ProfileSettingsProps {
    onSignOut: () => void
}

const ProfileSettingsSkeleton = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 min-h-[430px]">
            <div className="space-y-8">
                <SettingsSection title="Profile">
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </SettingsSection>

                <SettingsSection title="Notifications">
                    <Skeleton className="h-12 w-full" />
                </SettingsSection>
            </div>

            <div className="space-y-8">
                <SettingsSection title="Integrations">
                    <Skeleton className="h-20 w-full" />
                </SettingsSection>

                <SettingsSection title="Billing & Usage">
                    <Skeleton className="h-16 w-full" />
                </SettingsSection>

                <Skeleton className="h-10 w-28" />
            </div>
        </div>
    )
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut }) => {
    const queryClient = useQueryClient()
    const profileQueryKey = ['profile'] as const
    const [emailNotifications, setEmailNotifications] = useState(true)
    const [isGithubConnected, setIsGithubConnected] = useState(false)

    // Modals
    const [nameModalOpen, setNameModalOpen] = useState(false)
    const [tempName, setTempName] = useState('')

    const [passwordModalOpen, setPasswordModalOpen] = useState(false)
    const [showCurrentPass, setShowCurrentPass] = useState(false)
    const [showNewPass, setShowNewPass] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const [profileActionError, setProfileActionError] = useState<string | null>(null)

    const {
        data: profile,
        isLoading: isProfileLoading,
        isFetching: isProfileFetching,
        error: profileError,
    } = useQuery({
        queryKey: profileQueryKey,
        queryFn: profileAPI.getProfile,
        placeholderData: (previousData) => previousData,
    })

    const updateNameMutation = useMutation({
        mutationFn: profileAPI.updateName,
        onMutate: async ({ name }) => {
            setProfileActionError(null)
            await queryClient.cancelQueries({ queryKey: profileQueryKey })

            const previousProfile = queryClient.getQueryData(profileQueryKey)

            queryClient.setQueryData(profileQueryKey, (currentProfile: typeof profile) =>
                currentProfile ? { ...currentProfile, name } : currentProfile
            )

            setNameModalOpen(false)

            return { previousProfile }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProfile) {
                queryClient.setQueryData(profileQueryKey, context.previousProfile)
            }
            setProfileActionError(error instanceof Error ? error.message : 'Failed to update name')
        },
        onSuccess: () => {
            setProfileActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: profileQueryKey })
        },
    })

    const updatePasswordMutation = useMutation({
        mutationFn: profileAPI.changePassword,
        onSuccess: () => {
            setProfileActionError(null)
            setPasswordModalOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        },
        onError: (error) => {
            setProfileActionError(
                error instanceof Error ? error.message : 'Failed to update password'
            )
        },
    })

    const openNameModal = () => {
        setProfileActionError(null)
        setTempName(profile?.name ?? '')
        setNameModalOpen(true)
    }

    const handleSaveName = () => {
        if (!tempName.trim()) {
            return
        }

        updateNameMutation.mutate({ name: tempName.trim() })
    }

    const handleUpdatePassword = () => {
        if (!newPassword.trim()) {
            setProfileActionError('Please enter a new password')
            return
        }

        if (newPassword !== confirmPassword) {
            setProfileActionError('New password and confirm password do not match')
            return
        }

        setProfileActionError(null)
        updatePasswordMutation.mutate({ password: newPassword })
    }

    const resolvedName = profile?.name ?? 'User'

    return (
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 pt-20 md:p-10 w-full font-sans bg-background relative">
            <div className="max-w-5xl mx-auto min-h-[520px]">
                <div className="mb-8 flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-medium text-textMain mb-2 tracking-tight">
                            Settings
                        </h1>
                        <p className="text-neutral-500 text-sm">Manage your account settings</p>
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
                        <div className="space-y-8">
                            <SettingsSection title="Profile">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-neutral-400">
                                        Name
                                    </label>
                                    <SettingsRow
                                        label={resolvedName}
                                        action={
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={openNameModal}
                                                className="h-7 text-[10px] px-2.5"
                                                disabled={!profile}
                                            >
                                                Change Name
                                            </Button>
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-neutral-400">
                                        Password
                                    </label>
                                    <SettingsRow
                                        label="********"
                                        action={
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setProfileActionError(null)
                                                    setPasswordModalOpen(true)
                                                }}
                                                className="h-7 text-[10px] px-2.5"
                                            >
                                                Change Password
                                            </Button>
                                        }
                                    />
                                </div>
                            </SettingsSection>

                            <SettingsSection title="Notifications">
                                <SettingsRow
                                    label="Email Notifications"
                                    description="Receive updates about activity"
                                    action={
                                        <Switch
                                            checked={emailNotifications}
                                            onCheckedChange={setEmailNotifications}
                                        />
                                    }
                                />
                            </SettingsSection>
                        </div>

                        <div className="space-y-8">
                            <SettingsSection title="Integrations">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-surface/20 border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white">
                                            <Icons.Github className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-textMain">
                                                GitHub
                                            </div>
                                            <div className="text-[11px] text-neutral-500">
                                                {isGithubConnected
                                                    ? 'Connected'
                                                    : 'Connect your repositories'}
                                            </div>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={isGithubConnected ? 'success' : 'default'}
                                        onClick={() => setIsGithubConnected(!isGithubConnected)}
                                        className="cursor-pointer"
                                    >
                                        {isGithubConnected ? 'Connected' : 'Connect'}
                                    </Badge>
                                </div>
                            </SettingsSection>

                            <SettingsSection title="Billing & Usage">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-neutral-400">
                                        Usage
                                    </label>
                                    <div className="p-3 rounded-xl bg-surface/20 border border-white/5">
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="text-neutral-400">Generations</span>
                                            <span className="text-textMain">124 / 500</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-white w-[25%] rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </SettingsSection>

                            <div className="pt-2">
                                <Button
                                    variant="danger"
                                    onClick={onSignOut}
                                    className="bg-transparent border-0 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 justify-start px-2 -ml-2"
                                >
                                    <Icons.LogOut className="w-4 h-4 mr-2" /> Sign out
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={nameModalOpen}
                onClose={() => setNameModalOpen(false)}
                title="Change Name"
                maxWidth="max-w-[420px]"
            >
                <div className="space-y-4">
                    <Input
                        label="Display Name"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        autoFocus
                    />
                    <div className="flex items-center justify-end gap-3 mt-8">
                        <Button
                            variant="ghost"
                            onClick={() => setNameModalOpen(false)}
                            disabled={updateNameMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveName}
                            isLoading={updateNameMutation.isPending}
                            disabled={!tempName.trim()}
                        >
                            Save Changes
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={passwordModalOpen}
                onClose={() => setPasswordModalOpen(false)}
                title="Change Password"
                maxWidth="max-w-[420px]"
            >
                <div className="space-y-4">
                    <Input
                        label="Current Password"
                        type={showCurrentPass ? 'text' : 'password'}
                        placeholder="********"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShowCurrentPass(!showCurrentPass)}
                                className="hover:text-white"
                            >
                                {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        }
                    />
                    <Input
                        label="New Password"
                        type={showNewPass ? 'text' : 'password'}
                        placeholder="********"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShowNewPass(!showNewPass)}
                                className="hover:text-white"
                            >
                                {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        }
                    />
                    <Input
                        label="Confirm Password"
                        type="password"
                        placeholder="********"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    <div className="flex items-center justify-end gap-3 mt-8">
                        <Button
                            variant="ghost"
                            onClick={() => setPasswordModalOpen(false)}
                            disabled={updatePasswordMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdatePassword}
                            isLoading={updatePasswordMutation.isPending}
                        >
                            Update Password
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
