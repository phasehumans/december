import { motion } from 'framer-motion'
import React, { useRef, useState } from 'react'

import { Icons } from '@/shared/components/ui/Icons'

interface UploadProjectFormProps {
    onClose: () => void
    onUpload?: (file: File) => Promise<void> | void
    isImporting?: boolean
    importMessage?: string | null
    importError?: string | null
}

export const UploadProjectForm: React.FC<UploadProjectFormProps> = ({
    onClose,
    onUpload,
    isImporting = false,
    importMessage,
    importError,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        if (e.dataTransfer.files.length > 0) {
            setSelectedFiles([e.dataTransfer.files[0]!])
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
            setSelectedFiles([e.target.files[0]!])
        }
    }

    const handleSubmit = () => {
        const file = selectedFiles[0]

        if (file) {
            onUpload?.(file)
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
            className="w-full max-w-[638px] mt-3 rounded-[14px] bg-[#171615] border border-[#242322]"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#242322] rounded-t-[13px]">
                <div className="flex items-center gap-2.5">
                    <Icons.FolderUp className="w-[16px] h-[16px] text-[#989796]" />
                    <span className="text-[13px] font-medium text-[#989796]">Upload Project</span>
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
                {selectedFiles.length === 0 ? (
                    /* Drop Zone */
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`
                            relative flex flex-col items-center justify-center gap-2.5 px-6
                            rounded-[12px] border-2 border-dashed cursor-pointer
                            transition-all duration-200 ease-out h-[160px]
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
                                Drop your project zip here
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
                            accept=".zip,application/zip,application/x-zip-compressed"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                ) : (
                    /* Selected State */
                    <div className="relative flex flex-col justify-center px-6 rounded-[12px] border-2 border-dashed border-[#2E2D2C] h-[160px]">
                        <div className="flex flex-col items-center justify-center gap-3">
                            <div className="flex flex-col items-center gap-1 mt-1">
                                <div className="flex items-center gap-2">
                                    <Icons.FolderUp className="w-[15px] h-[15px] text-[#A1A1AA]" />
                                    <span className="text-[14px] font-medium text-[#D6D5D4] max-w-[200px] truncate">
                                        {selectedFiles[0]?.name || 'Project.zip'}
                                    </span>
                                </div>
                                <p className="text-[12px] text-[#656565]">
                                    {selectedFiles[0]
                                        ? formatFileSize(selectedFiles[0].size)
                                        : 'Ready to upload'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    onClick={() => setSelectedFiles([])}
                                    disabled={isImporting}
                                    className="h-[36px] px-4 rounded-[10px] bg-[#252422] hover:bg-[#2E2D2C] text-[#A1A1AA] text-[13px] font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isImporting}
                                    className="h-[36px] px-6 rounded-[10px] bg-[#D6D5D4] hover:bg-[#EAE9E8] text-[#111] text-[13px] font-semibold transition-all"
                                >
                                    {isImporting ? 'Importing' : 'Upload Project'}
                                </button>
                            </div>
                            {(importError || importMessage) && (
                                <p className="text-[12px] text-[#656565] mt-1 max-w-[420px] truncate">
                                    {importError || importMessage}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
