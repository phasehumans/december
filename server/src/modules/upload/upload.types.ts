import type { PreviewManifestFile } from '../../shared/preview-manifest'

export type UploadedZipFile = {
    originalname: string
    mimetype: string
    buffer: Buffer
}

export type ImportFromGithub = {
    userId: string
    repoURL: string
}

export type ImportFromZip = {
    userId: string
    zipFile: UploadedZipFile
}

export type GetImportStatus = {
    userId: string
    importId: string
}

export type ImportSource = 'GITHUB' | 'ZIP'

export type ImportStatus =
    | 'PENDING'
    | 'VALIDATING'
    | 'UPLOADING'
    | 'STARTING_RUNTIME'
    | 'READY'
    | 'FAILED'

export type GithubRepo = {
    id: number
    name: string
    fullName: string
    private: boolean
    defaultBranch: string
    updatedAt: string
    htmlUrl: string
    cloneUrl: string
    owner: {
        login: string
        avatarUrl: string
    }
}

export type ImportValidationFile = {
    absolutePath: string
    path: string
    size: number
    contentType: string
    sha256: string
}

export type ProjectDetection = {
    framework: string
    packageJson: Record<string, any>
}

export type ValidatedImportProject = {
    rootDir: string
    files: ImportValidationFile[]
    totalBytes: number
    detection: ProjectDetection
    isValid: boolean
    validationError?: string | null
}

export type DownloadedGitHubRepoArchive =
    | {
          ok: true
          owner: string
          repo: string
          ref: string | null
          zipUrl: string
          tempRootDir: string
          zipFilePath: string
          extractDir: string
          repoRootDir: string
      }
    | {
          ok: false
          error: string
          code:
              | 'DOWNLOAD_FAILED'
              | 'UNAUTHORIZED'
              | 'RATE_LIMITED'
              | 'NETWORK_ERROR'
              | 'EXTRACT_FAILED'
              | 'EMPTY_ARCHIVE'
      }

export type ExtractedUploadedZipArchive =
    | {
          ok: true
          owner: string
          repo: string
          ref: string | null
          zipUrl: null
          tempRootDir: string
          zipFilePath: string
          extractDir: string
          repoRootDir: string
      }
    | {
          ok: false
          error: string
          code: 'INVALID_FILE' | 'SAVE_FAILED' | 'EXTRACT_FAILED' | 'EMPTY_ARCHIVE'
      }

export type ParsedGitHubRepo =
    | {
          ok: true
          owner: string
          repo: string
          normalizedUrl: string
      }
    | {
          ok: false
          error: string
          code: 'EMPTY_INPUT' | 'INVALID_URL' | 'NOT_GITHUB' | 'NOT_REPO_URL'
      }

export type VerifiedGitHubRepoAccess =
    | {
          ok: true
          owner: string
          repo: string
          normalizedUrl: string
          cloneUrl: string
          defaultBranch: string | null
          archived: boolean
          disabled: boolean
          visibility: 'public' | 'private'
          canAccess: true
      }
    | {
          ok: false
          error: string
          code: 'NOT_FOUND_OR_NO_ACCESS' | 'RATE_LIMITED' | 'GITHUB_API_ERROR' | 'NETWORK_ERROR'
      }

export type UpdateImportStatusParams = {
    importId: string
    status: ImportStatus
    data?: Record<string, any>
}

export type CreateImportRecordParams = {
    userId: string
    sourceType: ImportSource
    sourceUrl?: string | null
    sourceFileName?: string | null
    projectId?: string | null
    projectVersionId?: string | null
}

export type UploadValidatedProjectParams = {
    projectId: string
    versionId: string
    project: ValidatedImportProject
}

export type UploadImportSourceFilesParams = {
    userId: string
    importId: string
    project: ValidatedImportProject
}

export type CreatePlaceholderProjectParams = {
    projectId: string
    versionId: string
    userId: string
    name: string
    prompt: string
}

export type UpdateImportedProjectVersionParams = {
    projectId: string
    versionId: string
    project: ValidatedImportProject
    manifestFiles: PreviewManifestFile[]
    sourceType: 'github' | 'zip'
    sourceLabel?: string
}

export type StartRuntimeForImportParams = {
    userId: string
    projectId: string
    versionId: string
}

export type FinalizeImportProjectParams = {
    importId: string
    userId: string
    projectId: string
    versionId: string
    validatedProject: ValidatedImportProject
    sourceType: 'github' | 'zip'
    sourceLabel?: string
}

export type ProcessGithubImportParams = {
    importId: string
    userId: string
    projectId: string
    versionId: string
    owner: string
    repo: string
    token: string
}

export type ProcessZipImportParams = {
    importId: string
    userId: string
    projectId: string
    versionId: string
    zipFile: UploadedZipFile
}

export type FailImportParams = {
    importId: string
    error: unknown
}

export type PersistentImportSourceDir = {
    userId: string
    importId: string
}

export type PersistImportSourceLocally = {
    userId: string
    importId: string
    sourceDir: string
}
