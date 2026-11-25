import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import {
    SettingsInput,
    SettingsRow,
    SettingsSection,
    outlineButtonClass,
    usePreviewValue,
} from './SettingsUi'

import { billingAPI, type SpendLimits } from '@/features/billing/api/billing'
import { billingQueryKeys } from '@/features/billing/hooks/useBillingData'
import { DemoPill, SoonPill, Switch } from '@/features/connections/components/ConnectionsUi'
import { formatCredit } from '@/shared/lib/format'

// the server takes $1 to $1000 for each amount
const MAX_LIMIT_DOLLARS = 1000

/** the cents of a whole-dollar amount the server takes, or null */
const toLimitCents = (dollars: string): number | null => {
    const amount = Number(dollars)
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_LIMIT_DOLLARS) return null
    return amount * 100
}

/**
 * One limit: an amount in whole dollars and a switch (N4-A). The switch saves the amount
 * (on) or null (off). A new amount is saved when the box loses focus or on Enter.
 */
const LimitRow: React.FC<{
    label: string
    /** the saved amount in cents; null is off */
    cents: number | null
    /** the amount in dollars the box shows while the limit is off */
    offAmount: string
    disabled: boolean
    onSave: (cents: number | null) => void
}> = ({ label, cents, offAmount, disabled, onSave }) => {
    const savedAmount = cents === null ? null : String(Math.round(cents / 100))
    const [amount, setAmount] = React.useState(savedAmount ?? offAmount)
    // the server answered with a new amount: the box shows it
    React.useEffect(() => {
        if (savedAmount !== null) setAmount(savedAmount)
    }, [savedAmount])

    const saveAmount = () => {
        const next = toLimitCents(amount)
        if (next === null) {
            setAmount(savedAmount ?? offAmount)
            return
        }
        if (cents !== null && next !== cents) onSave(next)
    }

    return (
        <SettingsRow label={label}>
            <div
                onBlur={saveAmount}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') saveAmount()
                }}
            >
                <SettingsInput
                    label={`${label}, in dollars`}
                    value={amount}
                    onChange={(value) => setAmount(value.replace(/[^\d]/g, '').slice(0, 4))}
                    prefix="$"
                    mono
                    className="w-[76px]"
                />
            </div>
            <Switch
                label={label}
                checked={cents !== null}
                disabled={disabled}
                onChange={(on) =>
                    onSave(on ? (toLimitCents(amount) ?? toLimitCents(offAmount)) : null)
                }
            />
        </SettingsRow>
    )
}

/**
 * Limits on Billing (N4-A, #638): the low balance alert, the limit for one session and the
 * limit for one day. The values are the user's own, read from and saved to the server.
 */
export const BillingLimitsSection: React.FC = () => {
    const queryClient = useQueryClient()
    const { data: limits } = useQuery({
        queryKey: billingQueryKeys.limits,
        queryFn: billingAPI.getLimits,
        staleTime: 60 * 1000,
        retry: false,
    })
    const save = useMutation({
        mutationFn: (change: Partial<SpendLimits>) => billingAPI.updateLimits(change),
        onSuccess: (saved) => queryClient.setQueryData(billingQueryKeys.limits, saved),
        // the rows go back to what the server has
        onError: () => queryClient.invalidateQueries({ queryKey: billingQueryKeys.limits }),
    })

    if (!limits) return null

    const row = (field: keyof SpendLimits, label: string, offAmount: string) => (
        <LimitRow
            label={label}
            cents={limits[field]}
            offAmount={offAmount}
            disabled={save.isPending}
            onSave={(cents) => save.mutate({ [field]: cents })}
        />
    )

    return (
        <SettingsSection
            title="Limits"
            description="Get a warning or a pause before credits run out."
        >
            {row('lowBalanceAlertCents', 'Tell me when the balance is under', '1')}
            {row('sessionLimitCents', 'Pause a session when it reaches', '5')}
            {row('dayLimitCents', "Pause all sessions at a day's total of", '10')}
        </SettingsSection>
    )
}

/**
 * "Invite a friend", a row of the Credits box under the balance (N15-A). The link and the
 * amount come from the server. With no answer from the server there is no row.
 */
export const ReferralRow: React.FC = () => {
    const [isCopied, setIsCopied] = React.useState(false)
    const { data: referral } = useQuery({
        queryKey: billingQueryKeys.referral,
        queryFn: billingAPI.getReferral,
        staleTime: 60 * 1000,
        retry: false,
    })

    if (!referral) return null

    const copy = () => {
        void navigator.clipboard
            .writeText(referral.link)
            .then(() => {
                setIsCopied(true)
                window.setTimeout(() => setIsCopied(false), 2000)
            })
            .catch(() => {
                // Intentionally swallowed: the browser refused the clipboard, nothing to undo
            })
    }

    return (
        <SettingsRow
            label="Invite a friend"
            hint={`You both get ${formatCredit(referral.amountInCents)} after their first payment of ${formatCredit(referral.minTopUpInCents)} or more`}
        >
            <span className="min-w-0 truncate font-mono text-[12px] text-[#7B7A79] select-all">
                {referral.link.replace(/^https?:\/\//, '')}
            </span>
            <button type="button" onClick={copy} className={outlineButtonClass}>
                {isCopied ? 'Copied' : 'Copy link'}
            </button>
        </SettingsRow>
    )
}

/**
 * Auto top-up (N22) on Billing. Ui only: it needs saved payment methods (issue 638 section
 * 4). The values stay in memory and nothing is charged, so it shows only with the preview
 * flag on, with the Demo pill.
 */
export const BillingPreviewSections: React.FC = () => {
    const [autoTopUp, setAutoTopUp] = usePreviewValue('billing.autoTopUp.on', false)
    const [topUpAmount, setTopUpAmount] = usePreviewValue('billing.autoTopUp.amount', '10')
    const [topUpUnder, setTopUpUnder] = usePreviewValue('billing.autoTopUp.under', '2')
    const digits = (value: string) => value.replace(/[^\d]/g, '')

    return (
        <>
            <SettingsSection
                title="Auto top-up"
                description="Add credits by itself when the balance is low."
                action={<DemoPill />}
            >
                <SettingsRow label="Add credits when the balance is low">
                    <Switch
                        label="Add credits when the balance is low"
                        checked={autoTopUp}
                        onChange={setAutoTopUp}
                    />
                </SettingsRow>
                <SettingsRow label="Add">
                    <SettingsInput
                        label="Amount to add, in dollars"
                        value={topUpAmount}
                        onChange={(value) => setTopUpAmount(digits(value))}
                        prefix="$"
                        mono
                        className="w-[76px]"
                    />
                    <span className="text-[13px] text-[#7B7A79]">when under</span>
                    <SettingsInput
                        label="Balance that starts a top-up, in dollars"
                        value={topUpUnder}
                        onChange={(value) => setTopUpUnder(digits(value))}
                        prefix="$"
                        mono
                        className="w-[76px]"
                    />
                </SettingsRow>
                <SettingsRow label="Pay with" hint="No saved payment method">
                    <SoonPill />
                </SettingsRow>
            </SettingsSection>
        </>
    )
}
