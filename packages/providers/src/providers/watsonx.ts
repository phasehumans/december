import { openaiProvider } from './openai.ts'

import type { LLMProvider } from '../types.ts'

/**
 * IBM watsonx.ai (#619). Chat goes to the openai-compatible `/ml/v1/chat/completions`, which needs
 * an IAM bearer token (exchanged from the IBM Cloud API key) and a `project_id` in the body.
 * The plain `/v1` base december used before answers 404 for every request.
 */
export const WATSONX_DEFAULT_BASE_URL = 'https://us-south.ml.cloud.ibm.com/ml/v1'
export const IBM_IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token'

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * watsonx needs two values but the key field holds one, so it takes `API_KEY:PROJECT_ID`.
 * IBM API keys never contain `:`, and project ids are uuids. WATSONX_PROJECT_ID is the fallback.
 */
export function parseWatsonxCredential(input?: string): { apiKey?: string; projectId?: string } {
    const raw = (input || '').trim()
    const cut = raw.lastIndexOf(':')
    if (cut > 0 && PROJECT_ID.test(raw.slice(cut + 1))) {
        return { apiKey: raw.slice(0, cut), projectId: raw.slice(cut + 1) }
    }
    return { apiKey: raw || undefined, projectId: process.env.WATSONX_PROJECT_ID || undefined }
}

export interface IbmToken {
    token: string
    expiresAt: number
}

/** trades an IBM Cloud API key for an IAM access token (about one hour) */
export async function exchangeIbmApiKey(
    apiKey: string,
    fetchFn: typeof fetch = fetch
): Promise<IbmToken> {
    const res = await fetchFn(IBM_IAM_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
            apikey: apiKey,
        }).toString(),
        signal: AbortSignal.timeout(15000),
    })
    const body: any = await res.json().catch(() => ({}))
    if (!res.ok || typeof body.access_token !== 'string') {
        // IAM answers a bad key with 400 BXNIM0415E; report it as the 401 it means
        const badKey = body.errorCode === 'BXNIM0415E' || res.status === 400
        throw Object.assign(
            new Error(
                `${badKey ? 401 : res.status} IBM Cloud IAM: ${body.errorMessage || 'token exchange failed'}`
            ),
            { status: badKey ? 401 : res.status, code: badKey ? 'invalid_api_key' : undefined }
        )
    }
    const expiresAt =
        typeof body.expiration === 'number'
            ? body.expiration * 1000
            : Date.now() + (Number(body.expires_in) || 3600) * 1000
    return { token: body.access_token, expiresAt }
}

export function watsonxProvider(
    credential?: string,
    baseURL?: string,
    fetchFn: typeof fetch = fetch,
    /** the openai-compatible client watsonx chat runs on; tests pass a stub */
    makeChat: (baseURL: string, token: string) => LLMProvider = (b, t) => openaiProvider(b, t)
): LLMProvider {
    const { apiKey, projectId } = parseWatsonxCredential(
        credential || process.env.WATSONX_AI_APIKEY
    )
    const base = (baseURL || WATSONX_DEFAULT_BASE_URL).replace(/\/+$/, '')
    let cached: IbmToken | undefined

    const getToken = async (): Promise<string> => {
        if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token
        if (!apiKey) {
            throw Object.assign(new Error('401 watsonx needs an IBM Cloud API key.'), {
                status: 401,
            })
        }
        cached = await exchangeIbmApiKey(apiKey, fetchFn)
        return cached.token
    }

    return {
        id: 'watsonx',
        async *stream(messages, tools, systemPrompt, modelOptions, signal) {
            if (!projectId) {
                throw Object.assign(
                    new Error(
                        '400 watsonx needs a project id. Enter the key as API_KEY:PROJECT_ID, or set WATSONX_PROJECT_ID.'
                    ),
                    { status: 400, code: 'missing_project_id' }
                )
            }
            const token = await getToken()
            const inner = makeChat(base, token)
            yield* inner.stream(
                messages,
                tools,
                systemPrompt,
                {
                    ...modelOptions,
                    extraBody: { ...modelOptions?.extraBody, project_id: projectId },
                },
                signal
            )
        },
    }
}
