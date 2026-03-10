import React from 'react'
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
        <>
            <div className="flex flex-col items-center mb-6">
                <div className="mb-4 scale-90 opacity-90 hover:opacity-100 transition-opacity">
                    <Logo />
                </div>
                <h2 className="text-lg font-medium text-white text-center tracking-tight">
                    Verify your email
                </h2>
                <p className="text-xs text-neutral-400 text-center mt-2 max-w-[280px]">
                    We sent a verification code to <span className="text-white font-medium">{email}</span>.
                    Enter it below to create your account.
                </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
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
                            className="w-10 h-12 text-center text-xl font-medium bg-[#242322] border border-white/10 rounded-lg focus:border-white/30 focus:outline-none text-white transition-all caret-white"
                        />
                    ))}
                </div>

                {errorMessage && <p className="text-xs text-red-400 text-center">{errorMessage}</p>}

                <Button type="submit" className="w-full mt-2" disabled={otp.some((digit) => !digit)} isLoading={isPending}>
                    <span>Verify & Create Account</span>
                </Button>

                <button
                    type="button"
                    onClick={onBack}
                    className="w-full text-xs text-neutral-500 hover:text-neutral-300 transition-colors mt-4"
                    disabled={isPending}
                >
                    Back to Sign Up
                </button>
            </form>
        </>
    )
}
