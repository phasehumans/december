import { Check, ChevronRight, KeyRound } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { CascadeMenu, type CascadeItem } from './CascadeMenu'
import { ListSearch } from './PromptMenus'

import {
    DEFAULT_SPEED,
    SPEEDS,
    SPEED_LABELS,
    useModelSelection,
    type BillingSource,
    type Speed,
} from '@/features/home/model-selection'
import { useByokList } from '@/features/profile/hooks/useByokData'
import { useBottomSheet } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

interface ModelControlProps {
    isAuthenticated?: boolean
    /** the model of the user's own key. December credits have no model in the browser */
    selectedModel?: string
    selectedProvider?: string
    selectedSource: BillingSource
    selectedSpeed?: Speed
    /** a model of one of the user's own keys */
    onSelectModel?: (model: string, provider?: string, source?: BillingSource) => void
    /** the switch to December credits */
    onSelectCredits?: () => void
    onSelectSpeed?: (speed: Speed) => void
}

interface KeyGroup {
    provider: string
    name: string
    models: string[]
}

const SPEED_TIPS: Record<Speed, string> = {
    fast: 'Fast: quick answers, lower cost',
    deep: 'Deep: more reasoning for hard work',
}
// lists longer than this get a search box
const SEARCH_FROM = 9

const groupClass = 'inline-flex items-center gap-0.5 ml-1 p-0.5 rounded-full border border-white/5'
const tooltipClass =
    'absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover/seg:flex bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none text-[12px] font-medium text-[#EDEDEF]'
const rowClass =
    'flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#EDEDEF] hover:bg-[#252525] transition-colors outline-none w-full min-w-0 cursor-pointer'

const shortName = (model: string) => model.split('/').pop() || model

/** the models of one saved key. a pick switches the run to that key */
const KeyModelList: React.FC<{
    group: KeyGroup
    selectedModel?: string
    isSelectedProvider: boolean
    onPick: (model: string) => void
}> = ({ group, selectedModel, isSelectedProvider, onPick }) => {
    const [query, setQuery] = React.useState('')
    const needle = query.trim().toLowerCase()
    const models = group.models.filter((model) => !needle || model.toLowerCase().includes(needle))

    return (
        <>
            {group.models.length >= SEARCH_FROM && (
                <ListSearch value={query} onChange={setQuery} label="Search models" />
            )}
            {models.length === 0 ? (
                <div className="px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]">
                    No models found.
                </div>
            ) : (
                models.map((model) => (
                    <button
                        key={model}
                        type="button"
                        onClick={() => onPick(model)}
                        className={rowClass}
                    >
                        <span className="truncate">{model}</span>
                        {isSelectedProvider && selectedModel === model && (
                            <Check className="w-3.5 h-3.5 text-white shrink-0" />
                        )}
                    </button>
                ))
            )}
        </>
    )
}

/** the saved keys and the actions that move a run between credits and a key */
const useModelSource = (props: ModelControlProps) => {
    const { isAuthenticated, selectedSource, onSelectModel, onSelectCredits } = props
    const { data: byokData } = useByokList(Boolean(isAuthenticated))
    const lastOwnKey = useModelSelection((s) => s.lastOwnKey)

    const groups = React.useMemo<KeyGroup[]>(
        () =>
            (byokData?.credentials || []).map((credential) => ({
                provider: credential.provider,
                name:
                    byokData?.providers.find((p) => p.id === credential.provider)?.name ||
                    credential.provider,
                models: credential.models,
            })),
        [byokData]
    )
    const hasKeys = groups.length > 0
    const isOnKey = selectedSource === 'OWN_KEY' && hasKeys

    const switchToCredits = () => onSelectCredits?.()

    const switchToKey = () => {
        // the last model used on a key, when that key is still saved
        const remembered =
            lastOwnKey &&
            groups.find(
                (group) =>
                    group.provider === lastOwnKey.provider &&
                    group.models.includes(lastOwnKey.model)
            )
        if (remembered && lastOwnKey) {
            onSelectModel?.(lastOwnKey.model, lastOwnKey.provider, 'OWN_KEY')
            return
        }
        const first = byokData?.credentials[0]
        if (first) onSelectModel?.(first.defaultModel, first.provider, 'OWN_KEY')
    }

    return { groups, hasKeys, isOnKey, switchToCredits, switchToKey }
}

const segmentClass = (isActive: boolean) =>
    cn(
        'flex items-center justify-center w-7 h-6 rounded-full transition-colors outline-none cursor-pointer touch-manipulation',
        isActive ? 'bg-white/10 text-[#EDEDEF]' : 'text-[#8E8E8E] hover:text-[#EDEDEF]'
    )
