// rules for the swipe up on the phone home screen that opens the menu sheet.
// kept apart from the hook so the rules can be tested without touch events.

/** how far up the finger must travel before the sheet opens */
export const SWIPE_UP_MIN_PX = 60
/** the swipe must be at least this many times more vertical than horizontal */
const VERTICAL_RATIO = 2
/** a keyboard (or a zoomed page) takes at least this much of the screen */
const KEYBOARD_MIN_PX = 100

export interface SwipePoint {
    x: number
    y: number
}

export type SwipeProgress = 'pending' | 'open' | 'cancel'

/**
 * where a one-finger swipe stands: still short ('pending'), far enough up and straight
 * ('open'), or far enough up but too much to the side ('cancel')
 */
export const swipeUpProgress = (start: SwipePoint, now: SwipePoint): SwipeProgress => {
    const up = start.y - now.y
    if (up < SWIPE_UP_MIN_PX) return 'pending'
    const side = Math.abs(now.x - start.x)
    return up >= side * VERTICAL_RATIO ? 'open' : 'cancel'
}

const TEXT_ENTRY = 'textarea, input, select, [contenteditable]:not([contenteditable="false"])'
const MENU = '[role="menu"], [role="listbox"], [role="dialog"]'

const scrolls = (overflow: string) => overflow === 'auto' || overflow === 'scroll'

/** true when the element has more content than room and lets the finger move it */
const scrollsItself = (el: Element): boolean => {
    const canY = el.scrollHeight > el.clientHeight + 1
    const canX = el.scrollWidth > el.clientWidth + 1
    if (!canY && !canX) return false
    const style = window.getComputedStyle(el)
    return (canY && scrolls(style.overflowY)) || (canX && scrolls(style.overflowX))
}

/**
 * true when a touch on target belongs to something else: a text box, a menu, or anything
 * between target and container that scrolls by itself
 */
export const touchBelongsElsewhere = (target: EventTarget | null, container: Element): boolean => {
    if (!(target instanceof Element)) return true
    if (target.closest(TEXT_ENTRY) || target.closest(MENU)) return true
    for (let el: Element | null = target; el && el !== container; el = el.parentElement) {
        if (scrollsItself(el)) return true
    }
    return false
}

/** true while a menu of the page (slash menu, model menu, + menu) is open */
export const hasOpenMenu = (container: Element): boolean =>
    container.querySelector(`${MENU}, [aria-expanded="true"]`) !== null

/** true while the on-screen keyboard is up (also true on a zoomed page, where a swipe pans) */
export const isKeyboardUp = (): boolean => {
    const viewport = window.visualViewport
    if (!viewport) return false
    return window.innerHeight - viewport.height > KEYBOARD_MIN_PX
}
