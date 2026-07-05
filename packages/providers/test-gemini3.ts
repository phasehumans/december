import fs from 'fs'

import { GoogleGenAI } from '@google/genai'

async function run() {
    const config = JSON.parse(fs.readFileSync(process.env.HOME + '/.december/config.json', 'utf-8'))
    const ai = new GoogleGenAI({ apiKey: config.providers.google })

    // Simulate what the code was doing: spreading inside functionCall
    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: 'list dir' }] },
                {
                    role: 'model',
                    parts: [
                        {
                            functionCall: {
                                name: 'list_dir',
                                args: {},
                                thoughtSignature: 'fake_sig',
                            } as any,
                        },
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
            console.log('SUCCESS WITH thoughtSignature INSIDE functionCall?!')
            break
        }
    } catch (e: any) {
        console.error('ERROR WITH thoughtSignature INSIDE functionCall:', e.message)
    }
}
run().catch(console.error)