/** a segment with a word in it: Fast | Deep, Credits | Your keys */
const wordSegmentClass = (isActive: boolean) =>
    cn(
        'px-2.5 h-6 rounded-full text-[12px] font-medium transition-colors outline-none cursor-pointer touch-manipulation',
        isActive ? 'bg-white/10 text-[#EDEDEF]' : 'text-[#8E8E8E] hover:text-[#EDEDEF]'
    )
const configRowClass =
    'flex items-center justify-between gap-3 px-3 rounded-xl font-medium text-[#EDEDEF] min-w-0'

/**
 * The switch between December credits and your own keys. With no key saved, the key
 * side opens the keys page.
 * - `icons` (desktop): it sits left of the mic.
 * - `words` (phones): it is the "Run on" row of Configuration.
 */
export const SourceSwitch: React.FC<
    ModelControlProps & { onOpenAuth?: () => void; variant?: 'icons' | 'words' }
> = (props) => {
    const { isAuthenticated, onOpenAuth, variant = 'icons' } = props
    const navigate = useNavigate()
    // inside a sheet, the keys page opens after the sheet has closed
    const { closeThen } = useBottomSheet()
    const { hasKeys, isOnKey, switchToCredits, switchToKey } = useModelSource(props)

    const pickCredits = () => {
        if (isOnKey) switchToCredits()
    }
    const pickKey = () => {
        if (!isAuthenticated) {
            onOpenAuth?.()
            return
        }
        if (!hasKeys) {
            closeThen(() => navigate('/settings/models'))
            return
        }
        if (!isOnKey) switchToKey()
    }

    if (variant === 'words') {
        return (
            <div
                role="radiogroup"
                aria-label="Model source"
                className={cn(groupClass, 'ml-0 shrink-0')}
            >
                <button
                    type="button"
                    role="radio"
                    aria-checked={!isOnKey}
                    aria-label="December credits"
                    onClick={pickCredits}
                    className={wordSegmentClass(!isOnKey)}
                >
                    Credits
                </button>
                <button
                    type="button"
                    role="radio"
                    aria-checked={isOnKey}
                    onClick={pickKey}
                    className={wordSegmentClass(isOnKey)}
                >
                    Your keys
                </button>
            </div>
        )
    }

    return (
        <div
            role="radiogroup"
            aria-label="Model source"
            className="inline-flex items-center gap-0.5 p-0.5 rounded-full border border-white/5"
        >
            <div className="relative group/seg">
                <button
                    type="button"
                    role="radio"
                    aria-checked={!isOnKey}
                    aria-label="December credits"
                    onClick={pickCredits}
                    className={segmentClass(!isOnKey)}
                >
                    <Icons.DecemberLogo className="w-3.5 h-3.5" strokeWidth={1} />
                </button>
                <span className={tooltipClass}>December credits</span>
            </div>
            <div className="relative group/seg">
                <button
                    type="button"
                    role="radio"
                    aria-checked={isOnKey}
                    aria-label="Your keys"
                    onClick={pickKey}
                    className={segmentClass(isOnKey)}
                >
                    <KeyRound className="w-3 h-3" />
                </button>
                <span className={tooltipClass}>{hasKeys ? 'Your keys' : 'Add a key'}</span>
            </div>
        </div>
    )
}

/**
 * The Fast | Deep switch. On December credits the server picks the model for the
 * speed. On your own key the speed is how much the picked model reasons.
 */
export const SpeedSwitch: React.FC<ModelControlProps & { className?: string }> = ({
    selectedSpeed = DEFAULT_SPEED,
    onSelectSpeed,
    className,
}) => (
    <div role="radiogroup" aria-label="Speed" className={cn(groupClass, 'shrink-0', className)}>
        {SPEEDS.map((value) => (
            <div key={value} className="relative group/seg">
                <button
                    type="button"
                    role="radio"
                    aria-checked={selectedSpeed === value}
                    onClick={() => onSelectSpeed?.(value)}
                    className={wordSegmentClass(selectedSpeed === value)}
                >
                    {SPEED_LABELS[value]}
                </button>
                <span className={tooltipClass}>{SPEED_TIPS[value]}</span>
            </div>
        ))}
    </div>
)

/** credits or your keys as the first Configuration row, for phones */
export const SourceConfigRow: React.FC<ModelControlProps & { onOpenAuth?: () => void }> = (
    props
) => (
    <div className={configRowClass}>
        <span>Run on</span>
        <SourceSwitch {...props} variant="words" />
    </div>
)

