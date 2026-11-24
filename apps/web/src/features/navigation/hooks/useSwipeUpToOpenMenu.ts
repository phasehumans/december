import React from 'react'

import {
    hasOpenMenu,
    isKeyboardUp,
    swipeUpProgress,
    touchBelongsElsewhere,
    type SwipePoint,
} from '../lib/swipeUp'

import { useAppStore } from '@/app/store'
import { isAnyPopupOpen } from '@/shared/lib/useBackToClose'
import { readIsPhone } from '@/shared/lib/useIsPhone'

// phones only: a swipe up on the home screen opens the menu sheet, the same sheet as the
// menu button. the home screen does not scroll on phones, so an upward swipe is free.
//
// the swipe does nothing when:
// - the screen is wider than a phone, or more than one finger is down
// - the keyboard is up, or a menu, sheet or modal is open
// - it starts in the text box, in a menu, or in something that scrolls by itself
// - it is shorter than 60px or goes more to the side than up
// - text is selected (the finger is moving a selection handle)
//
// touch events are used, not pointer events: browsers cancel pointer events when they
// think a scroll started, touch events keep coming.

const hasSelectedText = () => {
    const selection = window.getSelection?.()
    return Boolean(selection && !selection.isCollapsed)
}

export const useSwipeUpToOpenMenu = (ref: React.RefObject<HTMLElement | null>) => {
    const openMobileSheet = useAppStore((s) => s.openMobileSheet)

    React.useEffect(() => {
        const container = ref.current
        if (!container) return

        let start: SwipePoint | null = null

        const onStart = (e: TouchEvent) => {
            start = null
            if (e.touches.length !== 1) return
            if (!readIsPhone() || isKeyboardUp()) return
            if (isAnyPopupOpen() || useAppStore.getState().isMobileSidebarOpen) return
            if (hasOpenMenu(container) || touchBelongsElsewhere(e.target, container)) return
            const touch = e.touches[0]
            if (touch) start = { x: touch.clientX, y: touch.clientY }
        }

        const onMove = (e: TouchEvent) => {
            if (!start) return
            const touch = e.touches[0]
            if (e.touches.length !== 1 || !touch) {
                start = null
                return
            }
            const progress = swipeUpProgress(start, { x: touch.clientX, y: touch.clientY })
            if (progress === 'pending') return
            start = null
            if (progress === 'open' && !hasSelectedText()) openMobileSheet('menu')
        }

        const onEnd = () => {
            start = null
        }

        container.addEventListener('touchstart', onStart, { passive: true })
        container.addEventListener('touchmove', onMove, { passive: true })
        container.addEventListener('touchend', onEnd, { passive: true })
        container.addEventListener('touchcancel', onEnd, { passive: true })
        return () => {
            container.removeEventListener('touchstart', onStart)
            container.removeEventListener('touchmove', onMove)
            container.removeEventListener('touchend', onEnd)
            container.removeEventListener('touchcancel', onEnd)
        }
    }, [ref, openMobileSheet])
}
