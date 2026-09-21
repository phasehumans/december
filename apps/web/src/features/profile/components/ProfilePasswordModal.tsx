import { Eye, EyeOff } from 'lucide-react'
import React from 'react'

import type { ProfilePasswordModalProps } from '@/features/profile/types'

import { Modal } from '@/shared/components/ui/Modal'

export const ProfilePasswordModal: React.FC<ProfilePasswordModalProps> = ({
    isOpen,
    isPending,
    currentPassword,
    newPassword,
    confirmPassword,
    showCurrentPass,
    showNewPass,
    errorMessage,
    onClose,
    onUpdatePassword,
    onCurrentPasswordChange,
    onNewPasswordChange,
    onConfirmPasswordChange,
    onToggleShowCurrentPass,
    onToggleShowNewPass,
    hasPassword = true,
}) => {
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!isPending) onUpdatePassword()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={hasPassword ? 'Change password' : 'Set Password'}
            description={
                hasPassword
                    ? 'This will immediately update your password for all active sessions.'
                    : 'This will enable password-based login alongside OAuth for your account.'
            }
            variant="premium"
        >
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3.5">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    {hasPassword
                        ? 'Enter your current password and choose a new one to secure your account.'
                        : 'Choose a strong password to enable email and password login.'}
                </p>

                {hasPassword && (
                    <div>
                        <div className="relative">
                            <input
                                id="current-password-input"
                                type={showCurrentPass ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                                className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3.5 py-2 text-white font-sans text-xs sm:text-[13px] placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors pr-10"
                                placeholder="Current password"
                                disabled={isPending}
                            />
                            <button
                                type="button"
                                onClick={onToggleShowCurrentPass}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-white transition-colors cursor-pointer"
                            >
                                {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <div className="relative">
                        <input
                            id="new-password-input"
                            type={showNewPass ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => onNewPasswordChange(e.target.value)}
                            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3.5 py-2 text-white font-sans text-xs sm:text-[13px] placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors pr-10"
                            placeholder="New password"
                            disabled={isPending}
                        />
                        <button
                            type="button"
                            onClick={onToggleShowNewPass}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-white transition-colors cursor-pointer"
                        >
                            {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>

                <div>
                    <input
                        id="confirm-password-input"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => onConfirmPasswordChange(e.target.value)}
                        className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3.5 py-2 text-white font-sans text-xs sm:text-[13px] placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors"
                        placeholder="Confirm new password"
                        disabled={isPending}
                    />
                </div>

                {errorMessage && (
                    <p className="font-sans text-xs text-red-400 px-1">{errorMessage}</p>
                )}

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="bg-transparent text-[#9A9998] hover:text-white active:scale-95 transition-all font-sans text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all font-sans text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[140px] cursor-pointer"
                    >
                        {isPending ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>{hasPassword ? 'Updating...' : 'Setting...'}</span>
                            </div>
                        ) : hasPassword ? (
                            'Update Password'
                        ) : (
                            'Set Password'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
