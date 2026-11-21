// Centralized theme tokens for December TUI
// All components must consume these tokens instead of hardcoded hex or named color strings.

export const THEME = {
    colors: {
        brand: '#89B4F8',
        /** Hex, not the named 'white', so text looks the same in every terminal theme */
        text: '#E4E4E7',
        muted: '#A1A1AA',
        /** Meta text: durations, counts, hints */
        dim: '#71717A',
        /** Dividers and rules */
        border: '#3F3F46',
        /** Filled bands: the user prompt row, the scroll pill */
        surface: '#262629',
        /** Only for the shimmer on the activity line */
        highlight: '#FFFFFF',
        success: '#6EE7B7',
        error: '#F87171',
        warning: '#FDD663',
        diffAddBg: '#0F2419',
        diffDeleteBg: '#2C1214',
        codespanBg: '#303030',
    },
    padding: {
        paddingX: 2,
        paddingLeft: 2,
        paddingRight: 4,
    },
    glyphs: {
        prompt: '❭',
        selector: '❭',
        bullet: '•',
        status: '●',
        /** One finished or running step. Color carries the state: dim done, red failed, accent live. */
        step: '●',
        /** One result line under a step */
        result: '└',
    },
} as const

export const COLORS = {
    ...THEME.colors,
    primary: THEME.colors.text,
    info: THEME.colors.muted,
} as const

export type Theme = typeof THEME
export type Colors = typeof COLORS
