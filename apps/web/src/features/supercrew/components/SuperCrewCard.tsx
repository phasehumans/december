import { Check } from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'

import { useSuperCrewWaitlist } from '../hooks/useSuperCrewWaitlist'
import { SUPER_CREW_POPUP_DELAY_MS, shouldAutoOpenSuperCrew } from '../lib/autoPopup'

import { OfficeCanvas } from './OfficeCanvas'

import { useAppStore } from '@/app/store'
import { Icons } from '@/shared/components/ui/Icons'
import { useBackToClose } from '@/shared/lib/useBackToClose'
import { useIsPhone } from '@/shared/lib/useIsPhone'

// fade the office into the card instead of framing it
const FADE_MASK = 'radial-gradient(125% 105% at 50% 38%, #000 58%, transparent 99%)'

export const SuperCrewCard: React.FC<{ isHome: boolean }> = ({ isHome }) => {
    const isOpen = useAppStore((s) => s.isSuperCrewOpen)
    const setIsOpen = useAppStore((s) => s.setIsSuperCrewOpen)
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const setShowAuthModal = useAppStore((s) => s.setShowAuthModal)
    const { state, join, markSeen } = useSuperCrewWaitlist(isAuthenticated)

    // first visit after onboarding: open by itself once per account. phones open it only from the menu
    const isPhone = useIsPhone()
    const canAutoOpen = shouldAutoOpenSuperCrew({ isAuthenticated, isHome, isOpen, isPhone, state })
    React.useEffect(() => {
        if (!canAutoOpen) return
        const timer = setTimeout(() => setIsOpen(true), SUPER_CREW_POPUP_DELAY_MS)
        return () => clearTimeout(timer)
    }, [canAutoOpen, setIsOpen])

    // back button and back swipe close the card instead of leaving the page
    const close = React.useCallback(() => setIsOpen(false), [setIsOpen])
    useBackToClose({ isOpen, onClose: close })

    // any open (auto or from the sidebar) counts as seen, so the popup never comes back
    const { mutate: markSeenMutate } = markSeen
    const seenSentRef = React.useRef(false)
    const needsSeen = isOpen && !!state && !state.popupSeen
    React.useEffect(() => {
        if (!needsSeen || seenSentRef.current) return
        seenSentRef.current = true
        markSeenMutate()
    }, [needsSeen, markSeenMutate])

    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, setIsOpen])

    if (!isOpen || typeof document === 'undefined') return null

    const joined = !!state?.joined
    let button: React.ReactNode
    if (!isAuthenticated) {
        button = (
            <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full h-[28px] rounded-[8px] bg-[#E8E8E8] hover:bg-white text-[#141414] text-[12.5px] font-medium transition-colors cursor-pointer outline-none"
            >
                Sign in to get notified
            </button>
        )
    } else if (joined) {
        button = (
            <div className="w-full h-[28px] rounded-[8px] bg-[#252525] text-[#D6D5D4] text-[12.5px] font-medium flex items-center justify-center gap-1.5 select-none">
                <Check className="w-3.5 h-3.5 text-[#87B2F4]" strokeWidth={2.5} />
                You&apos;re on the list
            </div>
        )
    } else {
        button = (
            <button
                type="button"
                onClick={() => join.mutate()}
                disabled={join.isPending}
                className="w-full h-[28px] rounded-[8px] bg-[#E8E8E8] hover:bg-white text-[#141414] text-[12.5px] font-medium transition-colors cursor-pointer outline-none disabled:opacity-70 disabled:cursor-default"
            >
                Notify me
            </button>
        )
    }

    return createPortal(
        <>
            <div
                className="md:hidden fixed inset-0 z-[190] bg-black/50 animate-in fade-in duration-200"
                onClick={() => setIsOpen(false)}
            />
            <div
                role="dialog"
                aria-label="Super Crew"
                className="fixed z-[200] inset-x-0 bottom-0 rounded-t-2xl md:inset-x-auto md:bottom-4 md:right-4 md:w-[286px] md:rounded-2xl bg-[#1E1E1E] border border-[#2A2928] shadow-lg shadow-black/40 overflow-hidden flex flex-col font-sans animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
                <OfficeCanvas
                    className="w-full aspect-[9/5] md:aspect-auto md:h-[158px]"
                    style={{ WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK }}
                />
                <div className="flex flex-col gap-[7px] px-2.5 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] md:pb-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-[7px] min-w-0">
                            <Icons.CrewDots className="w-3.5 h-3.5 text-[#D6D5D4] shrink-0" />
                            <span className="text-[12.5px] font-semibold text-[#EDEDED] truncate">
                                Super Crew
                            </span>
                            <span className="text-[10px] font-medium text-[#919191] border border-[#383735] rounded-full px-1.5 leading-4 shrink-0">
                                Soon
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close"
                            className="w-[22px] h-[22px] flex items-center justify-center rounded-md text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#2A2928] transition-colors cursor-pointer outline-none shrink-0"
                        >
                            <Icons.X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <p className="text-[12px] leading-[1.45] text-[#919191]">
                        A crew of agents that keep working on your repo while you&apos;re away.
                    </p>
                    {button}
                </div>
            </div>
        </>,
        document.body
    )
}
