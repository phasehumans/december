// one place for the short formats the pages share

/** an amount of money with its cents: "$12.50" */
export const formatUsd = (cents: number): string => `$${(cents / 100).toFixed(2)}`

/** an amount of credits: "$5", or "$2.50" when it has cents */
export const formatCredit = (cents: number): string =>
    cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents)

/**
 * A count of tokens. Short for a menu row: "1.2M", "84k", "512". `precise` is for a page
 * of numbers (Usage): "1.23M", "84k", and the full count under ten thousand, "5,321".
 */
export const formatTokenCount = (tokens: number, options: { precise?: boolean } = {}): string => {
    const { precise = false } = options
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(precise ? 2 : 1)}M`
    if (tokens >= (precise ? 10_000 : 1_000)) return `${Math.round(tokens / 1_000)}k`
    return precise ? tokens.toLocaleString() : String(tokens)
}
