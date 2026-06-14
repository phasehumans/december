import { projectService } from './modules/project/project.service'

async function run() {
    try {
        console.log("Starting duplication of project 'cf053711-f7be-4e1c-ad11-c8c432e01a69'...")
        const result = await projectService.duplicateProject({
            userId: 'a212ff01-a28d-4fcc-b944-691ab7c609db',
            projectId: 'cf053711-f7be-4e1c-ad11-c8c432e01a69',
            name: 'Copy of real estatse',
        })
        console.log('Duplication succeeded! Result:', result)
    } catch (error) {
        console.error('Duplication failed with error:')
        console.error(error)
    }
}

run().catch(console.error)
