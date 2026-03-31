import { openai } from '../src/config/oai'

const completion = await openai.chat.completions.create({
    model: 'openai/gpt-oss-20b:free',
    temperature: 0,
    messages: [{ role: 'user', content: 'Reply only with OK' }],
})

console.log(completion.choices[0]?.message?.content)
