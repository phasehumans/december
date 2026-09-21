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
        <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-5 text-white">
                <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
            </div>
            <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-1.5">
                Set new password
            </h2>
            <p className="text-[13px] text-[#A1A1A6] leading-relaxed">
                Enter your new password below.
            </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
                type="password"
                required
                placeholder="New password"
                value={newPassword}
                onChange={(event) => onNewPasswordChange(event.target.value)}
                disabled={isPending}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded-none h-10 px-3.5 font-mono text-xs sm:text-[13px] text-white placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors"
            />
            <input
                type="password"
                required
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                disabled={isPending}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded-none h-10 px-3.5 font-mono text-xs sm:text-[13px] text-white placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors"
            />

            {errorMessage && (
                <p className="font-mono text-xs text-red-400 px-1 text-center">{errorMessage}</p>
            )}

            <button
                type="submit"
                disabled={!newPassword || !confirmPassword || isPending}
                className="w-full bg-[#EDEDED] hover:bg-white text-[#090a0f] font-mono text-xs sm:text-[13px] font-medium h-10 rounded-none flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 mt-1"
            >
                {isPending ? 'Updating password...' : 'Update password →'}
            </button>

            <div className="mt-3 pt-4 border-t border-[#262626] flex justify-center">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isPending}
                    className="font-mono text-xs text-[#888888] hover:text-[#87b2f4] transition-colors cursor-pointer"
                >
                    ← Back
                </button>
            </div>
        </form>
    </div>
)
