import { render } from 'ink-testing-library'
import React from 'react'

import { KeyboardLayerProvider } from '../src/providers/keyboard-layer'
import { ToastProvider } from '../src/providers/toast'

export function renderWithProviders(ui: React.ReactNode) {
    return render(
        <KeyboardLayerProvider>
            <ToastProvider>{ui}</ToastProvider>
        </KeyboardLayerProvider>
    )
}
