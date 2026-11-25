import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { profileAPI } from '@/features/profile/api/profile'

/** the service worker that shows push messages (apps/web/assets/push-sw.js) */
const SERVICE_WORKER_URL = '/push-sw.js'

/**
 * 'unsupported': this browser has no push. 'unavailable': the server has no push keys.
 * 'blocked': the user blocked notifications for the site. 'on' and 'off' are for this
 * browser only: push is per device.
 */
export type BrowserPushState = 'loading' | 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on'

const isSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

const toKeyBytes = (base64url: string) => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

const currentSubscription = async () => {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)
    return (await registration?.pushManager.getSubscription()) ?? null
}

/** browser push for this device (#636): turn on asks for permission and subscribes */
export const useBrowserPush = () => {
    const queryClient = useQueryClient()
    const supported = isSupported()
    const [state, setState] = useState<BrowserPushState>(supported ? 'loading' : 'unsupported')
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { data: config } = useQuery({
        queryKey: ['notification', 'push-key'],
        queryFn: profileAPI.getPushKey,
        enabled: supported,
        staleTime: Infinity,
    })
    const publicKey = config?.publicKey

    useEffect(() => {
        if (!supported || config === undefined) return
        if (!publicKey) {
            setState('unavailable')
            return
        }
        if (Notification.permission === 'denied') {
            setState('blocked')
            return
        }
        let cancelled = false
        currentSubscription()
            .then((subscription) => {
                if (!cancelled) setState(subscription ? 'on' : 'off')
            })
            .catch((err: unknown) => {
                console.warn('[push] could not read the subscription', err)
                if (!cancelled) setState('off')
            })
        return () => {
            cancelled = true
        }
    }, [supported, config, publicKey])

    const turnOn = useCallback(async () => {
        if (!publicKey) return
        setIsPending(true)
        setError(null)
        try {
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                setState(permission === 'denied' ? 'blocked' : 'off')
                return
            }
            await navigator.serviceWorker.register(SERVICE_WORKER_URL)
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: toKeyBytes(publicKey),
            })
            await profileAPI.subscribePush(subscription.toJSON())
            setState('on')
            void queryClient.invalidateQueries({ queryKey: ['profile'] })
        } catch (err) {
            console.error('[push] could not turn push on', err)
            setError('Could not turn on push')
        } finally {
            setIsPending(false)
        }
    }, [publicKey, queryClient])

    const turnOff = useCallback(async () => {
        setIsPending(true)
        setError(null)
        try {
            const subscription = await currentSubscription()
            if (subscription) {
                await profileAPI.unsubscribePush(subscription.endpoint)
                await subscription.unsubscribe()
            }
            setState('off')
            void queryClient.invalidateQueries({ queryKey: ['profile'] })
        } catch (err) {
            console.error('[push] could not turn push off', err)
            setError('Could not turn off push')
        } finally {
            setIsPending(false)
        }
    }, [queryClient])

    return { state, isPending, error, turnOn, turnOff }
}
