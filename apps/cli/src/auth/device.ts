export async function loginViaDeviceCode(
    baseUrl: string = 'http://localhost:4000',
    onCodeGenerated: (userCode: string, verificationUri: string) => void
): Promise<{ token: string; email: string | null }> {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Generate Code
            const genRes = await fetch(`${baseUrl}/api/v1/auth/device/code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!genRes.ok) {
                throw new Error('Failed to generate device code')
            }

            const genData = await genRes.json()
            if (!genData.success) {
                throw new Error(genData.message || 'Failed to generate device code')
            }

            const { deviceCode, userCode, verificationUri, expiresIn, interval } = genData.data

            onCodeGenerated(userCode, verificationUri)

            // 2. Poll for token
            const startTime = Date.now()
            const pollInterval = interval * 1000 || 5000

            const poll = async () => {
                if (Date.now() - startTime > expiresIn * 1000) {
                    reject(new Error('Device code expired'))
                    return
                }

                try {
                    const tokenRes = await fetch(`${baseUrl}/api/v1/auth/device/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceCode }),
                    })

                    const tokenData = await tokenRes.json()

                    if (tokenRes.ok && tokenData.success) {
                        resolve({
                            token: tokenData.data.token,
                            email: tokenData.data.email,
                        })
                        return
                    }

                    // If not ok, check if it's authorization_pending
                    if (tokenData.message === 'authorization_pending') {
                        setTimeout(poll, pollInterval)
                    } else {
                        reject(new Error(tokenData.message || 'Polling failed'))
                    }
                } catch (err) {
                    // Network errors during polling, just keep trying
                    setTimeout(poll, pollInterval)
                }
            }

            setTimeout(poll, pollInterval)
        } catch (err) {
            reject(err)
        }
    })
}
