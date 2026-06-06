import { prisma } from './src/config/db'
import { deleteObject } from './src/modules/project/project-storage'
import { latestPreviewManifestRefKey } from './src/modules/project/preview-manifest'

async function main() {
    const project = await prisma.project.findFirst({
        where: { name: 'CourseHub' },
        orderBy: { updatedAt: 'desc' },
    })
    if (!project) return
    const currentVersion = await prisma.projectVersion.findFirst({
        where: { id: project.currentVersionId },
    })

    const latestKey = latestPreviewManifestRefKey(project.id, currentVersion.id)
    console.log('Deleting latest.json key:', latestKey)

    try {
        await deleteObject(latestKey)
        console.log('Deleted successfully!')
    } catch (e) {
        console.log('Error deleting from S3:', e.message)
    }

    // Also delete from PreviewSession table to force a clean start
    await prisma.previewSession.deleteMany({
        where: { projectId: project.id },
    })
    console.log('Deleted preview sessions')

    await prisma.$disconnect()
}
main().catch(console.error)
