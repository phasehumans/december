import { $ } from 'bun'

const version = process.argv[2]

if (!version) {
    console.error('Usage: bun run release <version>')
    process.exit(1)
}

console.log(`Releasing v${version}...`)

const glob = new Bun.Glob('**/package.json')
for await (const file of glob.scan('.')) {
    if (file.includes('node_modules')) continue

    const fileRef = Bun.file(file)
    const pkg = await fileRef.json()

    pkg.version = version
    await Bun.write(file, JSON.stringify(pkg, null, 4) + '\n')
    console.log(`Updated ${file} to v${version}`)
}

// format the package.jsons just to be safe
await $`bun run format`

await $`bun install` // to update lockfile if needed

await $`git-cliff -o CHANGELOG.md`

console.log('Running pre-release checks...')
await $`bun run lint`
await $`bun run build`

await $`git add .`
await $`git commit -m ${`chore(release): v${version}`}`

await $`git tag -a ${`v${version}`} -m ${`December v${version}`}`

await $`git push origin main`
await $`git push origin ${`v${version}`}`

console.log(`Released v${version}`)
