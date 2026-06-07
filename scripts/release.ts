import { $ } from 'bun'

const version = process.argv[2]

if (!version) {
    console.error('Usage: bun run release <version>')
    process.exit(1)
}

console.log(`Releasing v${version}...`)

await $`git-cliff -o CHANGELOG.md`

await $`git add CHANGELOG.md`
await $`git commit -m ${`chore(release): v${version}`}`

await $`git tag -a ${`v${version}`} -m ${`December v${version}`}`

await $`git push origin main`
await $`git push origin ${`v${version}`}`

console.log(`Released v${version}`)
