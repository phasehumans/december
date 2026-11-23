import React from 'react'

// phones: a settings page puts its main action (add a secret, add a key) in the top bar,
// the way Sessions and Pull requests do (P3). the page registers the action, the settings
// shell draws the button.

export interface SettingsTopBarAction {
    label: string
    onClick: () => void
}

export const SettingsTopBarContext = React.createContext<
    (action: SettingsTopBarAction | null) => void
>(() => {})

/** show a "+" button with this label in the phone top bar while the page is open */
export const useSettingsTopBarAction = (label: string, onClick: () => void, enabled = true) => {
    const setAction = React.useContext(SettingsTopBarContext)
    // the page's handler changes on every render. the ref keeps the registered action stable
    const onClickRef = React.useRef(onClick)
    React.useEffect(() => {
        onClickRef.current = onClick
    }, [onClick])

    React.useEffect(() => {
        if (!enabled) return
        setAction({ label, onClick: () => onClickRef.current() })
        return () => setAction(null)
    }, [label, enabled, setAction])
}
