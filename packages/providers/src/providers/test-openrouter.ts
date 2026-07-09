import { OpenRouterProvider } from './openrouter.ts'
async function test() {
    const ai = new OpenRouterProvider({ apiKey: 'test' })
    try {
        const gen = ai.stream(
            [{ role: 'user', content: 'hello' }],
            [],
            'sys',
            { model: 'gemini-3.1-pro-high' },
            new AbortController().signal
        )
        for await (const chunk of gen) {
        }
    } catch (e) {
        console.log('TYPE:', typeof e)
        console.log('NAME:', (e as any).name)
        console.log('MSG:', (e as any).message)
        console.log('JSON:', JSON.stringify(e))
        if (e && typeof e === 'object' && 'error' in e) {
            console.log('INNER ERROR:', (e as any).error)
        }
    }
}
test()
