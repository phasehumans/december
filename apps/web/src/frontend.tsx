/**
 * this file is the entry point for the react app, it sets up the root
 * element and renders the app component to the dom.
 *
 * it is included in `src/index.html`.
 */
if (typeof window !== 'undefined') {
    ;(window as any).process = (window as any).process || { env: {} }
}

import { GoogleOAuthProvider } from '@react-oauth/google'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

import App from './App'
import { DeviceActivate } from './features/auth/components/DeviceActivate'
import { GithubCallback } from './features/auth/components/GithubCallback'
import { ReferralLanding } from './features/auth/components/ReferralLanding'
import { AppErrorBoundary } from './features/errors/components/AppErrorBoundary'
import { InviteAccept } from './features/profile/components/InviteAccept'
import { isTeamsEnabled } from './features/profile/lib/teams'
import { getGoogleClientId, getWebUrl } from './shared/config/env'
import { QueryProvider } from './shared/providers/query-provider'

const DocsRedirect: React.FC = () => {
    React.useEffect(() => {
        const landingUrl = getWebUrl()
        const target = `${landingUrl}${window.location.pathname}${window.location.search}`
        window.location.replace(target)
    }, [])
    return null
}

const ExternalRedirect: React.FC<{ targetPath: string }> = ({ targetPath }) => {
    React.useEffect(() => {
        const landingUrl = getWebUrl()
        const target = `${landingUrl}${targetPath}${window.location.search}`
        window.location.replace(target)
    }, [targetPath])
    return null
}

// older CLI builds open /device/activate; the page lives at /activate now
const DeviceActivateRedirect: React.FC = () => {
    const { search } = useLocation()
    return <Navigate to={`/activate${search}`} replace />
}

const elem = document.getElementById('root')!
const app = (
    <AppErrorBoundary>
        <BrowserRouter>
            <QueryProvider>
                <GoogleOAuthProvider clientId={getGoogleClientId()}>
                    <Routes>
                        <Route path="/activate" element={<DeviceActivate />} />
                        <Route path="/device/activate" element={<DeviceActivateRedirect />} />
                        {isTeamsEnabled() && (
                            <Route path="/invite/:token" element={<InviteAccept />} />
                        )}
                        <Route path="/github/callback" element={<GithubCallback />} />
                        <Route path="/r/:code" element={<ReferralLanding />} />
                        <Route
                            path="/pricing"
                            element={<Navigate to="/settings/billing" replace />}
                        />
                        <Route
                            path="/privacy"
                            element={<ExternalRedirect targetPath="/privacy" />}
                        />
                        <Route path="/terms" element={<ExternalRedirect targetPath="/terms" />} />
                        <Route
                            path="/settings/privacy"
                            element={<ExternalRedirect targetPath="/privacy" />}
                        />
                        <Route
                            path="/settings/terms"
                            element={<ExternalRedirect targetPath="/terms" />}
                        />
                        <Route path="/docs" element={<DocsRedirect />} />
                        <Route path="/docs/*" element={<DocsRedirect />} />
                        <Route path="*" element={<App />} />
                    </Routes>
                </GoogleOAuthProvider>
            </QueryProvider>
        </BrowserRouter>
    </AppErrorBoundary>
)

if (import.meta.hot) {
    // with hot module reloading, `import.meta.hot.data` is persisted.
    const root = (import.meta.hot.data.root ??= createRoot(elem))
    root.render(app)
} else {
    // the hot module reloading api is not available in production.
    createRoot(elem).render(app)
}
