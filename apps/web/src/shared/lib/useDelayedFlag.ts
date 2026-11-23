import { useEffect, useState } from 'react'

/**
 * true only once `flag` has stayed true for `delayMs`. use it for loaders, so quick loads
 * never blink a loading screen and slow ones still get one.
 */
export const useDelayedFlag = (flag: boolean, delayMs: number): boolean => {
    const [isLate, setIsLate] = useState(false)

    useEffect(() => {
        if (!flag) {
            setIsLate(false)
            return
        }
        const timer = setTimeout(() => setIsLate(true), delayMs)
        return () => clearTimeout(timer)
    }, [flag, delayMs])

    return flag && isLate
}
