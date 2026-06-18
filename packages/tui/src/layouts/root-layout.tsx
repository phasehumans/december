import { DialogProvider } from '../providers/dialog'
import { KeyboardLayerProvider } from '../providers/keyboard-layer'
import { ThemeProvider } from '../providers/theme'
import { ToastProvider } from '../providers/toast'

import type { ReactNode } from 'react'

type Props = {
    children: ReactNode
}

export function RootLayout({ children }: Props) {
    return (
        <ThemeProvider>
            <KeyboardLayerProvider>
                <ToastProvider>
                    <DialogProvider>{children}</DialogProvider>
                </ToastProvider>
            </KeyboardLayerProvider>
        </ThemeProvider>
    )
}
