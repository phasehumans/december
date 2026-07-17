import React from 'react'

export interface AgentLogEvent {
    type: string
    thought?: string
    tool?: string
    parameters?: any
    output?: string
    timestamp: number
}

interface ActivityLogProps {
    events: AgentLogEvent[]
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ events }) => {
    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-300 p-4 overflow-y-auto font-mono text-sm">
            <h2 className="text-lg font-bold text-white mb-4">Activity Log</h2>
            <div className="flex flex-col space-y-4">
                {events.map((evt, idx) => (
                    <div key={idx} className="bg-gray-800 p-3 rounded-md border border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">
                            {new Date(evt.timestamp).toLocaleTimeString()} - {evt.type}
                        </div>
                        {evt.thought && (
                            <div className="text-gray-400 italic mb-2">💭 {evt.thought}</div>
                        )}
                        {evt.tool && (
                            <div className="text-blue-400 font-semibold">🛠 {evt.tool}</div>
                        )}
                        {evt.parameters && (
                            <pre className="text-green-400 mt-1 bg-gray-950 p-2 rounded text-xs overflow-x-auto">
                                {JSON.stringify(evt.parameters, null, 2)}
                            </pre>
                        )}
                        {evt.output && (
                            <pre className="text-gray-300 mt-2 bg-gray-950 p-2 rounded border border-gray-700 text-xs overflow-x-auto max-h-40">
                                {evt.output}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
