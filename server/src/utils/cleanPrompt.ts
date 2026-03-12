export const cleanPrompt = (input: string): string => {
    if (!input) {
        return ''
    }
    return input.replace(/\r\n?/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

// const sample= `    build   me   a modern     SaaS landing page

// for an AI startup	      with dark theme

//    include   pricing,    testimonials,   faq

// make it feel   premium     and smooth`
// console.log(cleanPrompt(sample))
