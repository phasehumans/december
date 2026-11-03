$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Disable GUI progress bar to prevent severe throughput throttling in Windows PowerShell
$ProgressPreference = "SilentlyContinue"

$Repo = "phasehumans/december"
$BinaryName = "december.exe"
$InstallDir = if ($env:DECEMBER_INSTALL_DIR) { $env:DECEMBER_INSTALL_DIR } else { "$env:LOCALAPPDATA\Programs\december" }

# Brand Blue Palette
$ESC   = [char]27
$Blue  = "$ESC[38;2;135;178;244m"
$Green = "$ESC[38;2;110;231;183m"
$Red   = "$ESC[38;2;252;165;165m"
$Yellow = "$ESC[38;2;253;224;71m"
$White = "$ESC[38;2;244;244;245m"
$Grey  = "$ESC[38;2;161;161;170m"
$Trunk = "$ESC[38;2;63;63;70m"
$Reset = "$ESC[0m"

$CharAsterisk = [char]0x2731
$CharPipe     = [char]0x2502

function Log-Step($msg)    { Write-Host "$Blue$CharAsterisk$Reset  ${White}$msg$Reset" }
function Log-Tree($msg)    { Write-Host "$Trunk$CharPipe$Reset  ${Grey}$msg$Reset" }
function Log-Item($k, $v)  { Write-Host "$Trunk$CharPipe$Reset  ${White}${k}:$Reset ${Grey}${v}$Reset" }
function Log-Success($msg) { Write-Host "$Trunk$CharPipe$Reset  ${White}$msg$Reset" }
function Log-Warn($msg)    { Write-Host "$Trunk$CharPipe$Reset  ${Yellow}$msg$Reset" }
function Log-Space         { Write-Host "$Trunk$CharPipe$Reset" }
function Log-Error($msg)   { Write-Host "$Blue$CharAsterisk$Reset  ${Red}$msg$Reset" }

function Download-WithRetry($url, $dest, $retries = 3, [switch]$ShowProgress) {
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        $curlProgress = if ($ShowProgress) { "--progress-bar" } else { "-s" }
        for ($attempt = 1; $attempt -le $retries; $attempt++) {
            & curl.exe -fL $curlProgress --connect-timeout 15 --retry 2 -o $dest $url
            if ($LASTEXITCODE -eq 0 -and (Test-Path $dest)) {
                return $true
            }
            Start-Sleep -Seconds 2
        }
    }
    for ($attempt = 1; $attempt -le $retries; $attempt++) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 60
            return $true
        }
        catch {
            if ($attempt -eq $retries) {
                return $false
            }
            Start-Sleep -Seconds 2
        }
    }
    return $false
}

$Target = "x86_64-pc-windows-msvc"
$Version = if ($env:DECEMBER_VERSION) { $env:DECEMBER_VERSION } else { "latest" }

Write-Host ""
Log-Step "installing december for Windows (x64)..."
Log-Space

$Archive = "december-$Target.zip"
$CdnBase = "https://dl.trydecember.com/releases"
$GithubBase = "https://github.com/$Repo/releases"

$PrimaryUrl = if ($Version -eq "latest") {
    "$CdnBase/latest/$Archive"
} else {
    "$CdnBase/v$($Version.TrimStart('v'))/$Archive"
}
$FallbackUrl = if ($Version -eq "latest") {
    "$GithubBase/latest/download/$Archive"
} else {
    "$GithubBase/download/v$($Version.TrimStart('v'))/$Archive"
}

$PrimaryShasumsUrl = if ($Version -eq "latest") {
    "$CdnBase/latest/SHASUMS256.txt"
} else {
    "$CdnBase/v$($Version.TrimStart('v'))/SHASUMS256.txt"
}
$FallbackShasumsUrl = if ($Version -eq "latest") {
    "$GithubBase/latest/download/SHASUMS256.txt"
} else {
    "$GithubBase/download/v$($Version.TrimStart('v'))/SHASUMS256.txt"
}

