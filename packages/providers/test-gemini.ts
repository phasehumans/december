import fs from 'fs'

import { GoogleGenAI } from '@google/genai'

async function run() {
    const config = JSON.parse(
        fs.readFileSync(process.env.HOME + '/.config/december/config.json', 'utf-8')
    )
    const ai = new GoogleGenAI({ apiKey: config.providers.google })
    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: 'list the directory contents of the current folder using the tool',
        config: {
            tools: [
                {
                    functionDeclarations: [
                        {
                            name: 'list_dir',
                            description: 'list contents',
                            parameters: { type: 'object', properties: {} },
                        },
                    ],
                },
            ],
        },
    })
    for await (const chunk of responseStream) {
        console.log('CHUNK:', JSON.stringify(chunk, null, 2))
    }
}
run().catch(console.error)
