import { $ } from 'bun'

const releaseType = process.argv[2]

const validReleaseTypes = ['patch', 'minor', 'major']

if (!validReleaseTypes.includes(releaseType!)) {
    console.error('Usage: bun run release <patch|minor|major>')
    process.exit(1)
}

console.log(`Creating ${releaseType} release...`)

// Ensure working tree is clean
const gitStatus = await $`git status --porcelain`.text()

if (gitStatus.trim()) {
    console.error('Working tree is not clean. Commit or stash your changes first.')
    process.exit(1)
}

// Bump version
await $`bun version ${releaseType}`

// Read updated version
const packageJson = await Bun.file('package.json').json()

const version = packageJson.version
const tag = `v${version}`

console.log(`Version bumped to ${version}`)

// Generate changelog
await $`git-cliff -o CHANGELOG.md`

// Commit release
await $`git add package.json bun.lock CHANGELOG.md`
await $`git commit -m ${`chore(release): ${tag}`}`

// Create tag
await $`git tag -a ${tag} -m ${`December ${tag}`}`

// Push
await $`git push origin main`
await $`git push origin ${tag}`

console.log(`Released ${tag}`)
