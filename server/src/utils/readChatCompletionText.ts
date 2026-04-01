type CompletionTextPart =
    | string
    | {
          type?: string
          text?: string
      }

type ChatCompletionLike = {
    choices?: Array<{
        message?: {
            content?: string | CompletionTextPart[] | null
        }
    }>
}

export const readChatCompletionText = (completion: ChatCompletionLike | null | undefined) => {
    const content = completion?.choices?.[0]?.message?.content

    if (typeof content === 'string') {
        return content
    }

    if (Array.isArray(content)) {
        const text = content
            .map((part) => {
                if (typeof part === 'string') {
                    return part
                }

                return typeof part.text === 'string' ? part.text : ''
            })
            .join('')
            .trim()

        return text || null
    }

    return null
}
