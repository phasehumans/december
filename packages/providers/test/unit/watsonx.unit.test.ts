import { afterEach, describe, expect, it } from 'bun:test'

import {
    exchangeIbmApiKey,
    parseWatsonxCredential,
    watsonxProvider,
} from '../../src/providers/watsonx'

const PROJECT = '0f8fad5b-d9cb-469f-a165-70867728950e'
afterEach(() => {
    delete process.env.WATSONX_PROJECT_ID
})

describe('watsonx (#619)', () => {
    it('reads API_KEY:PROJECT_ID from the one key field, with an env fallback', () => {
        expect(parseWatsonxCredential(`ibm-key:${PROJECT}`)).toEqual({
            apiKey: 'ibm-key',
            projectId: PROJECT,
        })
        process.env.WATSONX_PROJECT_ID = PROJECT
        expect(parseWatsonxCredential('ibm-key')).toEqual({ apiKey: 'ibm-key', projectId: PROJECT })
    })

    it('reports a key ibm iam does not know as a 401 bad key', async () => {
        const fetchFn = (async () =>
            new Response(
                JSON.stringify({
                    errorCode: 'BXNIM0415E',
                    errorMessage: 'Provided API key could not be found.',
                }),
                {
                    status: 400,
                }
            )) as any
        const err: any = await exchangeIbmApiKey('bad', fetchFn).catch((e) => e)
        expect(err.status).toBe(401)
        expect(err.code).toBe('invalid_api_key')
    })

    it('asks for the project id before calling ibm', async () => {
        const provider = watsonxProvider('ibm-key')
        const err: any = await (async () => {
            for await (const _ of provider.stream([{ role: 'user', content: 'hi' }])) {
                // no chunks expected
            }
        })().catch((e) => e)
        expect(err.status).toBe(400)
        expect(err.message).toContain('API_KEY:PROJECT_ID')
    })

    it('exchanges the key once, then chats on /ml/v1 with the iam token and project_id', async () => {
        let iamCalls = 0
        const iamFetch = (async () => {
            iamCalls++
            return new Response(
                JSON.stringify({ access_token: 'iam-token', expiration: Date.now() / 1000 + 3600 }),
                { status: 200 }
            )
        }) as any
        const chats: { base: string; token: string; options: any }[] = []
        const makeChat = (base: string, token: string) => ({
            id: 'openai',
            async *stream(_m: any, _t: any, _s: any, options: any) {
                chats.push({ base, token, options })
                yield { type: 'text' as const, text: 'hi' }
            },
        })

        const provider = watsonxProvider(`ibm-key:${PROJECT}`, undefined, iamFetch, makeChat as any)
        for (let i = 0; i < 2; i++) {
            let text = ''
            for await (const chunk of provider.stream(
                [{ role: 'user', content: 'hi' }],
                undefined,
                undefined,
                {
                    model: 'ibm/granite-4',
                }
            )) {
                if (chunk.type === 'text') text += chunk.text
            }
            expect(text).toBe('hi')
        }

        expect(iamCalls).toBe(1)
        expect(chats.length).toBe(2)
        expect(chats[0].base).toBe('https://us-south.ml.cloud.ibm.com/ml/v1')
        expect(chats[0].token).toBe('iam-token')
        expect(chats[0].options.extraBody.project_id).toBe(PROJECT)
        expect(chats[0].options.model).toBe('ibm/granite-4')
    })
})
