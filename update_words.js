const fs = require('fs')
const https = require('https')

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
                let data = ''
                res.on('data', (chunk) => (data += chunk))
                res.on('end', () => resolve(data))
            })
            .on('error', reject)
    })
}

function shuffle(array) {
    let currentIndex = array.length,
        randomIndex

    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex--

        // And swap it with the current element.
        ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
    }

    return array
}

async function run() {
    try {
        console.log('Fetching adjectives...')
        const adjData = await fetchUrl(
            'https://raw.githubusercontent.com/taikuukaits/SimpleWordlists/master/Wordlist-Adjectives-All.txt'
        )
        console.log('Fetching nouns...')
        const nounData = await fetchUrl(
            'https://raw.githubusercontent.com/taikuukaits/SimpleWordlists/master/Wordlist-Nouns-All.txt'
        )

        let adjs = adjData
            .split('\n')
            .map((w) => w.trim().toLowerCase())
            .filter((w) => /^[a-z]+$/.test(w) && w.length >= 4 && w.length <= 8)
        let nouns = nounData
            .split('\n')
            .map((w) => w.trim().toLowerCase())
            .filter((w) => /^[a-z]+$/.test(w) && w.length >= 4 && w.length <= 8)

        // Shuffle the arrays to avoid alphabetical bias
        adjs = shuffle(adjs)
        nouns = shuffle(nouns)

        // Let's get exactly 1200 words each (some more just in case)
        adjs = adjs.slice(0, 1200)
        nouns = nouns.slice(0, 1200)

        console.log(
            `Extracted ${adjs.length} adjectives and ${nouns.length} nouns after shuffling.`
        )

        const file = 'c:/Code/december/server/src/modules/auth/auth.utils.ts'
        let content = fs.readFileSync(file, 'utf8')

        // Find and replace firstWords
        content = content.replace(
            /const firstWords = \[\s*[\s\S]*?\s*\]/,
            `const firstWords = ${JSON.stringify(adjs, null, 4)}`
        )

        // Find and replace secondWords
        content = content.replace(
            /const secondWords = \[\s*[\s\S]*?\s*\]/,
            `const secondWords = ${JSON.stringify(nouns, null, 4)}`
        )

        // Small fix for formatting to avoid Prettier complaining too much
        content = content.replace(/"/g, "'")

        fs.writeFileSync(file, content)
        console.log('Successfully updated auth.utils.ts')
    } catch (e) {
        console.error(e)
    }
}

run()
