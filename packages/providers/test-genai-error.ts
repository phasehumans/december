import { GoogleGenAI } from '@google/genai'

async function test() {
    const ai = new GoogleGenAI({ apiKey: 'test' })
    try {
        await ai.models.generateContentStream({
            model: 'gemini-3.5-flash',
            contents: 'hello',
        })
    } catch (e) {
        console.log('TYPE:', typeof e)
        console.log('KEYS:', Object.keys(e))
        console.log('NAME:', e.name)
        console.log('MSG:', e.message)
        console.log('CONSTRUCTOR:', e.constructor?.name)
        console.log('JSON:', JSON.stringify(e))
        if (e.error) {
            console.log('INNER MSG:', e.error.message)
        }
    }
}
test()
