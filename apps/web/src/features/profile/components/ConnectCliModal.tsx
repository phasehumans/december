import { Copy, Check } from 'lucide-react'
import React, { useState } from 'react'

import { Modal } from '@/shared/components/ui/Modal'

interface ConnectCliModalProps {
    isOpen: boolean
    onClose: () => void
    userId?: string
}

export const ConnectCliModal: React.FC<ConnectCliModalProps> = ({ isOpen, onClose, userId }) => {
    const [copied, setCopied] = useState(false)

    // Generate a realistic authentication token using the user's ID
    const shortId = userId ? userId.substring(0, 8) : 'guest'

    // Generate a stable-ish mock token for this render session, or regenerate if needed.
    // We can use a React ref or state if we want it to remain exactly the same when copying,
    // which it will since this component mounts/unmounts with the modal open/close.
    const [generatedToken] = useState(() => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        const randomStr = Array.from(
            { length: 64 },
            () => chars[Math.floor(Math.random() * chars.length)]
        ).join('')
        return `dec_cli_${shortId}_${randomStr}`
    })

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedToken)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Connect December CLI"
            description="Authenticate your local terminal session with your December account."
            variant="premium"
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <ol className="text-[13px] text-[#A09F9D] space-y-2.5 list-decimal pl-4 leading-relaxed">
                        <li>Copy the authentication code below.</li>
                        <li>
                            Open your terminal and run:{' '}
                            <code className="text-white bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded font-mono text-[12px]">
                                december /login
                            </code>
                        </li>
                        <li>
                            Select{' '}
                            <strong className="text-white font-medium">
                                Authenticate with code
                            </strong>{' '}
                            when prompted.
                        </li>
                        <li>Paste the code and press Enter to complete the login.</li>
                    </ol>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center justify-between border border-[#2B2A27] hover:border-[#383736] rounded-lg p-3 bg-[#2A2A2A] transition-all font-mono text-[12px] text-white">
                        <span className="select-all break-all pr-2 max-h-[80px] overflow-y-auto w-full leading-relaxed text-[#D6D5C9]">
                            {generatedToken}
                        </span>
                        <button
                            onClick={handleCopy}
                            className="text-[#8F8E8D] hover:text-white transition-colors cursor-pointer flex-shrink-0 ml-2 p-1.5 hover:bg-white/5 rounded-md"
                            title="Copy code"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
