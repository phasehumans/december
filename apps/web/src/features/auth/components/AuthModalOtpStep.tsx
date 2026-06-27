import React from 'react'

import type { AuthModalOtpStepProps } from '@/features/auth/types'

import { Icons } from '@/shared/components/ui/Icons'

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
            <div className="flex flex-col items-start mb-8">
                <h2 className="text-[28px] font-medium text-white tracking-tight mb-2">
                    Verify your email
                </h2>
                <p className="text-[15px] text-[#A3A3A3]">
                    We sent a verification code to{' '}
                    <span className="text-[#f5f5f5] font-medium">{email}</span>. Enter it below to
                    create your account.
                </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="flex gap-3 justify-start mb-2">
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
                            className="w-[52px] h-[58px] text-center text-[22px] font-semibold bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] focus:border-[#4A4A4A] focus:bg-[#1A1A1A] rounded-[12px] focus:outline-none text-white transition-all duration-200 caret-white shadow-sm"
                        />
                    ))}
                </div>

                {errorMessage && <p className="text-[13px] text-red-500 px-1">{errorMessage}</p>}

                <button
                    type="submit"
                    disabled={otp.some((digit) => !digit) || isPending}
                    className="w-full bg-[#EDEDED] hover:bg-white text-[#111111] font-medium h-[46px] rounded-[12px] flex items-center justify-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-1 shadow-sm"
                >
                    {isPending ? 'Please wait...' : 'Verify & Continue'}
                </button>

                <div className="mt-6 flex justify-start">
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-[14px] text-[#888888] hover:text-white transition-colors underline decoration-transparent hover:decoration-white/50 underline-offset-4"
                        disabled={isPending}
                    >
                        Back to Sign Up
                    </button>
                </div>
            </form>
        </div>
    )
}
