import { useToast } from '../../providers/toast'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'
import { CustomIndicator } from './menu-items'

export function HooksMenu(props: any) {
    const {
        addingMatcher,
        newMatcherRegex,
        setNewMatcherRegex,
        hookMatchers,
        selectedHookType,
        setSelectedHookType,
        setMatcherIndex,
        setHookMatchers,
        setAddingMatcher,
        matcherIndex,
    } = props
    const toast = useToast()
    const hookItems = [
        { label: 'PreToolUse', value: 'PreToolUse', description: 'Before tool execution' },
        { label: 'PostToolUse', value: 'PostToolUse', description: 'After tool execution' },
        {
            label: 'PreInvocation',
            value: 'PreInvocation',
            description: 'Before each LLM invocation',
        },
        {
            label: 'PostInvocation',
            value: 'PostInvocation',
            description: 'After each LLM invocation',
        },
        { label: 'Stop', value: 'Stop', description: 'When agent tries to exit' },
    ]

    if (!selectedHookType) {
        const HookCustomItem = ({
            label,
            isSelected,
        }: {
            label?: string
            isSelected?: boolean
        }) => {
            const item = hookItems.find((i) => i.label === label)
            return (
                <Box>
                    <Box width={16}>
                        <Text color={isSelected ? '#89B4F8' : item ? 'white' : '#AAAAAA'}>
                            {label}
                        </Text>
                    </Box>
                    <Text color="#AAAAAA">{item?.description}</Text>
                </Box>
            )
        }

        const handleHookSelect = (item: any) => {
            setSelectedHookType(item.value)
            setMatcherIndex(0)
        }

        return (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1} flexDirection="column">
                    <Text bold color="white">
                        Hooks
                    </Text>
                    <Text color="#AAAAAA"> 5 hook types</Text>
                </Box>

                <Box paddingLeft={1} width="100%">
                    <SelectInput
                        items={hookItems}
                        onSelect={handleHookSelect}
                        indicatorComponent={CustomIndicator}
                        itemComponent={HookCustomItem}
                    />
                </Box>

                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑/↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (addingMatcher) {
        const hookDesc = hookItems.find((h) => h.value === selectedHookType)?.description || ''

        const handleAddMatcherSubmit = (val: string) => {
            if (val.trim()) {
                setHookMatchers((prev) => {
                    const existing = prev[selectedHookType] || []
                    return {
                        ...prev,
                        [selectedHookType]: [...existing, { pattern: val, enabled: true }],
                    }
                })
                toast.show({ message: `Added matcher: ${val}` })
            }
            setAddingMatcher(false)
            setNewMatcherRegex('')
        }

        return (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1} flexDirection="column">
                    <Text bold color="#89B4F8">
                        Add new matcher for {selectedHookType}
                    </Text>
                    <Text color="#AAAAAA"> {hookDesc}</Text>
                </Box>

                <Box paddingLeft={1} paddingBottom={1} flexDirection="column">
                    <Text color="#89B4F8">Matcher:</Text>
                    <Box width="100%">
                        <Text color="#89B4F8"> {'>'} </Text>
                        <TextInput
                            focus={true}
                            value={newMatcherRegex}
                            onChange={setNewMatcherRegex}
                            onSubmit={handleAddMatcherSubmit}
                        />
                    </Box>
                </Box>

                <Box paddingLeft={1} paddingBottom={1} flexDirection="column">
                    <Text color="#AAAAAA">Examples:</Text>
                    <Text color="#AAAAAA">• Write (single tool)</Text>
                    <Text color="#AAAAAA">• Write|Edit (multiple tools)</Text>
                    <Text color="#AAAAAA">• Web.* (regex pattern)</Text>
                </Box>

                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Confirm</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else {
        const hookDesc = hookItems.find((h) => h.value === selectedHookType)?.description || ''
        const matchers = hookMatchers[selectedHookType] || []

        const matcherItems = [
            { label: '+ Add new matcher...', value: 'add_new' },
            { label: '+ Match all (no filter)', value: 'match_all' },
        ]

        matchers.forEach((m, idx) => {
            matcherItems.push({
                label: `${m.enabled ? '✓' : '✗'} ${m.pattern}`,
                value: `matcher_${idx}`,
            })
        })

        return (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1} flexDirection="column">
                    <Text bold color="#89B4F8">
                        {selectedHookType} — Matchers
                    </Text>
                    <Text color="#AAAAAA"> {hookDesc}</Text>
                </Box>

                <Box paddingLeft={1} width="100%" flexDirection="column">
                    {matcherItems.map((item, idx) => {
                        const isSelected = idx === matcherIndex
                        const isAdd = item.value === 'add_new' || item.value === 'match_all'
                        const isEnabled = item.label.startsWith('✓')
                        return (
                            <Box key={item.value}>
                                <CustomIndicator isSelected={isSelected} />
                                {isAdd ? (
                                    <Text color={isSelected ? '#89B4F8' : 'white'}>
                                        {item.label}
                                    </Text>
                                ) : (
                                    <Text
                                        color={
                                            isSelected ? '#89B4F8' : isEnabled ? 'white' : '#555555'
                                        }
                                    >
                                        {item.label}
                                    </Text>
                                )}
                            </Box>
                        )
                    })}
                    {matchers.length === 0 && (
                        <Box>
                            <Box marginRight={1}>
                                <Text> </Text>
                            </Box>
                            <Text color="#555555">No hooks configured</Text>
                        </Box>
                    )}
                </Box>

                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑/↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">e</Text>
                        <Text color="#AAAAAA">Toggle</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">backspace</Text>
                        <Text color="#AAAAAA">Delete</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    }
    return null
}
