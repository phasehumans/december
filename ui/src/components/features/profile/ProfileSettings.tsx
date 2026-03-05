import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { profileAPI } from '@/api/profile'
import { Icons } from '../../ui/Icons'
import { Button } from '../../ui/Button'
import { Switch } from '../../ui/Switch'
import { Badge } from '../../ui/Badge'
import { Skeleton } from '../../ui/Skeleton'
import { SettingsSection } from '../../settings/SettingsSection'
import { SettingsRow } from '../../settings/SettingsRow'
import { ProfileNameModal } from './ProfileNameModal'
import { ProfilePasswordModal } from './ProfilePasswordModal'

interface ProfileSettingsProps {
    onSignOut: () => void
}

const ProfileSettingsSkeleton = () => {
    return (
        <div className="grid min-h-[430px] grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
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

    const openPasswordModal = () => {
        setProfileActionError(null)
        setPasswordModalOpen(true)
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

    const connectGithub = () => {
        const url =
          `https://github.com/login/oauth/authorize` +
          `?client_id=Ov23liFGkTAwCW7E8gtk` +
          `&scope=repo`+
          `&state=${profile?.id}`
      
        window.location.href = url
    }

    const resolvedName = profile?.name ?? 'User'

    return (
        <div className="relative flex-1 w-full overflow-y-auto bg-background px-6 pb-6 pt-20 font-sans no-scrollbar md:p-10">
            <div className="mx-auto max-w-5xl min-h-[520px]">
                <div className="mb-8 flex items-end justify-between gap-4">
                    <div>
                        <h1 className="mb-2 text-3xl font-medium tracking-tight text-textMain">
                            Settings
                        </h1>
                        <p className="text-sm text-neutral-500">Manage your account settings</p>
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
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
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
                                                className="h-7 px-2.5 text-[10px]"
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
                                                onClick={openPasswordModal}
                                                className="h-7 px-2.5 text-[10px]"
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
                                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-surface/20 p-3 transition-colors hover:border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white">
                                            <Icons.Github className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-textMain">
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
                                        onClick={connectGithub}
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
                                    <div className="rounded-xl border border-white/5 bg-surface/20 p-3">
                                        <div className="mb-2 flex justify-between text-xs">
                                            <span className="text-neutral-400">Generations</span>
                                            <span className="text-textMain">124 / 500</span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                            <div className="h-full w-[25%] rounded-full bg-white" />
                                        </div>
                                    </div>
                                </div>
                            </SettingsSection>

                            <div className="pt-2">
                                <Button
                                    variant="danger"
                                    onClick={onSignOut}
                                    className="-ml-2 justify-start border-0 bg-transparent px-2 text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                                >
                                    <Icons.LogOut className="mr-2 h-4 w-4" /> Sign out
                                </Button>
                            </div>
                        </div>
                    </div>
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
