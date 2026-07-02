import { GoogleGenAI } from '@google/genai'
import fs from 'fs'

async function run() {
    const config = JSON.parse(fs.readFileSync(process.env.HOME + '/.december/config.json', 'utf-8'))
    const ai = new GoogleGenAI({ apiKey: config.providers.google })

    // First, let's just try sending a history where thought_signature is inside functionCall vs outside
    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: 'list dir' }] },
                {
                    role: 'model',
                    parts: [
                        {
                            functionCall: { name: 'list_dir', args: {} },
                            thoughtSignature: 'fake_sig',
                        } as any,
                    ],
                },
                {
                    role: 'user',
                    parts: [{ functionResponse: { name: 'list_dir', response: { result: 'ok' } } }],
                },
            ],
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
            console.log('SUCCESS WITH thoughtSignature AT PART LEVEL')
            break
        }
    } catch (e: any) {
        console.error('ERROR WITH thoughtSignature AT PART LEVEL:', e.message)
    }
}
run().catch(console.error)
