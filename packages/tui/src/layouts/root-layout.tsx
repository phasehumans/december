import { KeyboardLayerProvider } from '../providers/keyboard-layer'
import { ToastProvider } from '../providers/toast'

import type { ReactNode } from 'react'

type Props = {
    children?: ReactNode
    onToast?: (options: any) => void
    fullscreen?: boolean
}

export function RootLayout({ children, onToast }: Props) {
    return (
        <KeyboardLayerProvider>
            <ToastProvider onToast={onToast}>{children}</ToastProvider>
        </KeyboardLayerProvider>
    )
}
