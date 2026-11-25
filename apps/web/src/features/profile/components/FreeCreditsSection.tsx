import React, { useState } from 'react'

import { SettingsRow, SettingsSection, outlineButtonClass } from './SettingsUi'

import {
    useFreeCreditRequest,
    useRequestFreeCredits,
} from '@/features/billing/hooks/useBillingData'
import {
    FormError,
    ModalActions,
    fieldLabelClass,
    inputClass,
} from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''

const FreeCreditsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const requestCredits = useRequestFreeCredits()
    const [buildPlan, setBuildPlan] = useState('')
    const [heardFrom, setHeardFrom] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canSend = buildPlan.trim().length >= 3 && heardFrom.trim().length > 0 && agreed

    const handleSend = async () => {
        setError(null)
        try {
            await requestCredits.mutateAsync({
                buildPlan: buildPlan.trim(),
                heardFrom: heardFrom.trim(),
                agreeToFeedback: true,
            })
            onClose()
        } catch (err: any) {
            setError(err?.message || 'The request did not go through. Try again.')
        }
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Request $5 in credits"
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    // the modal is portaled, so stop the submit reaching a form behind it
                    e.stopPropagation()
                    if (canSend && !requestCredits.isPending) void handleSend()
                }}
                className="flex flex-col gap-4"
            >
                <label className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>What will you build with December?</span>
                    <textarea
                        autoFocus
                        aria-label="What will you build with December?"
                        value={buildPlan}
                        maxLength={1000}
                        rows={3}
                        onChange={(e) => setBuildPlan(e.target.value)}
                        className={cn(inputClass, 'resize-none')}
                    />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>How did you hear about December?</span>
                    <input
                        type="text"
                        aria-label="How did you hear about December?"
                        value={heardFrom}
                        maxLength={200}
                        onChange={(e) => setHeardFrom(e.target.value)}
                        className={inputClass}
                    />
                </label>
                <label className="flex items-center gap-2.5 text-[13px] text-[#D6D5C9] cursor-pointer select-none">
                    <input
                        type="checkbox"
                        aria-label="I will give feedback on December"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="w-4 h-4 accent-[#87B2F4] cursor-pointer"
                    />
                    I will give feedback on December
                </label>

                <FormError>{error}</FormError>

                <ModalActions
                    onCancel={onClose}
                    submitLabel="Send request"
                    submitDisabled={!canSend}
                    isPending={requestCredits.isPending}
                />
            </form>
        </Modal>
    )
}

/** $5 once per person, on request; an admin approves it by hand (#624 part 2) */
export const FreeCreditsSection: React.FC = () => {
    const { data: request, isLoading } = useFreeCreditRequest()
    const [showModal, setShowModal] = useState(false)

    if (isLoading) return null

    const status = request?.status
    const label =
        status === 'APPROVED'
            ? `Added on ${formatDate(request?.reviewedAt)}`
            : status === 'REJECTED'
              ? request?.rejectReason
                  ? `Declined: ${request.rejectReason}`
                  : 'Declined'
              : status === 'PENDING'
                ? 'Requested'
                : '$5 in credits, once'

    return (
        <SettingsSection title="Free credits" description="Credits to try December with.">
            <SettingsRow label={label}>
                {!status && (
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className={outlineButtonClass}
                    >
                        Request $5
                    </button>
                )}
            </SettingsRow>
            {showModal && <FreeCreditsModal onClose={() => setShowModal(false)} />}
        </SettingsSection>
    )
}
