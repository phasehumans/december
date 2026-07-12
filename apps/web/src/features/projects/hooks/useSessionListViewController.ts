import React from 'react'

export const useSessionListViewController = (projectCount: number) => {
    const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null)
    const [dropdownDirection, setDropdownDirection] = React.useState<'down' | 'up'>('down')
    const [visibleCount, setVisibleCount] = React.useState(10)
    const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list')
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    const toggleDropdown = (type: string, event: React.MouseEvent<HTMLButtonElement>) => {
        if (activeDropdown === type) {
            setActiveDropdown(null)
            return
        }
        const rect = event.currentTarget.getBoundingClientRect()
        if (window.innerHeight - rect.bottom < 250 && rect.top > 250) {
            setDropdownDirection('up')
        } else {
            setDropdownDirection('down')
        }
        setActiveDropdown(type)
    }

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useEffect(() => {
        setVisibleCount(10)
    }, [projectCount])

    const loadMore = () => {
        setVisibleCount((prev) => Math.min(prev + 10, projectCount))
    }

    return {
        activeDropdown,
        setActiveDropdown,
        dropdownDirection,
        visibleCount,
        viewMode,
        setViewMode,
        dropdownRef,
        toggleDropdown,
        loadMore,
    }
}
