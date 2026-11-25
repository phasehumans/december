/** saves a fetched file with this name. the link lives only for the click */
export const downloadBlob = (blob: Blob, fileName: string): void => {
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
}
