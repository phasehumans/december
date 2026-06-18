// Minimal static color palette — grey/white only, no theme switching.
// All accent colors are intentionally muted to let terminal's native colors show.

export const COLORS = {
    // Text hierarchy
    primary: 'white', // main text, prompt glyph
    dim: 'gray', // secondary text, labels
    muted: '#555555', // very quiet text

    // Semantic
    success: '#6EE7B7',
    error: '#FCA5A5',
    info: 'gray',
} as const

export type Colors = typeof COLORS
