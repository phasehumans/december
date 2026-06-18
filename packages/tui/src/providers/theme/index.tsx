import { createContext, useContext } from 'react'

import { COLORS } from '../../theme'

import type { Colors } from '../../theme'
import type { ReactNode } from 'react'

type ThemeContextValue = {
    colors: Colors
}

const ThemeContext = createContext<ThemeContextValue>({ colors: COLORS })

export function useTheme(): ThemeContextValue {
    return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    return <ThemeContext.Provider value={{ colors: COLORS }}>{children}</ThemeContext.Provider>
}
