/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { createRoot } from 'react-dom/client'
import App from './App'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { QueryProvider } from './shared/providers/query-provider'

const elem = document.getElementById('root')!
const app = (
    <QueryProvider>
        <GoogleOAuthProvider clientId="762203307362-qg77ln4ci9eldv3i0q1smv804epsbhk0.apps.googleusercontent.com">
            <App />
        </GoogleOAuthProvider>
    </QueryProvider>
)

if (import.meta.hot) {
    // With hot module reloading, `import.meta.hot.data` is persisted.
    const root = (import.meta.hot.data.root ??= createRoot(elem))
    root.render(app)
} else {
    // The hot module reloading API is not available in production.
    createRoot(elem).render(app)
}
