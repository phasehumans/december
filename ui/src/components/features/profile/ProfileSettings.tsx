import React, { useState } from 'react'
import { Icons } from '../../ui/Icons'
import { Modal } from '../../ui/Modal'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Switch } from '../../ui/Switch'
import { Badge } from '../../ui/Badge'
import { SettingsSection } from '../../settings/SettingsSection'
import { SettingsRow } from '../../settings/SettingsRow'

interface ProfileSettingsProps {
    onSignOut: () => void
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onSignOut }) => {
    const [name, setName] = useState('Demo User')
    const [emailNotifications, setEmailNotifications] = useState(true)
    const [isGithubConnected, setIsGithubConnected] = useState(false)

    // Modals
    const [nameModalOpen, setNameModalOpen] = useState(false)
    const [tempName, setTempName] = useState(name)

    const [passwordModalOpen, setPasswordModalOpen] = useState(false)
    const [showCurrentPass, setShowCurrentPass] = useState(false)
    const [showNewPass, setShowNewPass] = useState(false)

    const [isSavingName, setIsSavingName] = useState(false)
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

    const handleSaveName = () => {
        if (tempName.trim()) {
            setIsSavingName(true)
            setTimeout(() => {
                setName(tempName)
                setNameModalOpen(false)
                setIsSavingName(false)
            }, 1000)
        }
    }

    const handleUpdatePassword = () => {
        setIsUpdatingPassword(true)
        setTimeout(() => {
            setPasswordModalOpen(false)
            setIsUpdatingPassword(false)
        }, 1000)
    }

    return (
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 pt-20 md:p-10 w-full font-sans bg-background animate-in fade-in duration-500 relative">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-medium text-textMain mb-2 tracking-tight">
                        Settings
                    </h1>
                    <p className="text-neutral-500 text-sm">Manage your account preferences.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
                    <div className="space-y-8">
                        <SettingsSection title="Profile">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-neutral-400">
                                    Display Name
                                </label>
                                <SettingsRow
                                    label={name}
                                    action={
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setTempName(name)
                                                setNameModalOpen(true)
                                            }}
                                            className="h-7 text-[10px] px-2.5"
                                        >
                                            Change
                                        </Button>
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-neutral-400">
                                    Password
                                </label>
                                <SettingsRow
                                    label="••••••••••••••••"
                                    action={
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPasswordModalOpen(true)}
                                            className="h-7 text-[10px] px-2.5"
                                        >
                                            Change
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
                            disabled={isSavingName}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveName}
                            isLoading={isSavingName}
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
                        placeholder="••••••••"
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
                        placeholder="••••••••"
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
                    <Input label="Confirm Password" type="password" placeholder="••••••••" />

                    <div className="flex items-center justify-end gap-3 mt-8">
                        <Button
                            variant="ghost"
                            onClick={() => setPasswordModalOpen(false)}
                            disabled={isUpdatingPassword}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleUpdatePassword} isLoading={isUpdatingPassword}>
                            Update Password
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
