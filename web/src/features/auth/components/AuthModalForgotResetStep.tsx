import React from 'react'

import type { AuthModalForgotResetStepProps } from '@/features/auth/types'

import { Icons } from '@/shared/components/ui/Icons'

export const AuthModalForgotResetStep: React.FC<AuthModalForgotResetStepProps> = ({
    newPassword,
    confirmPassword,
    errorMessage,
    isPending,
    onNewPasswordChange,
    onConfirmPasswordChange,
    onSubmit,
    onBack,
}) => (
    <div className="flex flex-col">
        <div className="flex flex-col items-center mb-[22px]">
            <div className="mb-[18px] text-[#D6D5D4]">
                <Icons.DecemberLogo className="w-[32px] h-[32px]" />
            </div>
            <h2 className="text-[20px] font-medium text-[#f5f5f5] text-center tracking-tight mb-1.5">
                Set new password
            </h2>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
            <input
                type="password"
                required
                placeholder="New password"
                value={newPassword}
                onChange={(event) => onNewPasswordChange(event.target.value)}
                disabled={isPending}
                className="w-full bg-[#1A1A1A] border border-[#333333] focus:border-[#555] rounded-[10px] h-[44px] px-3.5 text-[15px] text-white placeholder-[#737373] focus:outline-none transition-colors"
            />
            <input
                type="password"
                required
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                disabled={isPending}
                className="w-full bg-[#1A1A1A] border border-[#333333] focus:border-[#555] rounded-[10px] h-[44px] px-3.5 text-[15px] text-white placeholder-[#737373] focus:outline-none transition-colors"
            />

            {errorMessage && <p className="text-[13px] text-red-500 px-1">{errorMessage}</p>}

            <button
                type="submit"
                disabled={!newPassword || !confirmPassword || isPending}
                className="w-full bg-[#E5E5E5] hover:bg-white text-[#111111] font-medium h-[44px] rounded-[10px] flex items-center justify-center transition-colors disabled:opacity-50 mt-1.5"
            >
                {isPending ? 'Please wait...' : 'Set new password'}
            </button>

            <button
                type="button"
                onClick={onBack}
                disabled={isPending}
                className="mt-[8px] text-[13px] text-[#A3A3A3] hover:text-white transition-colors"
            >
                Back
            </button>
        </form>
    </div>
)
