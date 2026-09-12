/**
 * Skeleton Preview Mode
 *
 * Setting FORCE_SKELETON_PREVIEW to true (or passing ?skeleton in the URL,
 * or setting localStorage.getItem('preview_skeleton') === 'true')
 * forces loading skeleton screens active across the website for visual design
 * inspection and UI auditing.
 *
 * To undo: Set FORCE_SKELETON_PREVIEW = false (or remove ?skeleton from the URL).
 */
export const FORCE_SKELETON_PREVIEW = true

let previewOverride: boolean | null = null

export const setSkeletonPreview = (active: boolean | null) => {
    previewOverride = active
}

export const isSkeletonPreviewActive = (): boolean => {
    if (previewOverride !== null) return previewOverride

    // In automated unit test environments, allow standard tests to test live data
    // unless explicitly overridden with setSkeletonPreview(true) or ?skeleton param
    if (
        typeof process !== 'undefined' &&
        process.env &&
        process.env.NODE_ENV === 'test' &&
        !(
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location?.search || '').has('skeleton')
        )
    ) {
        return false
    }

    if (FORCE_SKELETON_PREVIEW) return true

    if (typeof window !== 'undefined') {
        try {
            if (new URLSearchParams(window.location.search).has('skeleton')) {
                return true
            }
            if (window.localStorage?.getItem('preview_skeleton') === 'true') {
                return true
            }
        } catch {
            // Intentionally swallowed: window / storage access fallback
        }
    }
    return false
}
