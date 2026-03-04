/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { createRoot } from 'react-dom/client'
import App from './App'
import { GoogleOAuthProvider } from '@react-oauth/google'

if (!import.meta.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is missing")
}

const elem = document.getElementById('root')!
const app = (
    <GoogleOAuthProvider clientId={import.meta.env.GOOGLE_CLIENT_ID}>
        <App />
    </GoogleOAuthProvider>
)

if (import.meta.hot) {
    // With hot module reloading, `import.meta.hot.data` is persisted.
    const root = (import.meta.hot.data.root ??= createRoot(elem))
    root.render(app)
} else {
    // The hot module reloading API is not available in production.
    createRoot(elem).render(app)
}
