import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, ChevronDown } from 'lucide-react'
import React from 'react'

import { OnboardingProviderPicker } from './OnboardingProviderPicker'

import type { OnboardingState } from '@/features/onboarding/api/onboarding'

import {
    authButtonClass,
    authInputClass,
    authPrimaryButtonClass,
} from '@/features/auth/components/authModalStyles'
import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import {
    MAX_TOP_UP_USD,
    MIN_TOP_UP_USD,
    useRazorpayCheckout,
} from '@/features/billing/hooks/useRazorpayCheckout'
import { onboardingQueryKey } from '@/features/onboarding/hooks/useOnboarding'
import { detectProviderFromKey, sortProviders } from '@/features/onboarding/providerKeys'
import { useByokList, useByokMutations } from '@/features/profile/hooks/useByokData'
import { formatUsd } from '@/shared/lib/format'

const TOP_UP_AMOUNTS = [1, 5, 10]
const DEFAULT_TOP_UP = 10
// fallback only: the billing overview gives the live rate
const FALLBACK_USD_TO_INR = 92.68

type AmountChoice = number | 'custom'

const parseCustomAmount = (value: string): number | null => {
    if (!/^\d+$/.test(value)) return null
    const amount = parseInt(value, 10)
    return amount >= MIN_TOP_UP_USD && amount <= MAX_TOP_UP_USD ? amount : null
}
const DEFAULT_PROVIDER = 'anthropic'

type OpenOption = 'credits' | 'key' | null

const errorText = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

interface OnboardingModelsStepProps {
    state: OnboardingState
    isFinishing: boolean
    onFinish: () => void
    onSkip: () => void
}

