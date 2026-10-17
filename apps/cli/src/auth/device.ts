export async function loginViaDeviceCode(
    serverUrl: string = process.env.SERVER_URL || 'https://api.trydecember.com',
    onCodeGenerated: (userCode: string, verificationUri: string) => void,
    signal?: AbortSignal
): Promise<{ token: string; email: string | null }> {
    if (signal?.aborted) {
        throw new Error('Login cancelled')
    }

    try {
        const genRes = await fetch(`${serverUrl}/api/v1/auth/device/code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
        })

        let genData: any = {}
        try {
            genData = await genRes.json()
        } catch {
            // Intentionally swallowed: fallback handled if server returns non-JSON
        }

        if (!genRes.ok || !genData.success) {
            throw new Error(genData.message || `Failed to generate device code (${genRes.status})`)
        }

        const { deviceCode, userCode, verificationUri, expiresIn, interval } = genData.data

        onCodeGenerated(userCode, verificationUri)

        // 2. poll for token
        const startTime = Date.now()
        const pollInterval = interval * 1000 || 5000

        return await new Promise((resolve, reject) => {
            let timeoutId: any = null

            const onAbort = () => {
                if (timeoutId) clearTimeout(timeoutId)
                reject(new Error('Login cancelled'))
            }

            if (signal) {
                if (signal.aborted) {
                    onAbort()
                    return
                }
                signal.addEventListener('abort', onAbort, { once: true })
            }

            const poll = async () => {
                if (signal?.aborted) {
                    onAbort()
                    return
                }

                if (Date.now() - startTime > expiresIn * 1000) {
                    if (signal) signal.removeEventListener('abort', onAbort)
                    reject(new Error('Device code expired'))
                    return
                }

                try {
                    const tokenRes = await fetch(`${serverUrl}/api/v1/auth/device/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceCode }),
                        signal,
                    })

                    const tokenData = (await tokenRes.json()) as any

                    if (tokenRes.ok && tokenData.success) {
                        if (signal) signal.removeEventListener('abort', onAbort)
                        resolve({
                            token: tokenData.data.token,
                            email: tokenData.data.email,
                        })
                        return
                    }

                    // if not ok, check if it's authorization_pending
                    if (tokenData.message === 'authorization_pending') {
                        if (!signal?.aborted) {
                            timeoutId = setTimeout(poll, pollInterval)
                        }
                    } else {
                        if (signal) signal.removeEventListener('abort', onAbort)
                        reject(new Error(tokenData.message || 'Polling failed'))
                    }
                } catch (err: any) {
                    if (signal?.aborted || err?.name === 'AbortError') {
                        onAbort()
                        return
                    }
                    // network errors during polling, just keep trying
                    if (!signal?.aborted) {
                        timeoutId = setTimeout(poll, pollInterval)
                    }
                }
            }

            timeoutId = setTimeout(poll, pollInterval)
        })
    } catch (err: any) {
        if (signal?.aborted || err?.name === 'AbortError' || err?.message?.includes('cancelled')) {
            throw new Error('Login cancelled')
        }
        const msg = err?.message || String(err)
        if (
            msg.includes('fetch failed') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ENOTFOUND') ||
            msg.includes('Failed to fetch') ||
            msg.includes('connect')
        ) {
            throw new Error('Unable to connect. Is the computer able to access the url?', {
                cause: err,
            })
        } else {
            throw err
        }
    }
}
