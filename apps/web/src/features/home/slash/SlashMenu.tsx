import { ArrowUpRight, Check, ChevronLeft } from 'lucide-react'
import React from 'react'

import { ShortcutRows } from './shortcuts'
import { getSlashGroupLabel } from './slashModel'

import type { SlashMenuState } from './useSlashMenu'

import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

interface SlashMenuProps {
    menu: SlashMenuState
    /** an element inside the prompt box, used to choose the side and to spot outside clicks */
    anchorRef: React.RefObject<HTMLElement | null>
    /** the session bar sits at the bottom of the screen, so its menu always opens above */
    placement?: 'auto' | 'top'
}

const rowClass =
    'flex items-center gap-3 px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#EDEDEF] outline-none w-full min-w-0 transition-colors'
const hintClass = 'ml-auto flex items-center gap-2 min-w-0 text-[12px] font-normal text-[#8F8E8D]'
const labelClass = 'px-3 pt-1.5 pb-1 text-[11.5px] font-medium text-[#8F8E8D]'

/**
 * The slash menu: a small menu under the text, like the @ menu. One line per row,
 * the name on the left and a few words on the right. Skills follow the commands
 * under small labels.
 */
export const SlashMenu: React.FC<SlashMenuProps> = ({ menu, anchorRef, placement = 'auto' }) => {
    const rootRef = React.useRef<HTMLDivElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)
    const [side, setSide] = React.useState<'top' | 'bottom'>(placement === 'top' ? 'top' : 'bottom')
    const { isOpen, dismiss, selectedIndex } = menu

    React.useLayoutEffect(() => {
        if (!isOpen || placement === 'top') return
        const box = anchorRef.current?.closest('[data-prompt-box]')
        if (!box) return
        const rect = box.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        setSide(spaceBelow < 260 && rect.top > spaceBelow ? 'top' : 'bottom')
    }, [isOpen, placement, anchorRef])

    React.useEffect(() => {
        if (!isOpen) return
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node
            if (rootRef.current?.contains(target)) return
            if (anchorRef.current?.closest('[data-prompt-box]')?.contains(target)) return
            dismiss()
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [isOpen, dismiss, anchorRef])

    React.useEffect(() => {
        if (!isOpen) return
        const active = listRef.current?.querySelector('[aria-selected="true"]')
        if (active && typeof (active as HTMLElement).scrollIntoView === 'function') {
            ;(active as HTMLElement).scrollIntoView({ block: 'nearest' })
        }
    }, [isOpen, selectedIndex])

    if (!isOpen) return null

    const { sub, items } = menu

    return (
        <div
            ref={rootRef}
            // keeps the caret in the prompt while the menu is used with the mouse
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
                'absolute left-5 z-[100] w-[280px] max-w-[calc(100vw-40px)] bg-[#1E1E1E] border border-[#2A2928] rounded-2xl p-1 shadow-lg shadow-black/40 flex flex-col font-sans animate-in fade-in zoom-in-95 duration-150',
                // under the first line of text, over the footer of the box, as the @ menu
                side === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[48px]'
            )}
        >
            {sub && (
                <button
                    type="button"
                    onClick={menu.back}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] font-medium text-[#8F8E8D] hover:text-[#D6D5D4] outline-none cursor-pointer self-start"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{sub.title}</span>
                </button>
            )}

            {sub?.text && (
                <p className="px-3 pt-1 pb-2 max-h-[220px] overflow-y-auto text-[12.5px] leading-relaxed text-[#D6D5D4] whitespace-pre-wrap">
                    {sub.text}
                </p>
            )}

            <div
                ref={listRef}
                role="listbox"
                aria-label={sub ? sub.title : 'Commands'}
                className="flex flex-col max-h-[252px] overflow-y-auto no-scrollbar [scrollbar-width:none]"
            >
                {sub
                    ? sub.options.map((option, index) => (
                          <button
                              key={option.id}
                              type="button"
                              role="option"
                              aria-selected={index === selectedIndex}
                              onMouseEnter={() => menu.setSelectedIndex(index)}
                              onClick={() => menu.selectOption(option)}
                              className={cn(
                                  rowClass,
                                  option.pick ? 'cursor-pointer' : 'cursor-default',
                                  index === selectedIndex && 'bg-[#252525]'
                              )}
                          >
                              <span className="truncate">{option.label}</span>
                              <span className={hintClass}>
                                  {option.hint && <span className="truncate">{option.hint}</span>}
                                  {option.selected && (
                                      <Check className="w-3.5 h-3.5 text-white shrink-0" />
                                  )}
                              </span>
                          </button>
                      ))
                    : items.map((item, index) => {
                          const label = getSlashGroupLabel(items, index)
                          const opensPage =
                              item.type === 'command' &&
                              (item.command.kind === 'navigate' || item.command.kind === 'external')
                          return (
                              <React.Fragment key={item.id}>
                                  {label && <div className={labelClass}>{label}</div>}
                                  <button
                                      type="button"
                                      role="option"
                                      aria-selected={index === selectedIndex}
                                      onMouseEnter={() => menu.setSelectedIndex(index)}
                                      onClick={() => menu.selectItem(item)}
                                      className={cn(
                                          rowClass,
                                          'cursor-pointer',
                                          index === selectedIndex && 'bg-[#252525]'
                                      )}
                                  >
                                      <span className="shrink-0 whitespace-nowrap">
                                          /{item.name}
                                          {item.type === 'command' && item.args && (
                                              <span className="font-normal text-[#616161]">
                                                  {' '}
                                                  {item.args}
                                              </span>
                                          )}
                                      </span>
                                      <span className={hintClass}>
                                          <span className="truncate">{item.description}</span>
                                          {opensPage && (
                                              <ArrowUpRight className="w-[13px] h-[13px] shrink-0" />
                                          )}
                                      </span>
                                  </button>
                              </React.Fragment>
                          )
                      })}

                {sub && sub.options.length === 0 && !sub.text && (
                    <div className="px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]">
                        {sub.emptyLabel || 'Nothing here.'}
                    </div>
                )}
                {!sub && items.length === 0 && (
                    <div className="px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]">
                        No commands found.
                    </div>
                )}
            </div>
        </div>
    )
}

