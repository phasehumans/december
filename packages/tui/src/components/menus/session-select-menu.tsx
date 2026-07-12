import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

export function SessionSelectMenu(props: any) {
    const {
        sessionRenameMode,
        sessionNewName,
        setSessionNewName,
        sessionsData,
        sessionPage,
        sessionSelectedIndex,
        sessionRepository,
        setSessionsData,
        setSessionRenameMode,
    } = props
    const SESSION_PAGE_SIZE = 10
    const totalItems = sessionsData.length
    const maxPage = Math.max(0, Math.ceil(totalItems / SESSION_PAGE_SIZE) - 1)
    const startIndex = sessionPage * SESSION_PAGE_SIZE
    const visibleItems = sessionsData.slice(startIndex, startIndex + SESSION_PAGE_SIZE)

    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
        if (seconds < 60) return `${seconds}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    const handleRenameSubmit = (val: string) => {
        const absIndex = startIndex + sessionSelectedIndex
        const session = sessionsData[absIndex]
        const newName = val.trim()
        if (session && newName && newName !== session.id) {
            if (sessionRepository?.renameSession) {
                sessionRepository.renameSession(session.id, newName).then(() => {
                    const nextData = [...sessionsData]
                    nextData[absIndex] = { ...session, id: newName, preview: newName }
                    setSessionsData(nextData)
                })
            }
        }
        setSessionRenameMode(false)
        setSessionNewName('')
    }

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text bold color="white">
                    Sessions
                </Text>
            </Box>
            {visibleItems.map((session, idx) => {
                const isSelected = idx === sessionSelectedIndex

                if (isSelected && sessionRenameMode) {
                    return (
                        <Box key={session.id} flexDirection="row">
                            <Box width={2}>
                                <Text color="#89B4F8">{'❭ '}</Text>
                            </Box>
                            <TextInput
                                value={sessionNewName}
                                onChange={setSessionNewName}
                                onSubmit={handleRenameSubmit}
                                focus={true}
                            />
                        </Box>
                    )
                }

                const title = session.preview || session.id
                const timeStr = timeAgo(session.updatedAt).padStart(10)

                return (
                    <Box key={session.id} flexDirection="row">
                        <Box width={2}>
                            <Text color={isSelected ? '#89B4F8' : 'white'}>
                                {isSelected ? '❭ ' : '  '}
                            </Text>
                        </Box>
                        <Box width={97}>
                            <Text color={isSelected ? '#89B4F8' : '#AAAAAA'} wrap="truncate">
                                {title}
                            </Text>
                        </Box>
                        <Box width={12}>
                            <Text color="#AAAAAA">{timeStr}</Text>
                        </Box>
                    </Box>
                )
            })}

            {totalItems === 0 && (
                <Box paddingLeft={2}>
                    <Text color="#555555">No sessions found.</Text>
                </Box>
            )}

            {totalItems > 0 && (
                <Box marginTop={1} paddingLeft={2}>
                    <Text color="#555555">
                        [{startIndex + 1}-{Math.min(startIndex + SESSION_PAGE_SIZE, totalItems)} of{' '}
                        {totalItems} items]
                    </Text>
                </Box>
            )}

            <Box paddingTop={1}>
                <Box gap={1}>
                    <Text color="#89B4F8">↑/↓</Text>
                    <Text color="#AAAAAA">Navigate</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">←/→</Text>
                    <Text color="#AAAAAA">Page</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">enter</Text>
                    <Text color="#AAAAAA">Select</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">r</Text>
                    <Text color="#AAAAAA">Rename</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">d</Text>
                    <Text color="#AAAAAA">Delete</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">esc</Text>
                    <Text color="#AAAAAA">Cancel</Text>
                </Box>
            </Box>
        </Box>
    )
}
