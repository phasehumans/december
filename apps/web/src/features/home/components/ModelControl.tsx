import { Check, KeyRound } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { CascadeMenu, type CascadeItem } from './CascadeMenu'
import { ListSearch } from './PromptMenus'

import {
    CREDIT_TIERS,
    CREDIT_TIER_LABELS,
    getCreditTier,
    useModelSelection,
    type BillingSource,
    type CreditTier,
} from '@/features/home/model-selection'
import { useByokList } from '@/features/profile/hooks/useByokData'
import { BottomSheet, SheetHeader } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

interface ModelControlProps {
    isAuthenticated?: boolean
    selectedModel?: string
    selectedProvider?: string
    selectedSource: BillingSource
    onSelectModel?: (model: string, provider?: string, source?: BillingSource) => void
}

interface KeyGroup {
    provider: string
    name: string
    models: string[]
}

const TIERS: CreditTier[] = ['fast', 'deep']
const TIER_TIPS: Record<CreditTier, string> = {
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

/**
 * The model control of the prompt box.
 * - On December credits: a Fast or Deep switch. No model names.
 * - On your own key: a button with the model name. Its menu lists your keys, and the
 *   models of a key open beside it.
 * - A small switch between the two shows only when a key is saved.
 */
export const ModelControl: React.FC<ModelControlProps> = ({
    isAuthenticated,
    selectedModel,
    selectedProvider,
    selectedSource,
    onSelectModel,
}) => {
    const navigate = useNavigate()
    const isPhone = useIsPhone()
    const { data: byokData } = useByokList(Boolean(isAuthenticated))
    const lastCreditTier = useModelSelection((s) => s.lastCreditTier)
    const lastOwnKey = useModelSelection((s) => s.lastOwnKey)
    const [isMenuOpen, setIsMenuOpen] = React.useState(false)
    const [menuPlacement, setMenuPlacement] = React.useState<'top' | 'bottom'>('bottom')
    const [sheetProvider, setSheetProvider] = React.useState<string | null>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)

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
    const tier = getCreditTier(selectedModel)

    const closeMenu = React.useCallback(() => {
        setIsMenuOpen(false)
        setSheetProvider(null)
    }, [])

    React.useEffect(() => {
        if (!isMenuOpen || isPhone) return
        const onMouseDown = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeMenu()
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [isMenuOpen, isPhone, closeMenu])

    const switchToCredits = (next: CreditTier = lastCreditTier) =>
        onSelectModel?.(CREDIT_TIERS[next].model, CREDIT_TIERS[next].provider, 'CREDITS')

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

    const pickKeyModel = (provider: string, model: string) => {
        closeMenu()
        onSelectModel?.(model, provider, 'OWN_KEY')
    }

    const modelList = (group: KeyGroup) => (
        <KeyModelList
            group={group}
            selectedModel={selectedModel}
            isSelectedProvider={selectedProvider === group.provider}
            onPick={(model) => pickKeyModel(group.provider, model)}
        />
    )

    const manageKeys = (
        <button
            type="button"
            onClick={() => {
                closeMenu()
                navigate('/settings/models')
            }}
            className="px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#8F8E8D] hover:text-[#D6D5D4] hover:bg-[#252525] transition-colors outline-none w-full cursor-pointer"
        >
            Manage keys
        </button>
    )

    const providerItems: CascadeItem[] = groups.map((group) => ({
        id: group.provider,
        label: group.name,
        hint: `${group.models.length} ${group.models.length === 1 ? 'model' : 'models'}`,
        side: modelList(group),
    }))

    const sheetGroup = groups.find((group) => group.provider === sheetProvider)

    return (
        <>
            {hasKeys && (
                <div role="radiogroup" aria-label="Model source" className={groupClass}>
                    <div className="relative group/seg">
                        <button
                            type="button"
                            role="radio"
                            aria-checked={!isOnKey}
                            aria-label="December credits"
                            onClick={() => switchToCredits()}
                            className={cn(
                                'flex items-center justify-center w-7 h-6 rounded-full transition-colors outline-none cursor-pointer',
                                !isOnKey
                                    ? 'bg-white/10 text-[#EDEDEF]'
                                    : 'text-[#8E8E8E] hover:text-[#EDEDEF]'
                            )}
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
                            onClick={switchToKey}
                            className={cn(
                                'flex items-center justify-center w-7 h-6 rounded-full transition-colors outline-none cursor-pointer',
                                isOnKey
                                    ? 'bg-white/10 text-[#EDEDEF]'
                                    : 'text-[#8E8E8E] hover:text-[#EDEDEF]'
                            )}
                        >
                            <KeyRound className="w-3 h-3" />
                        </button>
                        <span className={tooltipClass}>Your keys</span>
                    </div>
                </div>
            )}

            {!isOnKey ? (
                <div role="radiogroup" aria-label="Speed" className={groupClass}>
                    {TIERS.map((value) => (
                        <div key={value} className="relative group/seg">
                            <button
                                type="button"
                                role="radio"
                                aria-checked={tier === value}
                                onClick={() => switchToCredits(value)}
                                className={cn(
                                    'px-2.5 h-6 rounded-full text-[12px] font-medium transition-colors outline-none cursor-pointer touch-manipulation',
                                    tier === value
                                        ? 'bg-white/10 text-[#EDEDEF]'
                                        : 'text-[#8E8E8E] hover:text-[#EDEDEF]'
                                )}
                            >
                                {CREDIT_TIER_LABELS[value]}
                            </button>
                            <span className={tooltipClass}>{TIER_TIPS[value]}</span>
                        </div>
                    ))}
                </div>
            ) : (
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
                        <span className="truncate max-w-[120px]">
                            {shortName(selectedModel || '')}
                        </span>
                        <Icons.ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                    </button>

                    {isMenuOpen &&
                        !isPhone &&
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
            )}

            {isPhone && isOnKey && (
                <BottomSheet
                    isOpen={isMenuOpen}
                    onClose={closeMenu}
                    onBack={() => {
                        if (!sheetProvider || groups.length === 1) return false
                        setSheetProvider(null)
                        return true
                    }}
                    ariaLabel="Models"
                    header={
                        sheetGroup && groups.length > 1 ? (
                            <SheetHeader
                                title={sheetGroup.name}
                                onBack={() => setSheetProvider(null)}
                            />
                        ) : undefined
                    }
                >
                    <div className="flex flex-col pb-1 [&>button]:py-2.5 [&>button]:text-[14px]">
                        {groups.length === 1
                            ? modelList(groups[0])
                            : sheetGroup
                              ? modelList(sheetGroup)
                              : groups.map((group) => (
                                    <button
                                        key={group.provider}
                                        type="button"
                                        onClick={() => setSheetProvider(group.provider)}
                                        className={rowClass}
                                    >
                                        <span className="truncate">{group.name}</span>
                                        <span className="shrink-0 text-[12px] font-normal text-[#8F8E8D]">
                                            {group.models.length}{' '}
                                            {group.models.length === 1 ? 'model' : 'models'}
                                        </span>
                                    </button>
                                ))}
                        {manageKeys}
                    </div>
                </BottomSheet>
            )}
        </>
    )
}
