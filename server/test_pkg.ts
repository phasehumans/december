import { prisma } from './src/config/db'
import { getTextFile } from './src/modules/project/project-storage'

async function main() {
    const latestProject = await prisma.project.findFirst({ orderBy: { updatedAt: 'desc' } })
    const currentVersion = await prisma.projectVersion.findFirst({
        where: { id: latestProject.currentVersionId },
    })

    const packageFile = currentVersion.manifestJson.find((f) => f.path === 'package.json')
    if (packageFile) {
        const content = await getTextFile(packageFile.key)
        console.log('--- package.json ---\n' + content)
    }
    await prisma.$disconnect()
}
main().catch(console.error)
