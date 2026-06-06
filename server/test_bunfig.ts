import { prisma } from './src/config/db'
import { getTextFile } from './src/modules/project/project-storage'

async function main() {
    const latestProject = await prisma.project.findFirst({ orderBy: { updatedAt: 'desc' } })
    const currentVersion = await prisma.projectVersion.findFirst({
        where: { id: latestProject.currentVersionId },
    })

    const bunfigFile = currentVersion.manifestJson.find((f) => f.path === 'bunfig.toml')
    if (bunfigFile) {
        const content = await getTextFile(bunfigFile.key)
        console.log('--- bunfig.toml ---\n' + content)
    }
    await prisma.$disconnect()
}
main().catch(console.error)
