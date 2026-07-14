import fs from 'fs'

import { GoogleGenAI } from '@google/genai'
async function run() {
    const config = JSON.parse(
        fs.readFileSync(process.env.HOME + '/.config/december/config.json', 'utf-8')
    )
    const ai = new GoogleGenAI({ apiKey: config.providers.google || config.providers.gemini })
    try {
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'a'.repeat(10 * 1024 * 1024),
        })
    } catch (e: any) {
        console.log('e instanceof Error:', e instanceof Error)
    }
}
run()
