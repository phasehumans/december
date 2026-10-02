import { Box, measureElement, useInput } from 'ink'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface ScrollState {
    scrollFromBottom: number
    linesBelow: number
    scrollTop: number
    maxScrollTop: number
    contentHeight: number
    viewportHeight: number
}

export interface ScrollViewportHandle {
    scrollUp: (delta?: number) => void
    scrollDown: (delta?: number) => void
    scrollToTop: () => void
    scrollToBottom: () => void
}

export interface ScrollViewportProps {
    children: React.ReactNode
    height?: number
    scrollFromBottom?: number
    onScrollChange?: (scrollFromBottom: number) => void
    onScrollStateChange?: (state: ScrollState) => void
    isGenerating?: boolean
    isActive?: boolean
    showIndicator?: boolean
}

export const ScrollViewport = React.memo(
    React.forwardRef<ScrollViewportHandle, ScrollViewportProps>(function ScrollViewport(
        {
            children,
            height: explicitHeight,
            scrollFromBottom: controlledScrollFromBottom,
            onScrollChange,
            onScrollStateChange,
            isGenerating = false,
            isActive = true,
            showIndicator = true,
        }: ScrollViewportProps,
        ref
    ) {
        const viewportRef = useRef<any>(null)
        const contentRef = useRef<any>(null)

        const defaultHeight =
            explicitHeight ??
            (typeof process !== 'undefined' && process.stdout?.rows
                ? Math.max(1, process.stdout.rows - 6)
                : 24)
        const [viewportHeight, setViewportHeight] = useState<number>(defaultHeight)
        const [contentHeight, setContentHeight] = useState<number>(0)
        const [internalScrollTop, setInternalScrollTop] = useState<number>(0)
        const [isReadingMode, setIsReadingMode] = useState<boolean>(false)

        const prevContentHeightRef = useRef<number>(0)
        const prevViewportHeightRef = useRef<number>(0)

        // Compute max scrollTop
        const maxScrollTop = Math.max(0, contentHeight - viewportHeight)

        // Directly derive scrollTop: when not in reading mode (auto-scroll), lock synchronously to maxScrollTop
        const scrollTop = isReadingMode ? Math.min(internalScrollTop, maxScrollTop) : maxScrollTop

        // State refs to eliminate stale closure bugs in useInput
        const stateRef = useRef({
            isReadingMode,
            internalScrollTop,
            maxScrollTop,
            viewportHeight,
            contentHeight,
            scrollTop,
        })
        stateRef.current = {
            isReadingMode,
            internalScrollTop,
            maxScrollTop,
            viewportHeight,
            contentHeight,
            scrollTop,
        }

        // Measure viewport and content dimensions
        useLayoutEffect(() => {
            let vHeight = explicitHeight ?? viewportHeight
            if (viewportRef.current) {
                const vMeasured = measureElement(viewportRef.current)
                if (vMeasured.height > 0) {
                    vHeight = vMeasured.height
                }
            }
            if (vHeight !== prevViewportHeightRef.current) {
                prevViewportHeightRef.current = vHeight
                setViewportHeight(vHeight)
            }

            if (contentRef.current) {
                const cMeasured = measureElement(contentRef.current)
                if (cMeasured.height !== prevContentHeightRef.current) {
                    prevContentHeightRef.current = cMeasured.height
                    setContentHeight(cMeasured.height)
                }
            }
        })

        // If controlled prop is provided and changed externally
        useEffect(() => {
            if (controlledScrollFromBottom !== undefined) {
                if (controlledScrollFromBottom === 0) {
                    setIsReadingMode(false)
                } else {
                    setIsReadingMode(true)
                    setInternalScrollTop(Math.max(0, maxScrollTop - controlledScrollFromBottom))
                }
            }
        }, [controlledScrollFromBottom, maxScrollTop])

        const notifyStateChange = useCallback(
            (newScrollTop: number) => {
                const currentMax = stateRef.current.maxScrollTop
                const newLinesBelow = Math.max(0, currentMax - newScrollTop)
                onScrollChange?.(newLinesBelow)
                onScrollStateChange?.({
                    scrollFromBottom: newLinesBelow,
                    linesBelow: newLinesBelow,
                    scrollTop: newScrollTop,
                    maxScrollTop: currentMax,
                    contentHeight: stateRef.current.contentHeight,
                    viewportHeight: stateRef.current.viewportHeight,
                })
            },
            [onScrollChange, onScrollStateChange]
        )

        const handleScrollUp = useCallback(
            (delta: number) => {
                const currentMax = stateRef.current.maxScrollTop
                const currentTop = stateRef.current.isReadingMode
                    ? Math.min(stateRef.current.internalScrollTop, currentMax)
                    : currentMax
                const newTop = Math.max(0, currentTop - delta)
                setIsReadingMode(newTop < currentMax)
                setInternalScrollTop(newTop)
                stateRef.current.isReadingMode = newTop < currentMax
                stateRef.current.internalScrollTop = newTop
                notifyStateChange(newTop)
            },
            [notifyStateChange]
        )

        const handleScrollDown = useCallback(
            (delta: number) => {
                const currentMax = stateRef.current.maxScrollTop
                const currentTop = stateRef.current.isReadingMode
                    ? Math.min(stateRef.current.internalScrollTop, currentMax)
                    : currentMax
                const newTop = Math.min(currentMax, currentTop + delta)
                if (newTop >= currentMax) {
                    setIsReadingMode(false)
                    setInternalScrollTop(currentMax)
                    stateRef.current.isReadingMode = false
                    stateRef.current.internalScrollTop = currentMax
                    notifyStateChange(currentMax)
                } else {
                    setInternalScrollTop(newTop)
                    stateRef.current.internalScrollTop = newTop
                    notifyStateChange(newTop)
                }
            },
            [notifyStateChange]
        )

        const handleScrollToTop = useCallback(() => {
            const currentMax = stateRef.current.maxScrollTop
            setIsReadingMode(currentMax > 0)
            setInternalScrollTop(0)
            stateRef.current.isReadingMode = currentMax > 0
            stateRef.current.internalScrollTop = 0
            notifyStateChange(0)
        }, [notifyStateChange])

        const handleScrollToBottom = useCallback(() => {
            const currentMax = stateRef.current.maxScrollTop
            setIsReadingMode(false)
            setInternalScrollTop(currentMax)
            stateRef.current.isReadingMode = false
            stateRef.current.internalScrollTop = currentMax
            notifyStateChange(currentMax)
        }, [notifyStateChange])

        React.useImperativeHandle(
            ref,
            () => ({
                scrollUp: (delta = 1) => handleScrollUp(delta),
                scrollDown: (delta = 1) => handleScrollDown(delta),
                scrollToTop: handleScrollToTop,
                scrollToBottom: handleScrollToBottom,
            }),
            [handleScrollUp, handleScrollDown, handleScrollToTop, handleScrollToBottom]
        )

        useInput(
            (input, key) => {
                if (!isActive) return

                // Mouse Wheel Up: \x1b[<64;...M or [<64;...M (including modifier flags: 68, 72, 80, 84)
                if (/\[<(?:64|68|72|80|84);/.test(input)) {
                    handleScrollUp(3)
                    return
                }

                // Mouse Wheel Down: \x1b[<65;...M or [<65;...M (including modifier flags: 69, 73, 81, 85)
                if (/\[<(?:65|69|73|81|85);/.test(input)) {
                    handleScrollDown(3)
                    return
                }

                // Keyboard navigation
                const pageSize = Math.max(1, stateRef.current.viewportHeight - 2)

                if (key.pageUp) {
                    handleScrollUp(pageSize)
                    return
                }

                if (key.pageDown) {
                    handleScrollDown(pageSize)
                    return
                }

                if (key.home) {
                    handleScrollToTop()
                    return
                }

                if (key.end) {
                    handleScrollToBottom()
                    return
                }

                // Shift+Up and Shift+Down
                if (key.shift && key.upArrow) {
                    handleScrollUp(1)
                    return
                }

                if (key.shift && key.downArrow) {
                    handleScrollDown(1)
                    return
                }

                // Escape returns to bottom if in reading mode
                if (
                    key.escape &&
                    (stateRef.current.isReadingMode ||
                        (controlledScrollFromBottom !== undefined &&
                            controlledScrollFromBottom > 0))
                ) {
                    handleScrollToBottom()
                    return
                }
            },
            { isActive }
        )

        return (
            <Box
                ref={viewportRef}
                height={explicitHeight}
                flexGrow={1}
                flexShrink={1}
                minHeight={0}
                overflowY="hidden"
                flexDirection="column"
                width="100%"
            >
                <Box flexShrink={0} marginTop={-scrollTop} flexDirection="column" width="100%">
                    <Box ref={contentRef} flexShrink={0} flexDirection="column" width="100%">
                        {children}
                    </Box>
                </Box>
            </Box>
        )
    })
)
