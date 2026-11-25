/** the gap between the box and a menu above it, and between the menu and the screen edge */
const GAP = 8
/** a menu under the text starts this far under the top of the box */
const BOTTOM_OFFSET = 48
/** the room the full menu wants under the box before it opens above */
const WANTED_BELOW = 260
/** three rows: the menu never gets smaller, it scrolls inside */
const MIN_HEIGHT = 96

export type SlashMenuPlacement = {
    side: 'top' | 'bottom'
    /** the most the menu may take, so all of it stays in the visible part of the screen */
    maxHeight: number
}

/**
 * Where the slash menu opens and how tall it may be. The visible part of the screen is
 * the visual viewport: on a phone the keyboard covers the rest. All values are in the
 * coordinates of getBoundingClientRect.
 */
export const getSlashMenuPlacement = (data: {
    boxTop: number
    boxBottom: number
    /** window.visualViewport.offsetTop */
    viewportTop: number
    /** window.visualViewport.height */
    viewportHeight: number
    /** 'top': the session box, which always opens above */
    placement: 'auto' | 'top'
}): SlashMenuPlacement => {
    const { boxTop, boxBottom, viewportTop, viewportHeight, placement } = data
    const viewportBottom = viewportTop + viewportHeight
    const spaceBelow = viewportBottom - boxBottom
    const spaceAbove = boxTop - viewportTop

    const side =
        placement === 'top' || (spaceBelow < WANTED_BELOW && spaceAbove > spaceBelow)
            ? 'top'
            : 'bottom'
    const room =
        side === 'top' ? spaceAbove - GAP - GAP : viewportBottom - (boxTop + BOTTOM_OFFSET) - GAP
    return { side, maxHeight: Math.max(MIN_HEIGHT, Math.floor(room)) }
}
