type FuzzyMatch = {
    score: number
    /** indexes of matched characters in the text, for highlighting */
    indexes: number[]
}

const isWordStart = (text: string, index: number) =>
    index === 0 || /[^a-z0-9]/i.test(text[index - 1])

/**
 * Scores `text` against `query`. A substring match always beats a
 * skipped-letter match, and a match at a word start beats one mid-word.
 * Returns null when the letters of the query do not appear in order.
 */
export const fuzzyMatch = (query: string, text: string): FuzzyMatch | null => {
    const q = query.trim().toLowerCase()
    const t = text.toLowerCase()
    if (!q) return { score: 1, indexes: [] }

    const at = t.indexOf(q)
    if (at >= 0) {
        const indexes = Array.from({ length: q.length }, (_, i) => at + i)
        return {
            score: 300 - Math.min(at, 100) + (isWordStart(t, at) ? 60 : 0) + (at === 0 ? 30 : 0),
            indexes,
        }
    }

    const letters = q.replace(/\s+/g, '')
    const indexes: number[] = []
    let next = 0
    for (let i = 0; i < t.length && next < letters.length; i++) {
        if (t[i] === letters[next]) {
            indexes.push(i)
            next++
        }
    }
    if (next < letters.length) return null

    const spread = indexes[indexes.length - 1] - indexes[0]
    // letters picked from mid-word or spread across a long title are noise, not a match
    if (!isWordStart(t, indexes[0]) || spread > letters.length * 2 + 1) return null

    const wordStarts = indexes.filter((i) => isWordStart(t, i)).length
    return { score: 150 - spread + wordStarts * 5, indexes }
}

/**
 * Best score for an item: a label match, else a weaker keyword match.
 * Keyword matches carry no highlight indexes.
 */
export const scoreItem = (
    query: string,
    label: string,
    keywords: string[] = []
): FuzzyMatch | null => {
    const labelMatch = fuzzyMatch(query, label)
    if (labelMatch) return labelMatch

    let best = -1
    for (const keyword of keywords) {
        const match = fuzzyMatch(query, keyword)
        // only substring keyword matches count, skipped letters in keywords are too loose
        if (match && match.score > 200) best = Math.max(best, match.score - 120)
    }
    return best > 0 ? { score: best, indexes: [] } : null
}