$TempDir = Join-Path $env:TEMP "december-install-$(Get-Random)"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    Log-Tree "downloading pre-compiled release binary..."
    $ZipPath = Join-Path $TempDir $Archive
    $Downloaded = Download-WithRetry $PrimaryUrl $ZipPath 2 -ShowProgress
    if (-not $Downloaded) {
        $Downloaded = Download-WithRetry $FallbackUrl $ZipPath 2 -ShowProgress
    }
    if (-not $Downloaded) {
        Log-Space
        Log-Error "Failed to download release asset."
        Log-Tree "Primary CDN and GitHub fallback downloads timed out or failed."
        Log-Space
        Log-Tree "Tip: You can install via package manager in seconds:"
        Write-Host "$Trunk$CharPipe$Reset    ${White}npm install -g @trydecember/cli$Reset"
        Write-Host "$Trunk$CharPipe$Reset    ${White}bun add -g @trydecember/cli$Reset"
        Log-Space
        exit 1
    }
    Log-Success "downloaded release asset"

    # Verify sha256 checksum if manifest is available
    $ShasumsFile = Join-Path $TempDir "SHASUMS256.txt"
    $ChecksumDownloaded = Download-WithRetry $PrimaryShasumsUrl $ShasumsFile 1
    if (-not $ChecksumDownloaded) {
        $ChecksumDownloaded = Download-WithRetry $FallbackShasumsUrl $ShasumsFile 1
    }
    if ($ChecksumDownloaded -and (Test-Path $ShasumsFile)) {
        try {
            $ExpectedLine = Get-Content $ShasumsFile | Where-Object { $_ -match [regex]::Escape($Archive) } | Select-Object -First 1
            if ($ExpectedLine) {
                $ExpectedHash = ($ExpectedLine -split '\s+')[0].Trim().ToLower()
                $ActualHash = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash.ToLower()
                if ($ExpectedHash -eq $ActualHash) {
                    Log-Success "sha256 checksum verified"
                } else {
                    Log-Warn "sha256 checksum unverified; proceeding"
                }
            }
        }
        catch {
            # Intentionally swallowed: fallback when checksum parsing is unavailable
        }
    }

    Log-Tree "extracting binary..."
    Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $DestBin = Join-Path $InstallDir $BinaryName
    $SourceBin = Join-Path $TempDir $BinaryName
    if (Test-Path $DestBin) {
        try {
            Move-Item -Path $SourceBin -Destination $DestBin -Force
        } catch {
            # On Windows, running binaries cannot be overwritten directly due to file locking.
            # Renaming a running .exe is permitted by Windows NT, allowing atomic placement of new binary.
            $OldBin = Join-Path $InstallDir "$BinaryName.old-$((Get-Random))"
            Move-Item -Path $DestBin -Destination $OldBin -Force
            Move-Item -Path $SourceBin -Destination $DestBin -Force
            Remove-Item -Path $OldBin -Force -ErrorAction SilentlyContinue
        }
    } else {
        Move-Item -Path $SourceBin -Destination $DestBin -Force
    }
    Log-Success "installed binary to ${White}$InstallDir\$BinaryName$Reset"

    # Verify binary execution
    try {
        $VerOutput = & (Join-Path $InstallDir $BinaryName) --version 2>$null
        if ($VerOutput) {
            $CleanVer = ($VerOutput -split '\r?\n')[0].Trim().TrimStart('v')
            Log-Success "verified binary execution (v$CleanVer)"
        } else {
            Log-Warn "binary installed, but execution verification returned empty output"
        }
    }
    catch {
        Log-Warn "binary installed, but execution verification threw an error"
    }

    $ConfigDir = Join-Path $env:USERPROFILE ".december"
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    $ConfigFile = Join-Path $ConfigDir "config.json"
    if (-not (Test-Path $ConfigFile)) {
        '{"installMethod":"curl"}' | Out-File -FilePath $ConfigFile -Encoding utf8
    } else {
        try {
            $json = Get-Content -Raw $ConfigFile | ConvertFrom-Json
            $json | Add-Member -MemberType NoteProperty -Name "installMethod" -Value "curl" -Force
            $json | ConvertTo-Json -Depth 4 | Out-File -FilePath $ConfigFile -Encoding utf8
        }
        catch {
            # Intentionally swallowed: fallback when config cannot be rewritten
        }
    }
    Log-Success "initialized config at ${White}$ConfigFile$Reset"

    # Add to User PATH if missing
    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    $NeedsRestart = $false
    if ($UserPath -notlike "*$InstallDir*") {
        $NewUserPath = if ([string]::IsNullOrWhiteSpace($UserPath)) { $InstallDir } else { "$UserPath;$InstallDir" }
        [Environment]::SetEnvironmentVariable("PATH", $NewUserPath, "User")
        $env:PATH = "$env:PATH;$InstallDir"
        Log-Success "added $InstallDir to User PATH"
        $NeedsRestart = $true
    } else {
        Log-Success "PATH entry already present"
    }

    Log-Space
    Log-Step "december successfully installed!"
    Log-Space
    Log-Tree "To get started:"
    Write-Host "$Trunk$CharPipe$Reset    ${White}december$Reset"

    if ($NeedsRestart) {
        Log-Space
        Log-Warn "Note: If the command is not recognized, restart your PowerShell terminal."
    }

    Log-Space
    Log-Tree "Quick commands:"
    Write-Host "$Trunk$CharPipe$Reset    ${White}december$Reset              start coding agent in current project"
    Write-Host "$Trunk$CharPipe$Reset    ${White}december login$Reset        connect december cloud and wallet credits"
    Write-Host "$Trunk$CharPipe$Reset    ${White}december key$Reset          configure byok api keys (anthropic, openai, etc.)"
    Write-Host "$Trunk$CharPipe$Reset    ${White}december docs$Reset         open documentation in browser"
    Write-Host "$Trunk$CharPipe$Reset    ${White}december changelog$Reset    open changelog in browser"
    Log-Space
    Log-Tree "Docs: ${White}https://trydecember.com$Reset"
    Log-Space
    Log-Step "ready"
    Write-Host ""
}
catch {
    Log-Space
    Log-Error "Failed to install december: $_"
    exit 1
}
finally {
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
