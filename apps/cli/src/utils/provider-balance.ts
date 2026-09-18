export interface ProviderBalanceInfo {
    supported: boolean
    balance?: string
    currency?: string
    error?: string
}

export async function fetchProviderBalance(
    provider?: string,
    apiKey?: string,
    timeoutMs = 2000
): Promise<ProviderBalanceInfo> {
    const p = (provider || '').toLowerCase().trim()
    const key = (apiKey || '').trim()

    if (!p || !key) {
        return { supported: false }
    }

    const signal = AbortSignal.timeout(timeoutMs)

    switch (p) {
        case 'openrouter': {
            try {
                const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
                    headers: {
                        Authorization: `Bearer ${key}`,
                        Accept: 'application/json',
                    },
                    signal,
                })
                if (!res.ok) {
                    return { supported: true, error: `OpenRouter returned HTTP ${res.status}` }
                }
                const json = (await res.json()) as any
                const data = json?.data
                if (!data) {
                    return { supported: true, error: 'Malformed response from OpenRouter' }
                }

                if (data.limit !== null && data.limit !== undefined) {
                    const remaining = Math.max(0, data.limit - (data.usage || 0))
                    return {
                        supported: true,
                        balance: `$${remaining.toFixed(2)}`,
                        currency: 'USD',
                    }
                }

                return {
                    supported: true,
                    balance: `$${(data.usage || 0).toFixed(2)} used (unlimited)`,
                    currency: 'USD',
                }
            } catch (err: any) {
                // Intentionally swallowed: network failure or timeout during balance check
                return {
                    supported: true,
                    error: err?.message || 'Could not fetch balance (request timed out or failed)',
                }
            }
        }

        case 'deepseek': {
            try {
                const res = await fetch('https://api.deepseek.com/user/balance', {
                    headers: {
                        Authorization: `Bearer ${key}`,
                        Accept: 'application/json',
                    },
                    signal,
                })
                if (!res.ok) {
                    return { supported: true, error: `DeepSeek returned HTTP ${res.status}` }
                }
                const json = (await res.json()) as any
                const info = json?.balance_infos?.[0]
                if (!info) {
                    return { supported: true, error: 'Malformed response from DeepSeek' }
                }

                const total = parseFloat(info.total_balance ?? '0')
                const curr = info.currency || 'CNY'
                return {
                    supported: true,
                    balance: `${total.toFixed(2)} ${curr}`,
                    currency: curr,
                }
            } catch (err: any) {
                // Intentionally swallowed: network failure or timeout during balance check
                return {
                    supported: true,
                    error: err?.message || 'Could not fetch balance (request timed out or failed)',
                }
            }
        }

        case 'siliconflow':
        case 'siliconcloud': {
            try {
                const res = await fetch('https://api.siliconflow.com/v1/user/info', {
                    headers: {
                        Authorization: `Bearer ${key}`,
                        Accept: 'application/json',
                    },
                    signal,
                })
                if (!res.ok) {
                    return { supported: true, error: `SiliconFlow returned HTTP ${res.status}` }
                }
                const json = (await res.json()) as any
                const balanceVal = json?.data?.totalBalance || json?.data?.balance
                if (balanceVal === undefined) {
                    return { supported: true, error: 'Malformed response from SiliconFlow' }
                }

                return {
                    supported: true,
                    balance: `${balanceVal} CNY`,
                    currency: 'CNY',
                }
            } catch (err: any) {
                // Intentionally swallowed: network failure or timeout during balance check
                return {
                    supported: true,
                    error: err?.message || 'Could not fetch balance (request timed out or failed)',
                }
            }
        }

        case 'moonshot':
        case 'moonshotai':
        case 'kimi': {
            try {
                const res = await fetch('https://api.moonshot.ai/v1/users/me/balance', {
                    headers: {
                        Authorization: `Bearer ${key}`,
                        Accept: 'application/json',
                    },
                    signal,
                })
                if (!res.ok) {
                    return { supported: true, error: `Moonshot returned HTTP ${res.status}` }
                }
                const json = (await res.json()) as any
                const data = json?.data
                const bal = data?.available_balance ?? data?.cash_balance
                if (bal === undefined) {
                    return { supported: true, error: 'Malformed response from Moonshot' }
                }

                return {
                    supported: true,
                    balance: `${bal} CNY`,
                    currency: 'CNY',
                }
            } catch (err: any) {
                // Intentionally swallowed: network failure or timeout during balance check
                return {
                    supported: true,
                    error: err?.message || 'Could not fetch balance (request timed out or failed)',
                }
            }
        }

        default:
            return { supported: false }
    }
}