const tabClass = (active: boolean) =>
    cn(
        'px-2.5 py-1 text-[12px] font-medium rounded-lg transition-colors outline-none cursor-pointer',
        active ? 'bg-[#282828] text-white' : 'text-[#8F8E8D] hover:text-[#D6D5C9]'
    )

/** /help and /keybindings: the commands this box can run, and the keyboard shortcuts */
export const SlashHelpPanel: React.FC<{ menu: SlashMenuState }> = ({ menu }) => {
    const [tab, setTab] = React.useState<'commands' | 'shortcuts'>('commands')
    const { helpTab } = menu

    React.useEffect(() => {
        if (helpTab) setTab(helpTab)
    }, [helpTab])

    return (
        <Modal
            isOpen={helpTab !== null}
            onClose={menu.closeHelp}
            title="Help"
            maxWidth="max-w-[420px]"
        >
            <div role="tablist" className="flex items-center gap-1 mb-3">
                {(['commands', 'shortcuts'] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() => setTab(value)}
                        className={tabClass(tab === value)}
                    >
                        {value === 'commands' ? 'Commands' : 'Shortcuts'}
                    </button>
                ))}
            </div>
            <div className="flex flex-col max-h-[320px] overflow-y-auto no-scrollbar [scrollbar-width:none]">
                {tab === 'commands' ? (
                    menu.commands.map((command) => (
                        <div
                            key={command.name}
                            className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                        >
                            <span className="font-medium text-[#EDEDEF] whitespace-nowrap">
                                /{command.name}
                                {command.args && (
                                    <span className="font-normal text-[#616161]">
                                        {' '}
                                        {command.args}
                                    </span>
                                )}
                            </span>
                            <span className="text-[#8F8E8D] truncate">{command.description}</span>
                        </div>
                    ))
                ) : (
                    <ShortcutRows />
                )}
            </div>
        </Modal>
    )
}
