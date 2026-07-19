// minimal static color palette — grey/white only, no theme switching.
// all accent colors are intentionally muted to let terminal's native colors show.

export const COLORS = {
    // text hierarchy
    primary: 'white', // main text, prompt glyph
    dim: 'gray', // secondary text, labels
    muted: '#555555', // very quiet text

    // semantic
    success: '#6EE7B7',
    error: '#FCA5A5',
    info: 'gray',
} as const

export type Colors = typeof COLORS
