import React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

interface ProfilePasswordModalProps {
    isOpen: boolean
    isPending: boolean
    currentPassword: string
    newPassword: string
    confirmPassword: string
    showCurrentPass: boolean
    showNewPass: boolean
    onClose: () => void
    onUpdatePassword: () => void
    onCurrentPasswordChange: (value: string) => void
    onNewPasswordChange: (value: string) => void
    onConfirmPasswordChange: (value: string) => void
    onToggleShowCurrentPass: () => void
    onToggleShowNewPass: () => void
}

export const ProfilePasswordModal: React.FC<ProfilePasswordModalProps> = ({
    isOpen,
    isPending,
    currentPassword,
    newPassword,
    confirmPassword,
    showCurrentPass,
    showNewPass,
    onClose,
    onUpdatePassword,
    onCurrentPasswordChange,
    onNewPasswordChange,
    onConfirmPasswordChange,
    onToggleShowCurrentPass,
    onToggleShowNewPass,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Change Password" maxWidth="max-w-[420px]">
            <div className="space-y-4">
                <Input
                    label="Current Password"
                    type={showCurrentPass ? 'text' : 'password'}
                    placeholder="********"
                    value={currentPassword}
                    onChange={(e) => onCurrentPasswordChange(e.target.value)}
                    rightIcon={
                        <button
                            type="button"
                            onClick={onToggleShowCurrentPass}
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
                    onChange={(e) => onNewPasswordChange(e.target.value)}
                    rightIcon={
                        <button
                            type="button"
                            onClick={onToggleShowNewPass}
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
                    onChange={(e) => onConfirmPasswordChange(e.target.value)}
                />

                <div className="mt-8 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={onUpdatePassword} isLoading={isPending}>
                        Update Password
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
