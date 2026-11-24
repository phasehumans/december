import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { OnboardingGithubStep } from './OnboardingGithubStep'
import { OnboardingModelsStep } from './OnboardingModelsStep'
import { OnboardingStartStep } from './OnboardingStartStep'
import { OnboardingTopBar } from './OnboardingTopBar'

import { authPrimaryButtonClass } from '@/features/auth/components/authModalStyles'
import { githubOAuth } from '@/features/auth/githubOAuth'
import { ONBOARDING_STEPS, type OnboardingStep } from '@/features/onboarding/api/onboarding'
import {
    useOnboardingMutations,
    useOnboardingState,
} from '@/features/onboarding/hooks/useOnboarding'
import { profileAPI } from '@/features/profile/api/profile'
import { useGitlabConnection } from '@/features/profile/hooks/useGitlabConnection'
import { LogoLoader } from '@/shared/components/ui/LogoLoader'

const STEP_TITLES: Record<OnboardingStep, string> = {
    github: 'Connect your Git provider',
    start: 'Where do you want to start?',
    models: 'Choose how to pay for models',
}

/** full-screen setup flow every user sees once after sign-in. Styled like the sign-up page. */
export const OnboardingPage: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { data: state, isLoading, error, refetch } = useOnboardingState()
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        staleTime: 60000,
    })
    const { updateOnboarding, completeOnboarding } = useOnboardingMutations()
    const [step, setStep] = React.useState<OnboardingStep | null>(null)
    const [isConnectingGithub, setIsConnectingGithub] = React.useState(false)
    const [isConnectingGitlab, setIsConnectingGitlab] = React.useState(false)
    const gitlab = useGitlabConnection()
    const [finishError, setFinishError] = React.useState<string | null>(null)

    const redirectTarget = React.useMemo(() => {
        const target = new URLSearchParams(location.search).get('redirect')
        return githubOAuth.isSafeReturnPath(target) && !target.startsWith('/onboarding')
            ? target
            : '/'
    }, [location.search])

    // resume at the saved step, also after a reload or a return from GitHub
    React.useEffect(() => {
        if (state && step === null) {
            setStep(state.step ?? 'github')
        }
    }, [state, step])

    // a finished user has nothing to do here
    React.useEffect(() => {
        if (state?.completedAt) {
            navigate(redirectTarget, { replace: true })
        }
    }, [state?.completedAt, navigate, redirectTarget])

    const goTo = (next: OnboardingStep) => {
        setStep(next)
        updateOnboarding.mutate({ step: next })
    }

    const finish = async () => {
        setFinishError(null)
        try {
            await completeOnboarding.mutateAsync()
            navigate(redirectTarget, { replace: true })
        } catch {
            setFinishError('December could not save your setup. Try again.')
        }
    }

    const stepIndex = step ? ONBOARDING_STEPS.indexOf(step) : 0

    const goNext = () => {
        const next = ONBOARDING_STEPS[stepIndex + 1]
        if (next) {
            goTo(next)
        } else {
            void finish()
        }
    }

    const goBack = () => {
        const previous = ONBOARDING_STEPS[stepIndex - 1]
        if (previous) goTo(previous)
    }

    const connectGithub = async () => {
        setIsConnectingGithub(true)
        try {
            // save the step first, so the return from GitHub opens this step again
            await updateOnboarding.mutateAsync({ step: 'github' })
        } catch {
            // Intentionally ignored: the install still works, the user just may land on step 1 again
        }
        window.location.href = profileAPI.getGithubConnectUrl(profile?.id ?? '')
    }

    const connectGitlab = async () => {
        setIsConnectingGitlab(true)
        try {
            // save the step first, so the return from GitLab opens this step again
            await updateOnboarding.mutateAsync({ step: 'github' })
        } catch {
            // Intentionally ignored: the connect still works, the user just may land on step 1 again
        }
        window.location.href = gitlab.connectUrl('/onboarding')
    }

    if (isLoading || (state && step === null)) {
        return <LogoLoader />
    }

    if (error || !state || !step) {
        return (
            <div className="fixed inset-0 z-[100] bg-[#141414] flex flex-col items-center justify-center font-sans p-6">
                <div className="w-full max-w-[340px] flex flex-col items-center gap-4 text-center">
                    <p className="text-[13px] text-[#888888]">
                        December could not load your setup.
                    </p>
                    <button
                        type="button"
                        onClick={() => void refetch()}
                        className={authPrimaryButtonClass}
                    >
                        Try again
                    </button>
                </div>
            </div>
        )
    }

    const isWide = step === 'start'

    return (
        <div className="fixed inset-0 z-[100] bg-[#141414] flex flex-col font-sans overflow-y-auto">
            <div className="px-6 pt-5">
                <OnboardingTopBar
                    stepIndex={stepIndex}
                    stepCount={ONBOARDING_STEPS.length}
                    onBack={goBack}
                    onSkip={goNext}
                    isWide={isWide}
                />
            </div>

            <div className="flex-1 flex items-center justify-center p-6 md:p-10">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={`w-full ${isWide ? 'max-w-[600px]' : 'max-w-[340px]'}`}
                >
                    <h1 className="mb-5 text-center font-sans text-[17px] font-medium tracking-[-0.015em] text-white">
                        {STEP_TITLES[step]}
                    </h1>

                    {step === 'github' && (
                        <OnboardingGithubStep
                            state={state}
                            isConnecting={isConnectingGithub}
                            onConnect={() => void connectGithub()}
                            isGitlabAvailable={gitlab.isAvailable}
                            isConnectingGitlab={isConnectingGitlab}
                            onConnectGitlab={() => void connectGitlab()}
                            onContinue={goNext}
                            onSkip={goNext}
                        />
                    )}

                    {step === 'start' && <OnboardingStartStep onContinueWithWeb={goNext} />}

                    {step === 'models' && (
                        <OnboardingModelsStep
                            state={state}
                            isFinishing={completeOnboarding.isPending}
                            onFinish={() => void finish()}
                            onSkip={() => void finish()}
                        />
                    )}

                    {finishError && (
                        <p className="mt-3 font-sans text-xs text-red-400 text-center">
                            {finishError}
                        </p>
                    )}
                </motion.div>
            </div>
        </div>
    )
}
