import { cleanPrompt } from '../../utils/cleanPrompt'

type generateWebsite = {
    prompt: string
    userId: string
}

const generateWebsite = (data: generateWebsite) => {
    const { prompt, userId } = data

    const cprompt = cleanPrompt(prompt)
    console.log(cprompt)
}

export const generateService = {
    generateWebsite,
}
