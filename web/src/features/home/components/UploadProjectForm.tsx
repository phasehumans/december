import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { Icons } from '@/shared/components/ui/Icons'

interface UploadProjectFormProps {
    onClose: () => void
    onUpload?: (files: FileList) => void
}

export const UploadProjectForm: React.FC<UploadProjectFormProps> = ({ onClose, onUpload }) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        if (e.dataTransfer.files.length > 0) {
            setSelectedFiles(Array.from(e.dataTransfer.files))
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = () => {
        setIsDragOver(false)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFiles(Array.from(e.target.files))
        }
    }

    const handleSubmit = () => {
        if (selectedFiles.length > 0 && fileInputRef.current?.files) {
            onUpload?.(fileInputRef.current.files)
        }
    }

    const removeFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[638px] mt-3 rounded-[14px] bg-[#1A1918] border border-[#2E2D2C] overflow-hidden shadow-xl shadow-black/30"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2E2D2C]">
                <div className="flex items-center gap-2.5">
                    <Icons.FolderUp className="w-[16px] h-[16px] text-[#A1A1AA]" />
                    <span className="text-[13px] font-medium text-[#D6D5D4]">Upload Project</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-[#656565] hover:text-[#A1A1AA] transition-colors p-1 rounded-md hover:bg-white/5"
                >
                    <Icons.X className="w-[14px] h-[14px]" />
                </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3.5">
                {/* Drop Zone */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
                        relative flex flex-col items-center justify-center gap-2.5 py-5 px-6
                        rounded-[12px] border-2 border-dashed cursor-pointer
                        transition-all duration-200 ease-out
                        ${
                            isDragOver
                                ? 'border-[#E5E5E5]/40 bg-white/[0.03]'
                                : 'border-[#2E2D2C] hover:border-[#454443] hover:bg-white/[0.015]'
                        }
                    `}
                >
                    <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isDragOver ? 'bg-white/10' : 'bg-[#252422]'}`}
                    >
                        <Icons.FolderUp
                            className={`w-[17px] h-[17px] transition-colors ${isDragOver ? 'text-[#D6D5D4]' : 'text-[#656565]'}`}
                        />
                    </div>
                    <div className="text-center">
                        <p className="text-[13px] font-medium text-[#D6D5D4] mb-0.5">
                            Drop your project folder here
                        </p>
                        <p className="text-[12px] text-[#4A4A4A]">
                            or{' '}
                            <span className="text-[#A1A1AA] underline underline-offset-2 decoration-[#4A4A4A]">
                                browse files
                            </span>
                        </p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        // @ts-ignore - webkitdirectory is not in the standard types
                        webkitdirectory=""
                        directory=""
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>

                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                    <div className="mt-4 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] text-[#656565]">
                                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}{' '}
                                selected
                            </span>
                            <button
                                onClick={() => setSelectedFiles([])}
                                className="text-[11px] text-[#4A4A4A] hover:text-[#A1A1AA] transition-colors"
                            >
                                Clear all
                            </button>
                        </div>
                        <div className="max-h-[100px] overflow-y-auto no-scrollbar rounded-[10px] border border-[#2E2D2C] bg-[#141312] divide-y divide-[#2E2D2C]">
                            {selectedFiles.slice(0, 20).map((file, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between px-3.5 py-2 group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Icons.Code className="w-[12px] h-[12px] text-[#4A4A4A] shrink-0" />
                                        <span className="text-[12px] text-[#A1A1AA] truncate">
                                            {file.webkitRelativePath || file.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[11px] text-[#4A4A4A]">
                                            {formatFileSize(file.size)}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                removeFile(i)
                                            }}
                                            className="text-[#4A4A4A] hover:text-[#A1A1AA] transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Icons.X className="w-[12px] h-[12px]" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {selectedFiles.length > 20 && (
                                <div className="px-3.5 py-2 text-[11px] text-[#4A4A4A]">
                                    +{selectedFiles.length - 20} more files
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            className="w-full h-[40px] rounded-[10px] bg-[#E5E5E5] hover:bg-white text-[#111] text-[13px] font-medium transition-colors mt-2"
                        >
                            Upload Project
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
