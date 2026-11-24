import { useEffect, useState } from 'react'

// same width as the tailwind "md" breakpoint, where the mobile layout ends
const PHONE_QUERY = '(max-width: 767px)'

/** the phone check for code outside react (event handlers) */
export const readIsPhone = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(PHONE_QUERY).matches

/** true on phone widths, where menus open as bottom sheets */
export const useIsPhone = (): boolean => {
    const [isPhone, setIsPhone] = useState(readIsPhone)

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return
        const media = window.matchMedia(PHONE_QUERY)
        const onChange = () => setIsPhone(media.matches)
        onChange()
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [])

    return isPhone
}
