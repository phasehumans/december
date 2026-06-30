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
                    ? 'Update your account password for security.'
                    : 'Set a password for your account to enable password-based login alongside OAuth.'
            }
            variant="premium"
        >
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3.5">
                {hasPassword && (
                    <div>
                        <label
                            htmlFor="current-password-input"
                            className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                        >
                            Current password
                        </label>
                        <div className="relative">
                            <input
                                id="current-password-input"
                                type={showCurrentPass ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                                className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200 pr-10"
                                placeholder="••••••••"
                                disabled={isPending}
                            />
                            <button
                                type="button"
                                onClick={onToggleShowCurrentPass}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-white transition-colors"
                            >
                                {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <label
                        htmlFor="new-password-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                    >
                        New password
                    </label>
                    <div className="relative">
                        <input
                            id="new-password-input"
                            type={showNewPass ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => onNewPasswordChange(e.target.value)}
                            className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200 pr-10"
                            placeholder="••••••••"
                            disabled={isPending}
                        />
                        <button
                            type="button"
                            onClick={onToggleShowNewPass}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-white transition-colors"
                        >
                            {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="confirm-password-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                    >
                        Confirm password
                    </label>
                    <input
                        id="confirm-password-input"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => onConfirmPasswordChange(e.target.value)}
                        className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200"
                        placeholder="••••••••"
                        disabled={isPending}
                    />
                </div>

                {errorMessage && (
                    <p className="text-[12px] text-red-500 font-medium px-1">{errorMessage}</p>
                )}

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[140px]"
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