export const OnboardingModelsStep: React.FC<OnboardingModelsStepProps> = ({
    state,
    isFinishing,
    onFinish,
    onSkip,
}) => {
    const queryClient = useQueryClient()
    const [openOption, setOpenOption] = React.useState<OpenOption>(null)
    const [amountChoice, setAmountChoice] = React.useState<AmountChoice>(DEFAULT_TOP_UP)
    const [customAmount, setCustomAmount] = React.useState('')
    const [provider, setProvider] = React.useState('')
    const [apiKey, setApiKey] = React.useState('')
    const [keyError, setKeyError] = React.useState<string | null>(null)
    // "Change" on the saved key reopens the form without losing the saved key
    const [isChangingKey, setIsChangingKey] = React.useState(false)

    const { data: byok } = useByokList(
        openOption === 'key' || state.ownKey !== null || isChangingKey
    )
    const { saveKey } = useByokMutations()
    const { startCheckout, isProcessing, error: paymentError } = useRazorpayCheckout()
    const { data: overview } = useBillingOverview(openOption === 'credits')
    const usdToInr = overview?.usdToInrRate ?? FALLBACK_USD_TO_INR

    const isCustom = amountChoice === 'custom'
    const amount = isCustom ? parseCustomAmount(customAmount) : amountChoice
    const showCustomError = isCustom && customAmount !== '' && amount === null
    const payLabel =
        amount === null
            ? 'Add credits'
            : `Add $${amount} (about ₹${Math.round(amount * usdToInr).toLocaleString('en-IN')})`

    const providers = React.useMemo(() => sortProviders(byok?.providers ?? []), [byok])
    const providerName = (id: string) => providers.find((item) => item.id === id)?.name || id
    const selectedProvider = providers.find((item) => item.id === provider)

    React.useEffect(() => {
        if (!provider && providers.length > 0) {
            const preferred = providers.find((item) => item.id === DEFAULT_PROVIDER)
            setProvider((preferred ?? providers[0]!).id)
        }
    }, [provider, providers])

    const toggle = (option: Exclude<OpenOption, null>) =>
        setOpenOption((current) => (current === option ? null : option))

    // a pasted key often says which provider it is for (sk-ant-, sk-or-, AIza, ...)
    const handleKeyChange = (value: string) => {
        setApiKey(value)
        const detected = detectProviderFromKey(value)
        if (detected && detected !== provider && providers.some((item) => item.id === detected)) {
            setProvider(detected)
        }
    }

    const startChangingKey = () => {
        if (state.ownKey) setProvider(state.ownKey.provider)
        setKeyError(null)
        setOpenOption('key')
        setIsChangingKey(true)
    }

    const handleSaveKey = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!provider || !apiKey.trim()) return
        setKeyError(null)
        try {
            // with no credits, the prompt box and runs from GitHub start on this key
            await saveKey.mutateAsync({ provider, apiKey: apiKey.trim() })
            setApiKey('')
            setIsChangingKey(false)
            await queryClient.invalidateQueries({ queryKey: onboardingQueryKey })
        } catch (err) {
            setKeyError(errorText(err, 'December could not save this key. Try again.'))
        }
    }

    if (state.steps.models && !isChangingKey) {
        const savedKey = state.ownKey
        const modelCount = savedKey
            ? byok?.credentials.find((item) => item.provider === savedKey.provider)?.models.length
            : undefined

        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 h-9 px-3.5 rounded-md border border-[#2A2A2A] bg-[#1e1e1e] text-[13px]">
                    <Check size={14} className="text-[#4fc98a] shrink-0" aria-label="Done" />
                    <span className="flex-1 min-w-0 truncate">
                        {savedKey ? (
                            <>
                                <span className="font-medium text-white">
                                    {providerName(savedKey.provider)}
                                </span>
                                <span className="text-[#888888]">
                                    {` ····${savedKey.keyHint}`}
                                    {modelCount ? ` · ${modelCount} models` : ''}
                                </span>
                            </>
                        ) : (
                            <span className="font-medium text-white">
                                {`${formatUsd(state.wallet.balanceInCents)} in your wallet`}
                            </span>
                        )}
                    </span>
                    {savedKey && (
                        <button
                            type="button"
                            onClick={startChangingKey}
                            className="shrink-0 text-xs text-[#888888] hover:text-white transition-colors cursor-pointer"
                        >
                            Change
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onFinish}
                    disabled={isFinishing}
                    className={authPrimaryButtonClass}
                >
                    {isFinishing ? 'Please wait...' : 'Start building'}
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={() => toggle('credits')}
                    aria-expanded={openOption === 'credits'}
                    className={`${authButtonClass} ${openOption === 'credits' ? 'border-[#3A3A3A]' : ''}`}
                >
                    <span>Add credits to your wallet</span>
                    <ChevronDown
                        size={14}
                        className={`absolute right-3 text-[#737373] transition-transform ${
                            openOption === 'credits' ? 'rotate-180' : ''
                        }`}
                    />
                </button>

                {openOption === 'credits' && (
                    <div className="flex flex-col gap-2 pb-1.5">
                        <div
                            role="radiogroup"
                            aria-label="Amount"
                            className="grid grid-cols-4 gap-[3px] h-9 p-[3px] rounded-md border border-[#2A2A2A] bg-[#141414]"
                        >
                            {[...TOP_UP_AMOUNTS, 'custom' as const].map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={amountChoice === value}
                                    onClick={() => setAmountChoice(value)}
                                    className={`rounded font-sans text-xs sm:text-[13px] tabular-nums transition-colors cursor-pointer ${
                                        amountChoice === value
                                            ? 'bg-[#2a2a2a] text-white'
                                            : 'text-[#888888] hover:text-white'
                                    }`}
                                >
                                    {value === 'custom' ? 'Custom' : `$${value}`}
                                </button>
                            ))}
                        </div>
                        {isCustom && (
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-xs sm:text-[13px] text-[#888888]">
                                    $
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoFocus
                                    aria-label="Custom amount in USD"
                                    placeholder={`${MIN_TOP_UP_USD} to ${MAX_TOP_UP_USD}`}
                                    value={customAmount}
                                    // whole dollars only: anything that is not a digit is dropped
                                    onChange={(event) =>
                                        setCustomAmount(
                                            event.target.value.replace(/\D/g, '').slice(0, 3)
                                        )
                                    }
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === 'Enter' &&
                                            amount !== null &&
                                            !isProcessing
                                        ) {
                                            void startCheckout(amount)
                                        }
                                    }}
                                    className={`${authInputClass} pl-6! tabular-nums`}
                                />
                            </div>
                        )}
                        {showCustomError && (
                            <p className="font-sans text-xs text-red-400 px-1 text-center">
                                Enter ${MIN_TOP_UP_USD} to ${MAX_TOP_UP_USD}
                            </p>
                        )}
                        {paymentError && (
                            <p className="font-sans text-xs text-red-400 px-1 text-center">
                                {paymentError}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (amount !== null) void startCheckout(amount)
                            }}
                            disabled={isProcessing || amount === null}
                            className={authPrimaryButtonClass}
                        >
                            {isProcessing ? 'Please wait...' : payLabel}
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => toggle('key')}
                    aria-expanded={openOption === 'key'}
                    className={`${authButtonClass} ${openOption === 'key' ? 'border-[#3A3A3A]' : ''}`}
                >
                    <span>Use your own API key</span>
                    <ChevronDown
                        size={14}
                        className={`absolute right-3 text-[#737373] transition-transform ${
                            openOption === 'key' ? 'rotate-180' : ''
                        }`}
                    />
                </button>

                {openOption === 'key' && (
                    <form onSubmit={handleSaveKey} className="flex flex-col gap-2 pb-1.5">
                        <OnboardingProviderPicker
                            providers={providers}
                            value={provider}
                            onChange={setProvider}
                            disabled={saveKey.isPending}
                        />
                        <div className="relative">
                            <input
                                type="password"
                                aria-label="API key"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="Paste your API key"
                                value={apiKey}
                                onChange={(event) => handleKeyChange(event.target.value)}
                                disabled={saveKey.isPending}
                                className={`${authInputClass} font-mono pr-20!`}
                            />
                            {selectedProvider?.keyUrl && (
                                <a
                                    href={selectedProvider.keyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Get a ${selectedProvider.name} API key`}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 font-sans text-xs text-[#888888] hover:text-white transition-colors"
                                >
                                    Get key
                                    <ArrowUpRight size={12} />
                                </a>
                            )}
                        </div>
                        {keyError && (
                            <p className="font-sans text-xs text-red-400 px-1 text-center">
                                {keyError}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={!provider || !apiKey.trim() || saveKey.isPending}
                            className={authPrimaryButtonClass}
                        >
                            {saveKey.isPending ? 'Checking key...' : 'Save key'}
                        </button>
                    </form>
                )}
            </div>

            <button
                type="button"
                onClick={isChangingKey ? () => setIsChangingKey(false) : onSkip}
                disabled={isFinishing}
                className="mt-5 self-center font-sans text-xs text-[#888888] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
                {isChangingKey ? 'Keep current key' : 'Skip for now'}
            </button>
        </div>
    )
}
