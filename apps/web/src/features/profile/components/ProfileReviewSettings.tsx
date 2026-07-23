import { Search, Plus, ChevronDown } from 'lucide-react'
import React, { useState } from 'react'

export const ProfileReviewSettings: React.FC = () => {
    // Toggles state matching screenshots
    const [includeLink, setIncludeLink] = useState(true)
    const [enableSecurityScan, setEnableSecurityScan] = useState(true)
    const [postBugs, setPostBugs] = useState(true)
    const [postSecurity, setPostSecurity] = useState(true)
    const [postFlagsInvestigate, setPostFlagsInvestigate] = useState(false)
    const [postFlagsNote, setPostFlagsNote] = useState(false)
    const [postCiChecks, setPostCiChecks] = useState(true)

    // Automatic review tabs & state
    const [activeTab, setActiveTab] = useState<'Repositories' | 'Users'>('Repositories')
    const [repoSearch, setRepoSearch] = useState('')
    const [selectedMode, setSelectedMode] = useState('All modes')

    // Auto-review limits
    const [spendLimit, setSpendLimit] = useState('No limit')

    // Rules
    const [fileRuleInput, setFileRuleInput] = useState('')
    const [fileRules, setFileRules] = useState<string[]>(['**/REVIEW.md'])

    const handleAddFileRule = (e: React.FormEvent) => {
        e.preventDefault()
        if (!fileRuleInput.trim()) return
        setFileRules((prev) => [...prev, fileRuleInput.trim()])
        setFileRuleInput('')
    }

    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Section 1: PR descriptions */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">PR descriptions</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">
                        Adjust how Code Review edits pull request descriptions
                    </span>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Include a link to Code Review in the pull request description
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Includes a link to Code Review in the pull request description
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setIncludeLink(!includeLink)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                includeLink ? 'bg-[#87B2F4]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    includeLink
                                        ? 'translate-x-4 bg-[#100E12]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Section 2: Security scan */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Security scan</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">
                        Run an additional security-focused analysis phase on each PR
                    </span>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[14px] text-[#D6D5C9]">Enable security scan</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Detect vulnerabilities and security hardening opportunities
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setEnableSecurityScan(!enableSecurityScan)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                enableSecurityScan
                                    ? 'bg-[#87B2F4]'
                                    : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    enableSecurityScan
                                        ? 'translate-x-4 bg-[#100E12]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Section 3: Post as PR comments */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Post as PR comments</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">
                        Analyses from Code Review can be posted as comments to git providers
                    </span>

                    {/* Bugs */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[14px] text-[#D6D5C9]">Bugs</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Likely errors or incorrect behavior in the code
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setPostBugs(!postBugs)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                postBugs ? 'bg-[#87B2F4]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    postBugs
                                        ? 'translate-x-4 bg-[#100E12]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Security */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[14px] text-[#D6D5C9]">Security</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Vulnerabilities and security hardening suggestions
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setPostSecurity(!postSecurity)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                postSecurity ? 'bg-[#87B2F4]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    postSecurity
                                        ? 'translate-x-4 bg-[#100E12]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Flags (investigate) */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[14px] text-[#D6D5C9]">Flags (investigate)</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Potential issues worth a closer look before merging
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setPostFlagsInvestigate(!postFlagsInvestigate)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                postFlagsInvestigate
                                    ? 'bg-[#87B2F4]'
                                    : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    postFlagsInvestigate
                                        ? 'translate-x-4 bg-[#100E12]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Flags (note) */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[14px] text-[#D6D5C9]">Flags (note)</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Informational observations that may not require action
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setPostFlagsNote(!postFlagsNote)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                postFlagsNote ? 'bg-[#87B2F4]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    postFlagsNote
                                        ? 'translate-x-4 bg-[#100E12]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Section 4: Post GitHub CI checks */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Post GitHub CI checks</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Post GitHub CI checks
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Creates a commit status check on the PR for each review
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => setPostCiChecks(!postCiChecks)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                postCiChecks ? 'bg-[#87B2F4]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    postCiChecks
                                        ? 'translate-x-4 bg-[#100E12]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Section 5: Automatic review */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Automatic review</h1>
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79] leading-relaxed">
                        PRs are reviewed automatically when submitted to an enrolled repository or
                        authored by an enrolled user. If both apply and their settings differ, the
                        one that triggers more reviews takes effect. Users can self-enroll in
                        personal settings.
                    </span>

                    {/* Top Control Bar: Tabs + Add Repo Button */}
                    <div className="flex items-center justify-between gap-3 mt-1">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveTab('Repositories')}
                                className={`px-3 py-1 rounded-lg text-[12.5px] font-medium transition-colors flex items-center gap-1.5 ${
                                    activeTab === 'Repositories'
                                        ? 'bg-[#202020] text-white border border-[#282828]'
                                        : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#202020]'
                                }`}
                            >
                                <span>Repositories</span>
                                <span className="text-[11px] opacity-70">0</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('Users')}
                                className={`px-3 py-1 rounded-lg text-[12.5px] font-medium transition-colors flex items-center gap-1.5 ${
                                    activeTab === 'Users'
                                        ? 'bg-[#202020] text-white border border-[#282828]'
                                        : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#202020]'
                                }`}
                            >
                                <span>Self-enrolled users</span>
                                <span className="text-[11px] opacity-70">0</span>
                            </button>
                        </div>

                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer">
                            Add repo
                        </button>
                    </div>

                    {/* Search & Filter Mode Row */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-[280px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                            <input
                                type="text"
                                placeholder="Search repositories..."
                                value={repoSearch}
                                onChange={(e) => setRepoSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-[#202020] border border-[#282828] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none focus:border-[#5A5A5A] transition-colors"
                            />
                        </div>

                        <div className="relative shrink-0">
                            <select
                                value={selectedMode}
                                onChange={(e) => setSelectedMode(e.target.value)}
                                className="appearance-none bg-[#202020] border border-[#282828] rounded-lg px-3 py-1.5 pr-8 text-[12.5px] font-medium text-[#D6D5C9] focus:outline-none focus:border-[#5A5A5A] cursor-pointer"
                            >
                                <option value="All modes">All modes</option>
                                <option value="Automatic">Automatic</option>
                                <option value="Manual">Manual</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7B7A79] pointer-events-none" />
                        </div>
                    </div>

                    {/* Empty Repositories Box */}
                    <div className="bg-[#191919] border border-[#242323] rounded-xl p-12 flex flex-col items-center justify-center gap-1.5 text-center">
                        <h3 className="text-[14px] font-medium text-white">
                            No repositories configured
                        </h3>
                        <p className="text-[13px] text-[#7B7A79]">
                            Click &quot;Add repo&quot; to add repositories
                        </p>
                    </div>
                </div>
            </div>

            {/* Section 6: Auto-review limits */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Auto-review limits</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">
                        Limit how much Code Review spends on automatic reviews
                    </span>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[70%]">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Per-PR on-demand spend limit
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Skips future auto-reviews on a PR once its total on-demand spend
                                hits this limit.
                            </span>
                        </div>

                        <div className="flex items-center gap-2 bg-[#202020] border border-[#282828] rounded-lg px-3 py-1.5 text-[13px]">
                            <span className="text-[#7B7A79]">$</span>
                            <input
                                type="text"
                                value={spendLimit}
                                onChange={(e) => setSpendLimit(e.target.value)}
                                className="bg-transparent text-[#D6D5C9] font-medium w-[80px] focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 7: Rules */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-3 text-white">Rules</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-4">
                    <span className="text-[13px] text-[#7B7A79]">
                        Add context to help Code Review find bugs
                    </span>

                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-0.5">
                            <h3 className="text-[14px] font-medium text-[#D6D5C9]">Files</h3>
                            <p className="text-[13px] text-[#7B7A79]">
                                Prioritized by proximity to changed files.{' '}
                                <span className="underline cursor-pointer">
                                    Common file patterns ⓘ
                                </span>{' '}
                                are read automatically
                            </p>
                        </div>

                        {/* Rule Input Form */}
                        <form onSubmit={handleAddFileRule} className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="e.g. docs/**/*.md"
                                value={fileRuleInput}
                                onChange={(e) => setFileRuleInput(e.target.value)}
                                className="flex-1 bg-[#202020] border border-[#282828] rounded-lg px-3.5 py-1.5 text-[13px] font-mono text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none focus:border-[#5A5A5A] transition-colors"
                            />
                            <button
                                type="submit"
                                className="px-3.5 py-1.5 rounded-lg border border-[#282828] bg-[#202020] hover:bg-[#282828] text-[12.5px] font-medium text-[#D6D5C9] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                            </button>
                        </form>

                        {/* Rules List */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-[#242323]">
                            {fileRules.map((rule, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between py-1 px-1 font-mono text-[12.5px] text-[#D6D5C9]"
                                >
                                    <span>{rule}</span>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-sans text-[#7B7A79] bg-[#202020] border border-[#282828]">
                                        Default
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
