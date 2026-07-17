import React from 'react'

interface SessionStatusHeaderProps {
    sessionName: string
    vmStatus: 'PROVISIONING' | 'RUNNING' | 'STOPPED' | 'FAILED'
    onStart: () => void
    onStop: () => void
}

export const SessionStatusHeader: React.FC<SessionStatusHeaderProps> = ({
    sessionName,
    vmStatus,
    onStart,
    onStop,
}) => {
    return (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-white select-none">
            <div className="flex items-center space-x-4">
                <h1 className="text-sm font-semibold truncate max-w-[200px]" title={sessionName}>
                    {sessionName}
                </h1>

                <div className="flex items-center space-x-2 bg-gray-800 px-2.5 py-1 rounded-md border border-gray-700">
                    <div
                        className={`w-2 h-2 rounded-full ${
                            vmStatus === 'RUNNING'
                                ? 'bg-green-500 animate-pulse'
                                : vmStatus === 'PROVISIONING'
                                  ? 'bg-blue-500 animate-pulse'
                                  : vmStatus === 'FAILED'
                                    ? 'bg-red-500'
                                    : 'bg-gray-500'
                        }`}
                    />
                    <span className="text-xs font-medium text-gray-300">{vmStatus}</span>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                {vmStatus === 'STOPPED' || vmStatus === 'FAILED' ? (
                    <button
                        onClick={onStart}
                        className="flex items-center space-x-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                    >
                        <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span>Start VM</span>
                    </button>
                ) : (
                    <button
                        onClick={onStop}
                        disabled={vmStatus === 'PROVISIONING'}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            vmStatus === 'PROVISIONING'
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                    >
                        <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                            />
                        </svg>
                        <span>Stop VM</span>
                    </button>
                )}
            </div>
        </div>
    )
}
