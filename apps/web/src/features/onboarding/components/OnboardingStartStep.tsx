import { Check, Copy } from 'lucide-react'
import React from 'react'

import { OnboardingTerminalMock } from './OnboardingTerminalMock'
import { OnboardingWebMock } from './OnboardingWebMock'

import { authPrimaryButtonClass } from '@/features/auth/components/authModalStyles'

export const CLI_INSTALL_COMMAND = 'npm install -g @trydecember/cli'

const COPIED_MS = 1500

const cardClass =
    'flex flex-col min-w-0 overflow-hidden rounded-md border border-[#2A2A2A] bg-[#181818]'

// the dark window mocks sit on a warm stone ground so they stand out on the dark page;
// @container lets each mock scale itself to the card width
const shotClass =
    '@container relative h-[120px] sm:h-[180px] overflow-hidden border-b border-[#2A2A2A] bg-gradient-to-b from-[#efede8] to-[#e3e0d9]'

interface OnboardingStartStepProps {
    onContinueWithWeb: () => void
}

export const OnboardingStartStep: React.FC<OnboardingStartStepProps> = ({ onContinueWithWeb }) => {
    const [copied, setCopied] = React.useState(false)
    const commandRef = React.useRef<HTMLElement | null>(null)

    React.useEffect(() => {
        if (!copied) return
        const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
        return () => window.clearTimeout(timer)
    }, [copied])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(CLI_INSTALL_COMMAND)
            setCopied(true)
        } catch {
            // Clipboard can be blocked: select the command so the user can copy it by hand
            const node = commandRef.current
            const selection = window.getSelection()
            if (node && selection) {
                const range = document.createRange()
                range.selectNodeContents(node)
                selection.removeAllRanges()
                selection.addRange(range)
            }
        }
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={cardClass}>
                <div className={shotClass}>
                    <OnboardingTerminalMock stage={500} />
                </div>
                <div className="flex flex-col flex-1 gap-2.5 p-3.5">
                    <span className="text-[13.5px] font-medium text-white">December CLI</span>
                    <p className="text-xs text-[#888888] leading-relaxed">
                        Runs in any terminal. Can use your ChatGPT or Claude plan.
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 h-8 px-2.5 rounded-md border border-[#2A2A2A] bg-[#141414] min-w-0">
                        <code
                            ref={commandRef}
                            className="font-mono text-[11px] text-[#d6d6d6] truncate"
                        >
                            {CLI_INSTALL_COMMAND}
                        </code>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="shrink-0 text-[#737373] hover:text-white transition-colors cursor-pointer"
                            aria-label={copied ? 'Copied' : 'Copy install command'}
                            title={copied ? 'Copied' : 'Copy'}
                        >
                            {copied ? (
                                <Check size={13} className="text-[#4fc98a]" />
                            ) : (
                                <Copy size={13} />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className={`${cardClass} order-first sm:order-none`}>
                <div className={shotClass}>
                    <OnboardingWebMock stage={500} windowWidth={760} promptTop={66} />
                </div>
                <div className="flex flex-col flex-1 gap-2.5 p-3.5">
                    <span className="text-[13.5px] font-medium text-white">
                        December on the web
                    </span>
                    <p className="text-xs text-[#888888] leading-relaxed">
                        Nothing to install. Live preview, diffs and terminal in one place.
                    </p>
                    <button
                        type="button"
                        onClick={onContinueWithWeb}
                        className={`${authPrimaryButtonClass} mt-auto`}
                    >
                        Continue with web
                    </button>
                </div>
            </div>
        </div>
    )
}
