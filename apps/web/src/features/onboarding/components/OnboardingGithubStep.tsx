import { Check } from 'lucide-react'
import React from 'react'

import { OnboardingGitlabIcon } from './OnboardingGitlabIcon'

import type { OnboardingState } from '@/features/onboarding/api/onboarding'

import { AuthModalGithubIcon } from '@/features/auth/components/AuthModalGithubIcon'
import { authButtonClass, authPrimaryButtonClass } from '@/features/auth/components/authModalStyles'

const GITLAB_SOON_MS = 2500

interface OnboardingGithubStepProps {
    state: OnboardingState
    isConnecting: boolean
    onConnect: () => void
    onContinue: () => void
    onSkip: () => void
}

export const OnboardingGithubStep: React.FC<OnboardingGithubStepProps> = ({
    state,
    isConnecting,
    onConnect,
    onContinue,
    onSkip,
}) => {
    const [showGitlabSoon, setShowGitlabSoon] = React.useState(false)

    // GitLab is not live yet (#627): the button only shows a short "coming soon" note.
    React.useEffect(() => {
        if (!showGitlabSoon) return
        const timer = window.setTimeout(() => setShowGitlabSoon(false), GITLAB_SOON_MS)
        return () => window.clearTimeout(timer)
    }, [showGitlabSoon])

    if (state.steps.github) {
        return (
            <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[16px_1fr_auto] items-center gap-2.5 h-9 px-3.5 rounded-md border border-[#2A2A2A] bg-[#1e1e1e] text-[13px]">
                    <span className="text-white">
                        <AuthModalGithubIcon />
                    </span>
                    <span className="font-medium text-white truncate">
                        {state.github?.accountLogin || 'GitHub'}
                    </span>
                    <Check size={14} className="text-[#4fc98a]" aria-label="Connected" />
                </div>
                <button type="button" onClick={onContinue} className={authPrimaryButtonClass}>
                    Continue
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={onConnect}
                    disabled={isConnecting}
                    className={authButtonClass}
                >
                    <div className="absolute left-3.5 w-4 h-4 flex items-center justify-center">
                        <AuthModalGithubIcon />
                    </div>
                    <span>{isConnecting ? 'Opening GitHub...' : 'Continue with GitHub'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setShowGitlabSoon(true)}
                    className={authButtonClass}
                >
                    <div className="absolute left-3.5 w-4 h-4 flex items-center justify-center">
                        <OnboardingGitlabIcon />
                    </div>
                    <span aria-live="polite">
                        {showGitlabSoon ? 'GitLab is coming soon' : 'Continue with GitLab'}
                    </span>
                </button>
            </div>

            <button
                type="button"
                onClick={onSkip}
                className="mt-5 self-center font-sans text-xs text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
                Skip for now
            </button>
        </div>
    )
}
