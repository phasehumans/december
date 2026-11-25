// The code of an invite link (/r/<code>, #638). It stays in this browser for 30 days, the
// next sign-up sends it, and then it is removed.

const STORAGE_KEY = 'december:referral-code'
const KEEP_MS = 30 * 24 * 60 * 60 * 1000

type StoredReferral = { code: string; savedAt: number }

/** the code as the server saves it, or null for a value that cannot be a code */
const normalize = (code: string | null | undefined): string | null => {
    if (typeof code !== 'string') return null
    const normalized = code.trim().toLowerCase()
    return /^[a-z0-9]{4,32}$/.test(normalized) ? normalized : null
}

const save = (code: string | null | undefined) => {
    const normalized = normalize(code)
    if (!normalized) return
    try {
        const stored: StoredReferral = { code: normalized, savedAt: Date.now() }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
        // Intentionally swallowed: with no storage the sign-up works, with no referral
    }
}

const clear = () => {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // Intentionally swallowed: with no storage there is nothing to remove
    }
}

const read = (): string | null => {
    try {
        const stored = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || 'null'
        ) as StoredReferral | null
        const code = normalize(stored?.code)
        if (!code || typeof stored?.savedAt !== 'number') return null
        if (Date.now() - stored.savedAt > KEEP_MS) {
            clear()
            return null
        }
        return code
    } catch {
        // Intentionally swallowed: a value that is not ours counts as no code
        return null
    }
}

export const referralCode = {
    save,
    read,
    clear,
}
