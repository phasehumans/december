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
        <div className="flex flex-col items-start mb-8">
            <h2 className="text-[28px] font-medium text-white tracking-tight mb-2">
                Set new password
            </h2>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <input
                type="password"
                required
                placeholder="New password"
                value={newPassword}
                onChange={(event) => onNewPasswordChange(event.target.value)}
                disabled={isPending}
                className="w-full bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] focus:border-[#4A4A4A] focus:bg-[#1A1A1A] rounded-[12px] h-[46px] px-4 text-[15px] text-white placeholder-[#666666] focus:outline-none transition-all duration-200"
            />
            <input
                type="password"
                required
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                disabled={isPending}
                className="w-full bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] focus:border-[#4A4A4A] focus:bg-[#1A1A1A] rounded-[12px] h-[46px] px-4 text-[15px] text-white placeholder-[#666666] focus:outline-none transition-all duration-200"
            />

            {errorMessage && <p className="text-[13px] text-red-500 px-1">{errorMessage}</p>}

            <button
                type="submit"
                disabled={!newPassword || !confirmPassword || isPending}
                className="w-full bg-[#EDEDED] hover:bg-white text-[#111111] font-medium h-[46px] rounded-[12px] flex items-center justify-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-1 shadow-sm"
            >
                {isPending ? 'Please wait...' : 'Set new password'}
            </button>

            <button
                type="button"
                onClick={onBack}
                disabled={isPending}
                className="self-start mt-4 text-[14px] text-[#888888] hover:text-white transition-colors underline decoration-transparent hover:decoration-white/50 underline-offset-4"
            >
                Back
            </button>
        </form>
    </div>
)
