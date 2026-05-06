import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { Logo } from '@/shared/components/Logo'
import { Button } from '@/shared/components/ui/Button'
import type { AuthModalOtpStepProps } from '@/features/auth/types'

export const AuthModalOtpStep: React.FC<AuthModalOtpStepProps> = ({
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
}) => {
    return (
        <div className="flex flex-col">
            <div className="flex flex-col items-center mb-[22px]">
                <div className="mb-[18px] opacity-90 hover:opacity-100 transition-opacity text-[#D6D5D4] flex justify-center">
                    <Icons.DecemberLogo className="w-[32px] h-[32px]" />
                </div>
                <h2 className="text-[20px] font-medium text-[#f5f5f5] text-center tracking-tight mb-1.5">
                    Verify your email
                </h2>
                <p className="text-[14px] text-[#A3A3A3] text-center max-w-[280px]">
                    We sent a verification code to{' '}
                    <span className="text-[#f5f5f5] font-medium">{email}</span>. Enter it below to
                    create your account.
                </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
                <div className="flex gap-2 justify-center mb-2">
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
                            className="w-[46px] h-[52px] text-center text-[20px] font-medium bg-[#1A1A1A] border border-[#333333] focus:border-[#555] rounded-[10px] focus:outline-none text-white transition-colors caret-white"
                        />
                    ))}
                </div>

                {errorMessage && (
                    <p className="text-[13px] text-red-500 px-1 text-center">{errorMessage}</p>
                )}

                <button
                    type="submit"
                    disabled={otp.some((digit) => !digit) || isPending}
                    className="w-full bg-[#2A2A2A] hover:bg-[#333333] text-[#E5E5E5] font-medium h-[44px] rounded-[10px] flex items-center justify-center transition-colors disabled:opacity-50 mt-1"
                >
                    {isPending ? 'Please wait...' : 'Verify & Create Account'}
                </button>

                <div className="mt-[8px] flex justify-center">
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-[13px] text-[#A3A3A3] hover:text-white transition-colors underline decoration-transparent hover:decoration-white/50 underline-offset-2"
                        disabled={isPending}
                    >
                        Back to Sign Up
                    </button>
                </div>
            </form>
        </div>
    )
}
