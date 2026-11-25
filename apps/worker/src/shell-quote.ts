/** one shell argument in single quotes: every character stays as it is */
export const shellQuote = (value: string): string => `'${String(value).replace(/'/g, `'\\''`)}'`
