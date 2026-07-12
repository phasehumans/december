import fs from 'fs'
import { GoogleGenAI } from '@google/genai'
async function run() {
    const config = JSON.parse(
        fs.readFileSync(process.env.HOME + '/.config/december/config.json', 'utf-8')
    )
    const ai = new GoogleGenAI({ apiKey: config.providers.google || config.providers.gemini })
    try {
        const largeString = 'a'.repeat(10 * 1024 * 1024) // 10MB
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: largeString }] }],
        })
        for await (const chunk of responseStream) {
        }
    } catch (e: any) {
        console.log('JSON.stringify(e):', JSON.stringify(e))
        console.log('String(e):', String(e))
        console.log('Object.keys(e):', Object.keys(e))
    }
}
run()
