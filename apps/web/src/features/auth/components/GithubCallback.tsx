import React, { useEffect } from 'react'

export const GithubCallback = () => {
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        if (code && window.opener) {
            window.opener.postMessage(
                { type: 'GITHUB_LOGIN_SUCCESS', code },
                window.location.origin
            )
            window.close()
        } else if (window.opener) {
            window.opener.postMessage({ type: 'GITHUB_LOGIN_FAILED' }, window.location.origin)
            window.close()
        }
    }, [])

    return (
        <div className="flex items-center justify-center h-screen bg-[#111111] text-white">
            <p>Authenticating with GitHub...</p>
        </div>
    )
}
