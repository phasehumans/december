import React from 'react'

import { AuthModalBrand } from './AuthModalBrand'
import { authPrimaryButtonClass, authTextLinkClass } from './authModalStyles'

import type { AuthModalOtpStepProps } from '@/features/auth/types'

export const AuthModalOtpStep: React.FC<AuthModalOtpStepProps> = ({
    email,
    otp,
    errorMessage,
    isPending,
    isResendPending,
    onChangeOtp,
    onKeyDown,
    onPaste,
    onSubmit,
    onResend,
    onBack,
    setOtpInputRef,
}) => {
    return (
        <div className="flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
                <AuthModalBrand />
                <p className="mt-3 font-sans text-xs sm:text-[13px] text-[#888888] leading-relaxed">
                    Enter the code we sent to{' '}
                    <span className="text-white font-medium break-all">{email}</span>
                </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <div className="flex gap-2 justify-center">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(element) => setOtpInputRef(index, element)}
                            type="text"
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            aria-label={`Digit ${index + 1}`}
                            maxLength={1}
                            value={digit}
                            onChange={(event) => onChangeOtp(index, event.target.value)}
                            onKeyDown={(event) => onKeyDown(index, event)}
                            onPaste={index === 0 ? onPaste : undefined}
                            disabled={isPending}
                            autoFocus={index === 0}
                            className="w-10 h-11 text-center font-mono text-lg font-medium bg-[#141414] border border-[#2A2A2A] rounded-md text-white caret-[#87b2f4] outline-none focus:border-[#87b2f4] transition-all"
                        />
                    ))}
                </div>

                {errorMessage && (
                    <p className="font-sans text-xs text-red-400 px-1 text-center">
                        {errorMessage}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={otp.some((digit) => !digit) || isPending}
                    className={`${authPrimaryButtonClass} mt-1`}
                >
                    {isPending ? 'Verifying...' : 'Continue'}
                </button>
            </form>

            <div className="mt-5 flex flex-col items-center gap-2 font-sans text-xs text-[#888888]">
                <span>
                    Didn't get it?{' '}
                    <button
                        type="button"
                        onClick={onResend}
                        disabled={isPending || isResendPending}
                        className={authTextLinkClass}
                    >
                        {isResendPending ? 'Sending...' : 'Resend code'}
                    </button>
                </span>
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isPending}
                    className="hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                    Use a different email
                </button>
            </div>
        </div>
    )
}
