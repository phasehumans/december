import React from 'react'

import { sectionBoxClass } from './settingsStyles'
import {
    SettingsInput,
    SettingsRow,
    SettingsSection,
    outlineButtonClass,
    usePreviewValue,
} from './SettingsUi'

import { SoonPill, Switch } from '@/features/connections/components/ConnectionsUi'

/** one limit: an amount in dollars and a switch (N4-A) */
const LimitRow: React.FC<{ id: string; label: string; amount: string; on: boolean }> = ({
    id,
    label,
    amount: initialAmount,
    on: initialOn,
}) => {
    const [amount, setAmount] = usePreviewValue(`billing.${id}.amount`, initialAmount)
    const [on, setOn] = usePreviewValue(`billing.${id}.on`, initialOn)
    return (
        <SettingsRow label={label}>
            <SettingsInput
                label={`${label}, in dollars`}
                value={amount}
                onChange={(value) => setAmount(value.replace(/[^\d]/g, ''))}
                prefix="$"
                mono
                className="w-[76px]"
            />
            <Switch label={label} checked={on} onChange={setOn} />
        </SettingsRow>
    )
}

/** "Invite a friend" under the balance (N15-A). ui only: the link is a sample */
export const ReferralRow: React.FC<{ name?: string }> = ({ name }) => {
    const [isCopied, setIsCopied] = React.useState(false)
    const slug =
        (name || 'you')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') || 'you'
    const link = `https://trydecember.com/r/${slug}`

    const copy = () => {
        void navigator.clipboard
            .writeText(link)
            .then(() => {
                setIsCopied(true)
                window.setTimeout(() => setIsCopied(false), 2000)
            })
            .catch(() => {
                // Intentionally swallowed: the browser refused the clipboard, nothing to undo
            })
    }

    return (
        <div className={sectionBoxClass}>
            <SettingsRow label="Invite a friend" hint="You both get $5 in credits">
                <button type="button" onClick={copy} className={outlineButtonClass}>
                    {isCopied ? 'Copied' : 'Copy link'}
                </button>
            </SettingsRow>
        </div>
    )
}

/**
 * Limits (N4-A) and auto top-up (N22) on Billing. Ui only until the server part exists
 * (issue 638): the values stay in memory and nothing is charged or paused.
 */
export const BillingPreviewSections: React.FC = () => {
    const [autoTopUp, setAutoTopUp] = usePreviewValue('billing.autoTopUp.on', false)
    const [topUpAmount, setTopUpAmount] = usePreviewValue('billing.autoTopUp.amount', '10')
    const [topUpUnder, setTopUpUnder] = usePreviewValue('billing.autoTopUp.under', '2')
    const digits = (value: string) => value.replace(/[^\d]/g, '')

    return (
        <>
            <SettingsSection
                title="Limits"
                description="Get a warning or a pause before credits run out."
            >
                <LimitRow id="lowBalance" label="Tell me when the balance is under" amount="2" on />
                <LimitRow id="sessionLimit" label="Pause a session when it reaches" amount="5" on />
                <LimitRow
                    id="dayLimit"
                    label="Pause all sessions at a day's total of"
                    amount="10"
                    on={false}
                />
            </SettingsSection>

            <SettingsSection
                title="Auto top-up"
                description="Add credits by itself when the balance is low."
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
