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
        const pendingX10MouseRef = useRef<boolean>(false)

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
                if (!shouldThrottle || now - lastContentMeasureTimeRef.current >= 80) {
                    lastContentMeasureTimeRef.current = now
                    const cMeasured = measureElement(contentRef.current)
                    if (cMeasured.height !== prevContentHeightRef.current) {
                        prevContentHeightRef.current = cMeasured.height
                        setContentHeight(cMeasured.height)
                    }
                }
            }
        })

        // When generation completes, perform an immediate layout measurement to ensure height accuracy
        useEffect(() => {
            if (!isGenerating && contentRef.current) {
                const cMeasured = measureElement(contentRef.current)
                if (cMeasured.height !== prevContentHeightRef.current) {
                    prevContentHeightRef.current = cMeasured.height
                    setContentHeight(cMeasured.height)
                }
            }
        }, [isGenerating])

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

                // X10 mouse reporting split sequence handling
                if (pendingX10MouseRef.current) {
                    pendingX10MouseRef.current = false
                    if (input.startsWith('`') || input.startsWith('@')) {
                        handleScrollUp(3)
                        return
                    }
                    if (input.startsWith('a')) {
                        handleScrollDown(3)
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
                    handleScrollUp(3 * upCount)
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
                    handleScrollDown(3 * downCount)
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
