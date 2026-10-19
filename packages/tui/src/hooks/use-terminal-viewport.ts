import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export interface ViewportEntry {
    /**
     * Whether the element is currently within the visible terminal viewport.
     */
    isVisible: boolean
}

/**
 * Hook to detect if a component is within the terminal viewport.
 *
 * Walks the Yoga layout tree to compute the element's absolute screen Y bounds.
 * If the element is scrolled above the screen (bottom <= 0) or below (top >= rows),
 * isVisible is false.
 */
export function useTerminalViewport(): [(element: any) => void, ViewportEntry] {
    const elementRef = useRef<any>(null)
    const [isVisible, setIsVisible] = useState(true)
    const isVisibleRef = useRef(true)

    const setElement = useCallback((el: any) => {
        elementRef.current = el
    }, [])

    // Runs on every render because Yoga layout values can change without React state mutations.
    // Only calls setIsVisible when the element crosses the viewport visibility boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const el = elementRef.current
        if (!el || !el.yogaNode) {
            return
        }

        const height = el.yogaNode.getComputedHeight() ?? 0

        let computedTop = 0
        let curr = el
        while (curr) {
            if (curr.yogaNode) {
                computedTop += curr.yogaNode.getComputedTop() ?? 0
            }
            curr = curr.parentNode
        }

        const computedBottom = computedTop + height
        const terminalRows =
            typeof process !== 'undefined' && process.stdout?.rows ? process.stdout.rows : 24

        // If completely scrolled above the screen or below the visible area
        const nextVisible = computedBottom > 0 && computedTop < terminalRows

        if (nextVisible !== isVisibleRef.current) {
            isVisibleRef.current = nextVisible
            setIsVisible(nextVisible)
        }
    })

    return [setElement, { isVisible }]
}
