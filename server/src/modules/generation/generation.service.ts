import {
    applyProjectEditWorkflow,
    applyProjectFixWorkflow,
    generateWebsite,
} from './generation.workflows'

export const generateService = {
    generateWebsite,
    applyProjectEdit: applyProjectEditWorkflow,
    applyProjectFix: applyProjectFixWorkflow,
}
