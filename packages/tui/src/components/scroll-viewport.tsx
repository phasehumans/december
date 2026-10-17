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
    onCopy?: () => void
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
            onCopy,
        }: ScrollViewportProps,
        ref
    ) {
        const viewportRef = useRef<any>(null)
        const contentRef = useRef<any>(null)
        const isDraggingRef = useRef<boolean>(false)

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
        const justEnteredReadingModeRef = useRef<boolean>(false)

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

        const lastContentMeasureTimeRef = useRef<number>(0)
        const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
        const pendingX10MouseRef = useRef<boolean>(false)

        const applyContentHeight = useCallback((newHeight: number) => {
            const prevHeight = prevContentHeightRef.current
            const heightDiff = newHeight - prevHeight
            prevContentHeightRef.current = newHeight
            setContentHeight(newHeight)

            if (justEnteredReadingModeRef.current) {
                justEnteredReadingModeRef.current = false
                if (heightDiff > 0 && prevHeight > 0) {
                    const adjustedTop = stateRef.current.internalScrollTop + heightDiff
                    setInternalScrollTop(adjustedTop)
                    stateRef.current.internalScrollTop = adjustedTop
                }
            }
        }, [])

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
                // When actively generating and auto-following at the bottom,
                // throttle synchronous layout measurement to avoid blocking the event loop on rapid token chunks
                const now = Date.now()
                const shouldThrottle = isGenerating && !isReadingMode
                const elapsed = now - lastContentMeasureTimeRef.current

                if (!shouldThrottle || elapsed >= 80) {
                    if (throttleTimerRef.current) {
                        clearTimeout(throttleTimerRef.current)
                        throttleTimerRef.current = null
                    }
                    lastContentMeasureTimeRef.current = now
                    const cMeasured = measureElement(contentRef.current)
                    applyContentHeight(cMeasured.height)
                } else if (!throttleTimerRef.current) {
                    // Schedule a trailing measurement so layout is never left stale if streaming pauses
                    throttleTimerRef.current = setTimeout(
                        () => {
                            throttleTimerRef.current = null
                            if (contentRef.current) {
                                lastContentMeasureTimeRef.current = Date.now()
                                const cMeasured = measureElement(contentRef.current)
                                applyContentHeight(cMeasured.height)
                            }
                        },
                        Math.max(10, 80 - elapsed)
                    )
                }
            }
        })

        // Immediate unthrottled layout measurement whenever generation starts or completes
        useEffect(() => {
            if (contentRef.current) {
                if (throttleTimerRef.current) {
                    clearTimeout(throttleTimerRef.current)
                    throttleTimerRef.current = null
                }
                lastContentMeasureTimeRef.current = Date.now()
                const cMeasured = measureElement(contentRef.current)
                applyContentHeight(cMeasured.height)
            }
        }, [isGenerating, applyContentHeight])

        // Cleanup trailing measurement timer on unmount
        useEffect(() => {
            return () => {
                if (throttleTimerRef.current) {
                    clearTimeout(throttleTimerRef.current)
                    throttleTimerRef.current = null
                }
            }
        }, [])

        // If controlled prop is provided and changed externally
        useEffect(() => {
            if (controlledScrollFromBottom !== undefined) {
                if (controlledScrollFromBottom === 0) {
                    justEnteredReadingModeRef.current = false
                    setIsReadingMode(false)
                } else {
                    if (!stateRef.current.isReadingMode) {
                        justEnteredReadingModeRef.current = true
                    }
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
                const willBeReading = newTop < currentMax
                if (!stateRef.current.isReadingMode && willBeReading) {
                    justEnteredReadingModeRef.current = true
                }
                setIsReadingMode(willBeReading)
                setInternalScrollTop(newTop)
                stateRef.current.isReadingMode = willBeReading
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
                    justEnteredReadingModeRef.current = false
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
            justEnteredReadingModeRef.current = false
            setIsReadingMode(currentMax > 0)
            setInternalScrollTop(0)
            stateRef.current.isReadingMode = currentMax > 0
            stateRef.current.internalScrollTop = 0
            notifyStateChange(0)
        }, [notifyStateChange])

        const handleScrollToBottom = useCallback(() => {
            const currentMax = stateRef.current.maxScrollTop
            justEnteredReadingModeRef.current = false
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

                // X10 mouse reporting split sequence handling
                if (pendingX10MouseRef.current) {
                    pendingX10MouseRef.current = false
                    if (input.startsWith('`') || input.startsWith('@')) {
                        handleScrollUp(2)
                        return
                    }
                    if (input.startsWith('a')) {
                        handleScrollDown(2)
                        return
                    }
                }

                if (input === '[M' || input === '\x1b[M') {
                    pendingX10MouseRef.current = true
                    return
                }

                // Mouse Wheel Up: SGR (\x1b[<64...M), X10 (\x1b[M` / \x1b[M@), rxvt (\x1b[64~)
                if (
                    /\[<(?:64|68|72|80|84);/.test(input) ||
                    /\[M[`@]/.test(input) ||
                    /\[64~/.test(input)
                ) {
                    const upCount = Math.max(
                        1,
                        (input.match(/\[<(?:64|68|72|80|84);/g) || []).length +
                            (input.match(/\[M[`@]/g) || []).length +
                            (input.match(/\[64~/g) || []).length
                    )
                    const delta = Math.min(5, upCount > 1 ? 1 + upCount : 2)
                    handleScrollUp(delta)
                    return
                }

                // Mouse Wheel Down: SGR (\x1b[<65...M), X10 (\x1b[Ma), rxvt (\x1b[65~)
                if (
                    /\[<(?:65|69|73|81|85);/.test(input) ||
                    /\[Ma/.test(input) ||
                    /\[65~/.test(input)
                ) {
                    const downCount = Math.max(
                        1,
                        (input.match(/\[<(?:65|69|73|81|85);/g) || []).length +
                            (input.match(/\[Ma/g) || []).length +
                            (input.match(/\[65~/g) || []).length
                    )
                    const delta = Math.min(5, downCount > 1 ? 1 + downCount : 2)
                    handleScrollDown(delta)
                    return
                }

                // Mouse Drag / Selection tracking (SGR \x1b[<32;...M or left click \x1b[<0;...M)
                if (/\[<32;\d+;\d+;M/.test(input)) {
                    isDraggingRef.current = true
                    return
                }

                // Mouse Release tracking (SGR \x1b[<0;...m or \x1b[<32;...m) for auto-copy on select
                if (/\[<(?:0|32);\d+;\d+;m/.test(input)) {
                    if (isDraggingRef.current) {
                        isDraggingRef.current = false
                        onCopy?.()
                    }
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

                // Ctrl+Up and Ctrl+Down
                if (key.ctrl && key.upArrow) {
                    handleScrollUp(3)
                    return
                }

                if (key.ctrl && key.downArrow) {
                    handleScrollDown(3)
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
