import React from 'react'

import type { AuthModalForgotOtpStepProps } from '@/features/auth/types'

import { Icons } from '@/shared/components/ui/Icons'

export const AuthModalForgotOtpStep: React.FC<AuthModalForgotOtpStepProps> = ({
    email,
    otp,
    errorMessage,
    isPending,
    onChangeOtp,
    onKeyDown,
    onPaste,
    onSubmit,
    onBack,
    setOtpInputRef,
}) => (
    <div className="flex flex-col">
        <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-5 text-white">
                <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
            </div>
            <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-1.5">
                Enter reset code
            </h2>
            <p className="text-[13px] text-[#A1A1A6] leading-relaxed">
                If that email exists, we sent a six-digit code to{' '}
                <span className="text-white font-sans font-medium">{email}</span>.
            </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {/* Monospace OTP input boxes with unified rounded corners */}
            <div className="flex gap-2 sm:gap-2.5 justify-center my-1">
                {otp.map((digit, index) => (
                    <input
                        key={index}
                        ref={(element) => setOtpInputRef(index, element)}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(event) => onChangeOtp(index, event.target.value)}
                        onKeyDown={(event) => onKeyDown(index, event)}
                        onPaste={index === 0 ? onPaste : undefined}
                        disabled={isPending}
                        className="w-11 h-12 sm:w-12 sm:h-13 text-center font-mono text-xl font-medium bg-[#141414] border border-[#2A2A2A] rounded-lg text-white caret-[#87b2f4] outline-none focus:border-[#87b2f4] transition-all"
                    />
                ))}
            </div>

            {errorMessage && (
                <p className="font-sans text-xs text-red-400 px-1 text-center">{errorMessage}</p>
            )}

            <button
                type="submit"
                disabled={otp.some((digit) => !digit) || isPending}
                className="w-full bg-[#EDEDED] hover:bg-white text-[#090a0f] font-sans text-xs sm:text-[13px] font-medium h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 mt-1"
            >
                {isPending ? 'Verifying code...' : 'Verify & Continue →'}
            </button>

            <div className="mt-2 pt-4 border-t border-[#262626] flex justify-center">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isPending}
                    className="font-sans text-xs text-[#888888] hover:text-[#87b2f4] transition-colors cursor-pointer"
                >
                    ← Back
                </button>
            </div>
        </form>
    </div>
)