/** Fast | Deep as a Configuration row, for phones */
export const SpeedConfigRow: React.FC<ModelControlProps> = (props) => (
    <div className={configRowClass}>
        <span>Speed</span>
        <SpeedSwitch {...props} className="ml-0" />
    </div>
)

/**
 * The Model row of Configuration, for phones on your own key. It opens the model list,
 * the level under Configuration in the same sheet.
 */
export const ModelConfigRow: React.FC<ModelControlProps & { onOpen: () => void }> = (props) => {
    const { selectedModel, onOpen } = props
    const { isOnKey } = useModelSource(props)
    if (!isOnKey) return null

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                configRowClass,
                'w-full text-left outline-none cursor-pointer active:bg-[#242424]'
            )}
        >
            <span>Model</span>
            <span className="flex items-center gap-1.5 min-w-0 text-[12.5px] font-normal text-[#8F8E8D]">
                <span className="truncate max-w-[160px]">{shortName(selectedModel || '')}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </span>
        </button>
    )
}

/**
 * Phones: the text left of the mic. On December credits it reads Fast or Deep and opens
 * Configuration. On your own key it reads the model name and opens the model list, the
 * level under Configuration: Back goes up to the credits / keys switch.
 */
export const PhoneModelText: React.FC<
    ModelControlProps & {
        onOpenAuth?: () => void
        onOpenConfig: () => void
        onOpenModels: () => void
    }
> = (props) => {
    const { isAuthenticated, selectedModel, selectedSpeed = DEFAULT_SPEED } = props
    const { onOpenAuth, onOpenConfig, onOpenModels } = props
    const { isOnKey } = useModelSource(props)
    const text = isOnKey ? shortName(selectedModel || '') : SPEED_LABELS[selectedSpeed]

    return (
        <button
            type="button"
            aria-label={isOnKey ? 'Select Model' : `Speed: ${text}`}
            onClick={() => {
                if (!isAuthenticated && onOpenAuth) {
                    onOpenAuth()
                    return
                }
                if (isOnKey) onOpenModels()
                else onOpenConfig()
            }}
            className="flex items-center gap-1 h-8 px-2 rounded-full text-[12px] font-medium text-[#8E8E8E] active:bg-white/5 transition-colors outline-none cursor-pointer touch-manipulation min-w-0"
        >
            <span className="truncate max-w-[120px]">{text}</span>
            <Icons.ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
        </button>
    )
}

const ManageKeysRow: React.FC<{ onPick: () => void }> = ({ onPick }) => (
    <button
        type="button"
        onClick={onPick}
        className="px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#8F8E8D] hover:text-[#D6D5D4] hover:bg-[#252525] transition-colors outline-none w-full cursor-pointer"
    >
        Manage keys
    </button>
)

/** the rows of the phone model list: with more than one key, the keys come first */
const KeyModelsList: React.FC<
    ModelControlProps & {
        groups: KeyGroup[]
        /** the key whose models show. null for the list of keys */
        provider: string | null
        onProvider: (provider: string) => void
        onPicked: () => void
    }
> = (props) => {
    const { selectedModel, selectedProvider, onSelectModel, groups, provider } = props
    const { onProvider, onPicked } = props
    const navigate = useNavigate()
    // the keys page opens after the sheet has closed
    const { closeThen } = useBottomSheet()
    const openGroup =
        groups.length === 1 ? groups[0] : groups.find((group) => group.provider === provider)

    return (
        <div className="flex flex-col pb-1 [&>button]:py-2.5 [&>button]:text-[14px]">
            {openGroup ? (
                <KeyModelList
                    group={openGroup}
                    selectedModel={selectedModel}
                    isSelectedProvider={selectedProvider === openGroup.provider}
                    onPick={(model) => {
                        onPicked()
                        onSelectModel?.(model, openGroup.provider, 'OWN_KEY')
                    }}
                />
            ) : (
                groups.map((group) => (
                    <button
                        key={group.provider}
                        type="button"
                        onClick={() => onProvider(group.provider)}
                        className={rowClass}
                    >
                        <span className="truncate">{group.name}</span>
                        <span className="shrink-0 text-[12px] font-normal text-[#8F8E8D]">
                            {group.models.length} {group.models.length === 1 ? 'model' : 'models'}
                        </span>
                    </button>
                ))
            )}
            <ManageKeysRow onPick={() => closeThen(() => navigate('/settings/models'))} />
        </div>
    )
}

/**
 * Phones: the model list of your keys as a level of the Configuration sheet. With more
 * than one key the keys come first, and a key opens its models. `onPicked` runs when a
 * model is picked.
 */
