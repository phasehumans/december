type ApiEnvelope<T> = {
    success: boolean
    message?: string
    data: T
    errors?: unknown
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
    headers?: Record<string, string>
    includeAuth?: boolean
}

type RuntimeEnv = {
    process?: {
        env?: Record<string, string | undefined>
    }
    Bun?: {
        env?: Record<string, string | undefined>
    }
    __ENV__?: Record<string, string | undefined>
}

const resolveBaseUrl = () => {
    const runtime = globalThis as typeof globalThis & RuntimeEnv

    return (
        runtime.Bun?.env?.BASE_URL ??
        runtime.process?.env?.BASE_URL ??
        runtime.__ENV__?.BASE_URL ??
        'http://localhost:4000'
    )
}

const rawBaseUrl = resolveBaseUrl()

const normalizedBaseUrl = rawBaseUrl.endsWith('/')
    ? rawBaseUrl.slice(0, -1)
    : rawBaseUrl

export const API_BASE_URL = normalizedBaseUrl.endsWith('/api/v1')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/api/v1`

export class ApiError extends Error {
    status: number
    details?: unknown

    constructor(message: string, status: number, details?: unknown) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.details = details
    }
}

export const getAuthToken = () => {
    if (typeof window === 'undefined') {
        return null
    }

    return localStorage.getItem('token')
}

export const setAuthToken = (token: string) => {
    if (typeof window === 'undefined') {
        return
    }

    localStorage.setItem('token', token)
}

export const clearAuthToken = () => {
    if (typeof window === 'undefined') {
        return
    }

    localStorage.removeItem('token')
}

const toApiError = async (res: Response) => {
    let payload: { message?: string; errors?: unknown } | null = null

    try {
        payload = await res.json()
    } catch {
        payload = null
    }

    const message =
        payload?.message ||
        (typeof payload?.errors === 'string' ? payload.errors : undefined) ||
        `Request failed with status ${res.status}`

    return new ApiError(message, res.status, payload?.errors)
}

export const apiRequest = async <T>(path: string, options: RequestOptions = {}) => {
    const { includeAuth = true, headers, ...rest } = options
    const token = includeAuth ? getAuthToken() : null

    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: token } : {}),
            ...headers,
        },
    })

    if (!res.ok) {
        throw await toApiError(res)
    }

    const payload = (await res.json()) as ApiEnvelope<T>
    return payload.data
}
