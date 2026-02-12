import React from 'react'

interface SettingsInputProps {
  label: string
  defaultValue: string
}

export const SettingsInput: React.FC<SettingsInputProps> = ({
  label,
  defaultValue,
}) => (
  <div className="group">
    <label className="text-xs text-neutral-500 font-medium mb-2 block group-focus-within:text-white transition-colors pl-1">
      {label}
    </label>
    <input
      defaultValue={defaultValue}
      className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 focus:bg-[#0c0c0e] transition-all placeholder-neutral-700 font-sans shadow-sm"
    />
  </div>
)