export const useKeyModelsLevel = (props: ModelControlProps, onPicked: () => void) => {
    const { groups } = useModelSource(props)
    const [provider, setProvider] = React.useState<string | null>(null)
    // the key that is open, when the list has a step for the keys
    const openGroup =
        groups.length > 1 ? groups.find((group) => group.provider === provider) : undefined

    return {
        title: openGroup ? openGroup.name : 'Model',
        /** up one step inside the list. false when the list is at its first step */
        back: () => {
            if (!openGroup) return false
            setProvider(null)
            return true
        },
        /** the first step again, for the next time the list opens */
        reset: () => setProvider(null),
        content: (
            <KeyModelsList
                {...props}
                groups={groups}
                provider={openGroup ? provider : null}
                onProvider={setProvider}
                onPicked={onPicked}
            />
        ),
    }
}

/**
 * The model button of the prompt box on desktop, after the Fast | Deep switch. It
 * shows only on your own key: December credits have no model to pick. Its menu lists
 * your keys, and the models of a key open beside it.
 * The credits / keys switch is `SourceSwitch`, next to the mic. Phones use
 * `PhoneModelText` and the Configuration sheet in its place.
 */
export const ModelControl: React.FC<ModelControlProps> = (props) => {
    const { selectedModel, selectedProvider, onSelectModel } = props
    const navigate = useNavigate()
    const { groups, isOnKey } = useModelSource(props)
    const [isMenuOpen, setIsMenuOpen] = React.useState(false)
    const [menuPlacement, setMenuPlacement] = React.useState<'top' | 'bottom'>('bottom')
    const menuRef = React.useRef<HTMLDivElement>(null)

    const closeMenu = React.useCallback(() => setIsMenuOpen(false), [])

    React.useEffect(() => {
        if (!isMenuOpen) return
        const onMouseDown = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeMenu()
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [isMenuOpen, closeMenu])

    if (!isOnKey) return null

    const modelList = (group: KeyGroup) => (
        <KeyModelList
            group={group}
            selectedModel={selectedModel}
            isSelectedProvider={selectedProvider === group.provider}
            onPick={(model) => {
                closeMenu()
                onSelectModel?.(model, group.provider, 'OWN_KEY')
            }}
        />
    )
    const manageKeys = (
        <ManageKeysRow
            onPick={() => {
                closeMenu()
                navigate('/settings/models')
            }}
        />
    )
    const providerItems: CascadeItem[] = groups.map((group) => ({
        id: group.provider,
        label: group.name,
        hint: `${group.models.length} ${group.models.length === 1 ? 'model' : 'models'}`,
        side: modelList(group),
    }))

    return (
        <div className="relative ml-1 min-w-0" ref={menuRef}>
            <button
                type="button"
                aria-label="Select Model"
                aria-expanded={isMenuOpen}
                onClick={(event) => {
                    if (!isMenuOpen) {
                        const rect = event.currentTarget.getBoundingClientRect()
                        const spaceBelow = window.innerHeight - rect.bottom
                        setMenuPlacement(
                            spaceBelow < 250 && rect.top > spaceBelow ? 'top' : 'bottom'
                        )
                    }
                    setIsMenuOpen(!isMenuOpen)
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium text-[#8E8E8E] hover:text-[#EDEDEF] hover:bg-white/5 transition-all outline-none cursor-pointer touch-manipulation border border-white/5 min-w-0 max-w-full"
            >
                <span className="truncate max-w-[120px]">{shortName(selectedModel || '')}</span>
                <Icons.ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>

            {isMenuOpen &&
                (groups.length === 1 ? (
                    // one key: its models open at once, with no provider step
                    <div
                        role="menu"
                        aria-label="Models"
                        className={cn(
                            'absolute left-0 z-50 w-[230px] max-w-[calc(100vw-32px)] max-h-[320px] overflow-y-auto no-scrollbar bg-[#1E1E1E] border border-[#2A2928] rounded-2xl p-1 shadow-lg shadow-black/40 flex flex-col animate-in fade-in zoom-in-95 duration-150',
                            menuPlacement === 'top'
                                ? 'bottom-[calc(100%+8px)]'
                                : 'top-[calc(100%+8px)]'
                        )}
                    >
                        {modelList(groups[0])}
                        {manageKeys}
                    </div>
                ) : (
                    <CascadeMenu
                        items={providerItems}
                        ariaLabel="Your keys"
                        placement={menuPlacement}
                        onClose={closeMenu}
                        footer={manageKeys}
                    />
                ))}
        </div>
    )
}
