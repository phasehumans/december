import { Search, RotateCw, Check, ChevronDown } from 'lucide-react'
import React, { useState } from 'react'

interface RepositoryIndexItem {
    id: string
    name: string
    owner: string
    indexedBranchesCount: number
}

const INITIAL_REPOS: RepositoryIndexItem[] = [
    {
        id: 'repo-1',
        name: 'december',
        owner: 'phasehumans',
        indexedBranchesCount: 1,
    },
    {
        id: 'repo-2',
        name: 'hotel-booking-system',
        owner: 'phasehumans',
        indexedBranchesCount: 1,
    },
]

const ALL_LANGUAGES = [
    'English',
    'Spanish',
    'Portuguese',
    'Japanese',
    'Chinese',
    'Korean',
    'French',
    'German',
    'Russian',
    'Arabic',
    'Hebrew',
    'Indonesian',
]

export const ProfileWikiSettings: React.FC = () => {
    // Generation settings state
    const [effort, setEffort] = useState('Low')
    const [frequency, setFrequency] = useState('Weekly')

    // Languages state
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English'])

    // Repositories state
    const [repos] = useState<RepositoryIndexItem[]>(INITIAL_REPOS)
    const [searchQuery, setSearchQuery] = useState('')
    const [isRefreshing, setIsRefreshing] = useState(false)

    const toggleLanguage = (lang: string) => {
        setSelectedLanguages((prev) =>
            prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
        )
    }

    const handleRefresh = () => {
        setIsRefreshing(true)
        setTimeout(() => setIsRefreshing(false), 1200)
    }

    const filteredRepos = repos.filter(
        (r) =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.owner.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Section 1: Generation */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Generation</h1>
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">
                        Configure how DeepWiki indexes your repository source code for Wiki and Ask
                        Agent
                    </span>

                    <div className="bg-[#191919] border border-[#242323] rounded-xl divide-y divide-[#242323] overflow-hidden">
                        {/* Effort Row */}
                        <div className="p-4 flex items-center justify-between hover:bg-[#202020] transition-colors">
                            <div className="flex flex-col gap-0.5 max-w-[70%]">
                                <span className="text-[13.5px] font-medium text-white">Effort</span>
                                <span className="text-[12.5px] text-[#7B7A79]">
                                    Higher effort generates better quality at greater cost
                                </span>
                            </div>

                            <div className="relative shrink-0">
                                <select
                                    value={effort}
                                    onChange={(e) => setEffort(e.target.value)}
                                    className="appearance-none bg-[#202020] border border-[#282828] rounded-lg px-3 py-1.5 pr-8 text-[12.5px] font-medium text-[#D6D5C9] focus:outline-none focus:border-[#5A5A5A] cursor-pointer min-w-[110px]"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7B7A79] pointer-events-none" />
                            </div>
                        </div>

                        {/* Frequency Row */}
                        <div className="p-4 flex items-center justify-between hover:bg-[#202020] transition-colors">
                            <div className="flex flex-col gap-0.5 max-w-[70%]">
                                <span className="text-[13.5px] font-medium text-white">
                                    Frequency
                                </span>
                                <span className="text-[12.5px] text-[#7B7A79]">
                                    How often wikis are regenerated to reflect code changes
                                </span>
                            </div>

                            <div className="relative shrink-0">
                                <select
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value)}
                                    className="appearance-none bg-[#202020] border border-[#282828] rounded-lg px-3 py-1.5 pr-8 text-[12.5px] font-medium text-[#D6D5C9] focus:outline-none focus:border-[#5A5A5A] cursor-pointer min-w-[110px]"
                                >
                                    <option value="Weekly">Weekly</option>
                                    <option value="Daily">Daily</option>
                                    <option value="Monthly">Monthly</option>
                                    <option value="On push">On push</option>
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7B7A79] pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Languages */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Languages</h1>
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">Configure language settings</span>

                    <div className="bg-[#191919] border border-[#242323] hover:border-[#313131] rounded-xl p-4 flex flex-col gap-3.5 transition-colors">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[13.5px] font-medium text-white">
                                Selected languages
                            </span>
                            <span className="text-[12.5px] text-[#7B7A79]">
                                Choose which languages DeepWiki content is generated in
                            </span>
                        </div>

                        {/* 3-Column Checkbox Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-4 pt-1">
                            {ALL_LANGUAGES.map((lang) => {
                                const isChecked = selectedLanguages.includes(lang)
                                return (
                                    <label
                                        key={lang}
                                        onClick={() => toggleLanguage(lang)}
                                        className="flex items-center gap-2.5 text-[13px] text-[#D6D5C9] cursor-pointer group"
                                    >
                                        <div
                                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                isChecked
                                                    ? 'bg-[#87B2F4] border-[#87B2F4] text-[#100E12]'
                                                    : 'border-[#383736] bg-[#202020] group-hover:border-[#5A5A5A]'
                                            }`}
                                        >
                                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <span>{lang}</span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 3: Repositories */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Repositories</h1>
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">
                        Choose repositories to index for DeepWiki and Ask Agent
                    </span>

                    <div className="bg-[#191919] border border-[#242323] rounded-xl p-4 flex flex-col gap-4">
                        {/* Toolbar: Search input + Sync button + Add button */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-[320px]">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                                <input
                                    type="text"
                                    placeholder="Search repositories..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-[#202020] border border-[#282828] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none focus:border-[#5A5A5A] transition-colors"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleRefresh}
                                    className="p-1.5 rounded-lg border border-[#282828] bg-[#202020] hover:bg-[#282828] text-[#D6D5C9] hover:text-white transition-colors cursor-pointer"
                                    title="Refresh index status"
                                >
                                    <RotateCw
                                        className={`w-4 h-4 text-[#7B7A79] ${
                                            isRefreshing ? 'animate-spin text-[#87B2F4]' : ''
                                        }`}
                                    />
                                </button>

                                <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer">
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Repositories List */}
                        <div className="flex flex-col divide-y divide-[#242323] pt-1">
                            {filteredRepos.map((repo) => (
                                <div
                                    key={repo.id}
                                    className="flex items-center justify-between py-3 px-1 hover:bg-[#202020] rounded-lg transition-colors"
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[13.5px] font-medium text-white font-mono">
                                            {repo.name}
                                        </span>
                                        <span className="text-[12px] text-[#7B7A79]">
                                            {repo.owner}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[12.5px] text-[#34D399] font-medium">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{repo.indexedBranchesCount} branch indexed</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
