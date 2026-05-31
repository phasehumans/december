import React, { useState } from 'react'
import { Modal } from '@/shared/components/ui/Modal'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

interface AddCardModalProps {
    onClose: () => void
    onSave: (number: string, expiry: string) => void
}

export const AddCardModal: React.FC<AddCardModalProps> = ({ onClose, onSave }) => {
    const [cardNumber, setCardNumber] = useState('')
    const [expiry, setExpiry] = useState('')
    const [cvv, setCvv] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        const cleanNumber = cardNumber.replace(/\s+/g, '')
        if (cleanNumber.length < 16) {
            setError('Please enter a valid 16-digit card number.')
            return
        }
        if (!/^\d{2}\/\d{2}$/.test(expiry)) {
            setError('Please enter expiry in MM/YY format.')
            return
        }
        if (cvv.length < 3) {
            setError('Please enter a valid 3-digit CVV.')
            return
        }
        if (!name.trim()) {
            setError('Please enter the cardholder name.')
            return
        }

        setIsSaving(true)
        setError(null)
        await new Promise((resolve) => setTimeout(resolve, 800))
        onSave(cleanNumber, expiry)
        setIsSaving(false)
        onClose()
    }

    return (
        <Modal isOpen={true} onClose={onClose} title="Add Payment Card" maxWidth="max-w-[420px]">
            <div className="space-y-4">
                <Input
                    label="Card Number"
                    value={cardNumber}
                    onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '')
                        val = val.match(/.{1,4}/g)?.join(' ') || val
                        setCardNumber(val)
                        setError(null)
                    }}
                    placeholder="•••• •••• •••• ••••"
                    maxLength={19}
                    autoFocus
                />
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Expiry Date"
                        value={expiry}
                        onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '')
                            if (val.length > 2) {
                                val = `${val.slice(0, 2)}/${val.slice(2, 4)}`
                            }
                            setExpiry(val)
                            setError(null)
                        }}
                        placeholder="MM/YY"
                        maxLength={5}
                    />
                    <Input
                        label="CVV"
                        type="password"
                        value={cvv}
                        onChange={(e) => {
                            setCvv(e.target.value.replace(/\D/g, ''))
                            setError(null)
                        }}
                        placeholder="•••"
                        maxLength={3}
                    />
                </div>
                <Input
                    label="Cardholder Name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value)
                        setError(null)
                    }}
                    placeholder="John Doe"
                />
                {error && <p className="text-[13px] text-red-400 px-1">{error}</p>}
                <div className="mt-8 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        isLoading={isSaving}
                        disabled={
                            cardNumber.length < 19 ||
                            expiry.length < 5 ||
                            cvv.length < 3 ||
                            !name.trim()
                        }
                    >
                        Save Card
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
