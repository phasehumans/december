export const RUNTIME_CHECKLISTS = {
    generated: [
        { state: 'WaitingForRunnableVersion', label: 'Initializing sandbox container' },
        { state: 'Bootstrapping', label: 'Generating structure and writing files' },
        { state: 'Installing', label: 'Resolving and installing dependencies' },
        { state: 'Starting', label: 'Starting live development server' },
    ],
    github: [
        { state: 'WaitingForRunnableVersion', label: 'Connecting to remote repository' },
        { state: 'Bootstrapping', label: 'Cloning repository and mapping workspace structure' },
        { state: 'Installing', label: 'Installing project dependencies' },
        { state: 'Starting', label: 'Booting environment' },
    ],
    zip: [
        { state: 'WaitingForRunnableVersion', label: 'Uploading and extracting archive' },
        { state: 'Bootstrapping', label: 'Verifying files and mapping workspace structure' },
        { state: 'Installing', label: 'Installing project dependencies' },
        { state: 'Starting', label: 'Booting environment' },
    ],
}
