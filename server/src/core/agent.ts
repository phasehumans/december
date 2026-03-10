import OpenAI from 'openai'
import dotenv from 'dotenv'
dotenv.config()
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:4000',
        'X-OpenRouter-Title': 'phasehumans',
    },
})

async function main() {
    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-oss-20b:free',
        //   model: 'gpt-5.4',
        max_tokens: 500,
        messages: [
            {
                role: 'user',
                content: 'build a movie ticket booking system',
            },
        ],
    })
    console.log(completion.choices[0]!.message.content)
    console.log(completion)
}

main()

// const response = await client.responses.create({
//     model: "gpt-5.4",
//     input: "Write a one-sentence bedtime story about a unicorn.",
//     max_output_tokens: 100
// });

// console.log(response.output_text)
