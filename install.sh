#!/usr/bin/env bash
set -euo pipefail

REPO="phasehumans/december"
BINARY_NAME="december"
INSTALL_DIR="${DECEMBER_INSTALL_DIR:-$HOME/.december/bin}"

# Color formatting with NO_COLOR & TTY awareness
if [ -n "${NO_COLOR:-}" ] || [ ! -t 1 ]; then
    BLUE=""
    GREEN=""
    RED=""
    YELLOW=""
    WHITE=""
    GREY=""
    TRUNK=""
    RESET=""
else
    BLUE="\033[38;2;135;178;244m"
    GREEN="\033[38;2;110;231;183m"
    RED="\033[38;2;252;165;165m"
    YELLOW="\033[38;2;253;224;71m"
    WHITE="\033[38;2;244;244;245m"
    GREY="\033[38;2;161;161;170m"
    TRUNK="\033[38;2;63;63;70m"
    RESET="\033[0m"
fi

log_step()    { echo -e "${BLUE}✱${RESET}  ${WHITE}$1${RESET}"; }
log_tree()    { echo -e "${TRUNK}│${RESET}  ${GREY}$1${RESET}"; }
log_item()    { echo -e "${TRUNK}│${RESET}  ${WHITE}$1:${RESET} ${GREY}$2${RESET}"; }
log_success() { echo -e "${TRUNK}│${RESET}  ${WHITE}$1${RESET}"; }
log_warn()    { echo -e "${TRUNK}│${RESET}  ${YELLOW}$1${RESET}"; }
log_space()   { echo -e "${TRUNK}│${RESET}"; }
log_error()   { echo -e "${BLUE}✱${RESET}  ${RED}$1${RESET}"; }

detect_target() {
    local os arch
    os="$(uname -s)"
    arch="$(uname -m)"

    case "$os" in
        Linux)
            case "$arch" in
                x86_64|amd64) echo "x86_64-unknown-linux-gnu" ;;
                aarch64|arm64) echo "aarch64-unknown-linux-gnu" ;;
                *) echo "unsupported_arch" ;;
            esac
            ;;
        Darwin)
            case "$arch" in
                arm64|aarch64) echo "aarch64-apple-darwin" ;;
                x86_64|amd64) echo "x86_64-apple-darwin" ;;
                *) echo "unsupported_arch" ;;
            esac
            ;;
        MINGW64_NT*|MINGW32_NT*|MSYS_NT*|CYGWIN*|Windows_NT)
            echo "windows"
            ;;
        *)
            echo "unsupported_os"
            ;;
    esac
}

TARGET=$(detect_target)

if [ "$TARGET" = "windows" ]; then
    log_error "Windows detected: Please use the PowerShell installer command:"
    log_space
    echo -e "${TRUNK}│${RESET}  ${WHITE}irm https://trydecember.com/install.ps1 | iex${RESET}"
    log_space
    log_tree "Or install via package manager:"
    echo -e "${TRUNK}│${RESET}  ${WHITE}npm install -g @trydecember/cli${RESET}"
    echo -e "${TRUNK}│${RESET}  ${WHITE}bun add -g @trydecember/cli${RESET}"
    log_space
    exit 1
fi

if [ "$TARGET" = "unsupported_arch" ] || [ "$TARGET" = "unsupported_os" ]; then
    log_error "Unsupported platform: $(uname -s) $(uname -m)"
    log_space
    log_tree "You can still run December via package manager:"
    echo -e "${TRUNK}│${RESET}  ${WHITE}npm install -g @trydecember/cli${RESET}"
    echo -e "${TRUNK}│${RESET}  ${WHITE}bun add -g @trydecember/cli${RESET}"
    log_space
    exit 1
fi

case "$TARGET" in
    x86_64-unknown-linux-gnu)   DISPLAY_TARGET="Linux / WSL (x64)" ;;
    aarch64-unknown-linux-gnu)  DISPLAY_TARGET="Linux / WSL (arm64)" ;;
    aarch64-apple-darwin)       DISPLAY_TARGET="macOS (Apple Silicon)" ;;
    x86_64-apple-darwin)        DISPLAY_TARGET="macOS (Intel x64)" ;;
    *)                          DISPLAY_TARGET="$TARGET" ;;
esac

echo ""
log_step "installing december for ${DISPLAY_TARGET}..."
log_space

VERSION="${DECEMBER_VERSION:-latest}"
ARCHIVE="december-${TARGET}.tar.gz"

CDN_BASE="https://dl.trydecember.com/releases"
GITHUB_BASE="https://github.com/${REPO}/releases"

if [ "$VERSION" = "latest" ]; then
    PRIMARY_URL="${CDN_BASE}/latest/${ARCHIVE}"
    FALLBACK_URL="${GITHUB_BASE}/latest/download/${ARCHIVE}"
    PRIMARY_SHASUMS_URL="${CDN_BASE}/latest/SHASUMS256.txt"
    FALLBACK_SHASUMS_URL="${GITHUB_BASE}/latest/download/SHASUMS256.txt"
else
    PRIMARY_URL="${CDN_BASE}/v${VERSION#v}/${ARCHIVE}"
    FALLBACK_URL="${GITHUB_BASE}/download/v${VERSION#v}/${ARCHIVE}"
    PRIMARY_SHASUMS_URL="${CDN_BASE}/v${VERSION#v}/SHASUMS256.txt"
    FALLBACK_SHASUMS_URL="${GITHUB_BASE}/download/v${VERSION#v}/SHASUMS256.txt"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

CURL_TIMEOUT_OPTS=(--connect-timeout 15 --retry 2 --retry-delay 2 --speed-limit 10240 --speed-time 25)

log_tree "downloading pre-compiled release binary..."
DOWNLOAD_SUCCESS=0
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    if curl -fL "${CURL_TIMEOUT_OPTS[@]}" --progress-bar "$PRIMARY_URL" -o "${TMP_DIR}/${ARCHIVE}"; then
        DOWNLOAD_SUCCESS=1
    elif curl -fL "${CURL_TIMEOUT_OPTS[@]}" --progress-bar "$FALLBACK_URL" -o "${TMP_DIR}/${ARCHIVE}"; then
        DOWNLOAD_SUCCESS=1
    fi
else
    if curl -fsSL "${CURL_TIMEOUT_OPTS[@]}" "$PRIMARY_URL" -o "${TMP_DIR}/${ARCHIVE}" 2>/dev/null; then
        DOWNLOAD_SUCCESS=1
    elif curl -fsSL "${CURL_TIMEOUT_OPTS[@]}" "$FALLBACK_URL" -o "${TMP_DIR}/${ARCHIVE}" 2>/dev/null; then
        DOWNLOAD_SUCCESS=1
    fi
fi

if [ "$DOWNLOAD_SUCCESS" -ne 1 ]; then
    log_space
    log_error "Failed to download release asset."
    log_tree "Primary CDN and GitHub fallback downloads timed out or failed."
    log_space
    log_tree "Tip: You can install via package manager in seconds:"
    echo -e "${TRUNK}│${RESET}    ${WHITE}npm install -g @trydecember/cli${RESET}"
    echo -e "${TRUNK}│${RESET}    ${WHITE}bun add -g @trydecember/cli${RESET}"
    log_space
    exit 1
fi
log_success "downloaded release asset"

# Verify sha256 checksum if manifest is available
if curl -fsSL "${CURL_TIMEOUT_OPTS[@]}" "$PRIMARY_SHASUMS_URL" -o "${TMP_DIR}/SHASUMS256.txt" 2>/dev/null || \
   curl -fsSL "${CURL_TIMEOUT_OPTS[@]}" "$FALLBACK_SHASUMS_URL" -o "${TMP_DIR}/SHASUMS256.txt" 2>/dev/null; then
    (
        cd "$TMP_DIR"
        VERIFIED=0
        if command -v sha256sum >/dev/null 2>&1; then
            if grep -F "${ARCHIVE}" SHASUMS256.txt | sha256sum --check --status 2>/dev/null; then
                VERIFIED=1
            fi
        elif command -v shasum >/dev/null 2>&1; then
            if grep -F "${ARCHIVE}" SHASUMS256.txt | shasum -a 256 --check --status 2>/dev/null; then
                VERIFIED=1
            fi
        fi

        if [ "$VERIFIED" -eq 1 ]; then
            log_success "sha256 checksum verified"
        else
            log_warn "sha256 checksum not verified (manifest unverified); proceeding"
        fi
    )
fi

log_tree "extracting binary..."
tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "$TMP_DIR"

mkdir -p "$INSTALL_DIR"
if [ -f "${TMP_DIR}/${BINARY_NAME}" ]; then
    mv "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
elif [ -f "${TMP_DIR}/december-${TARGET}" ]; then
    mv "${TMP_DIR}/december-${TARGET}" "${INSTALL_DIR}/${BINARY_NAME}"
else
    FOUND_BIN="$(find "$TMP_DIR" -type f -name "*december*" | head -n 1)"
    if [ -n "$FOUND_BIN" ]; then
        mv "$FOUND_BIN" "${INSTALL_DIR}/${BINARY_NAME}"
    else
        log_space
        log_error "Failed to locate extracted binary."
        exit 1
    fi
fi
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

# On macOS, clear quarantine attribute if present
if [ "$(uname -s)" = "Darwin" ]; then
    xattr -d com.apple.quarantine "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null || true
fi

log_success "installed binary to ${WHITE}${INSTALL_DIR}/${BINARY_NAME}${RESET}"

# Verify binary execution
INSTALLED_VERSION=""
if [ -x "${INSTALL_DIR}/${BINARY_NAME}" ]; then
    INSTALLED_VERSION="$("${INSTALL_DIR}/${BINARY_NAME}" --version 2>/dev/null || true)"
fi

if [ -n "$INSTALLED_VERSION" ]; then
    CLEAN_VER="${INSTALLED_VERSION#v}"
    log_success "verified binary execution (v${CLEAN_VER})"
fi

# Clean up legacy ~/.local/bin/december to prevent PATH shadowing
if [ "$INSTALL_DIR" != "$HOME/.local/bin" ] && [ -e "$HOME/.local/bin/december" ]; then
    rm -f "$HOME/.local/bin/december" 2>/dev/null || true
    log_success "cleaned up legacy binary at $HOME/.local/bin/december"
fi

CONFIG_DIR="${DECEMBER_CONFIG_DIR:-$HOME/.december}"
LEGACY_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/december"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ] && [ -f "$LEGACY_CONFIG_DIR/config.json" ]; then
    cp "$LEGACY_CONFIG_DIR/config.json" "$CONFIG_FILE"
    chmod 600 "$CONFIG_FILE" 2>/dev/null || true
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo '{"installMethod": "curl"}' > "$CONFIG_FILE"
    chmod 600 "$CONFIG_FILE" 2>/dev/null || true
else
    # Update installMethod cleanly without sed -i incompatibilities between GNU and BSD/macOS
    if command -v node >/dev/null 2>&1; then
        node -e 'const fs=require("fs"); const f=process.argv[1]; try { const c=JSON.parse(fs.readFileSync(f,"utf8")); c.installMethod="curl"; fs.writeFileSync(f, JSON.stringify(c,null,2)); } catch(e){}' "$CONFIG_FILE" 2>/dev/null || true
    elif command -v bun >/dev/null 2>&1; then
        bun -e 'const fs=require("fs"); const f=process.argv[1]; try { const c=JSON.parse(fs.readFileSync(f,"utf8")); c.installMethod="curl"; fs.writeFileSync(f, JSON.stringify(c,null,2)); } catch(e){}' "$CONFIG_FILE" 2>/dev/null || true
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c 'import json, sys; f=sys.argv[1]; (lambda: (c := json.load(open(f))) and c.update({"installMethod": "curl"}) and json.dump(c, open(f, "w"), indent=2))()' "$CONFIG_FILE" 2>/dev/null || true
    fi
fi
log_success "initialized config at ${WHITE}${CONFIG_FILE}${RESET}"

# Check if INSTALL_DIR is in PATH
PATH_NEEDS_SOURCE=0
SHELL_PROFILE=""

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    log_space
    log_tree "configuring PATH in shell profile..."

    DETECTED_SHELL="$(basename "${SHELL:-bash}")"

    if [ "$DETECTED_SHELL" = "zsh" ] || [ -n "${ZSH_VERSION:-}" ] || [ -f "$HOME/.zshrc" ]; then
        SHELL_PROFILE="$HOME/.zshrc"
    elif [ "$DETECTED_SHELL" = "bash" ] || [ -f "$HOME/.bashrc" ]; then
        SHELL_PROFILE="$HOME/.bashrc"
    elif [ "$DETECTED_SHELL" = "fish" ] || [ -d "$HOME/.config/fish" ]; then
        SHELL_PROFILE="$HOME/.config/fish/config.fish"
    elif [ -f "$HOME/.profile" ]; then
        SHELL_PROFILE="$HOME/.profile"
    else
        SHELL_PROFILE="$HOME/.bashrc"
    fi

    if [ "$DETECTED_SHELL" = "fish" ]; then
        EXPORT_LINE="fish_add_path $INSTALL_DIR"
    else
        EXPORT_LINE="export PATH=\"${INSTALL_DIR}:\$PATH\""
    fi

    if [ -f "$SHELL_PROFILE" ] && grep -Fq "${INSTALL_DIR}" "$SHELL_PROFILE"; then
        log_success "PATH export already present in ${WHITE}${SHELL_PROFILE}${RESET}"
    else
        mkdir -p "$(dirname "$SHELL_PROFILE")"
        echo "" >> "$SHELL_PROFILE"
        echo "# Added by December CLI installer" >> "$SHELL_PROFILE"
        echo "$EXPORT_LINE" >> "$SHELL_PROFILE"
        log_success "added ${INSTALL_DIR} to ${WHITE}${SHELL_PROFILE}${RESET}"
        PATH_NEEDS_SOURCE=1
    fi
fi

log_space
log_step "december successfully installed!"
log_space

if [ "$PATH_NEEDS_SOURCE" -eq 1 ] && [ -n "$SHELL_PROFILE" ]; then
    log_tree "To get started:"
    echo -e "${TRUNK}│${RESET}    ${WHITE}source ${SHELL_PROFILE} && december${RESET}"
else
    log_tree "To get started:"
    echo -e "${TRUNK}│${RESET}    ${WHITE}december${RESET}"
fi

log_space
log_tree "Quick commands:"
echo -e "${TRUNK}│${RESET}    ${WHITE}december${RESET}              start coding agent in current project"
echo -e "${TRUNK}│${RESET}    ${WHITE}december login${RESET}        connect december cloud and wallet credits"
echo -e "${TRUNK}│${RESET}    ${WHITE}december key${RESET}          configure byok api keys (anthropic, openai, etc.)"
echo -e "${TRUNK}│${RESET}    ${WHITE}december docs${RESET}         open documentation in browser"
echo -e "${TRUNK}│${RESET}    ${WHITE}december changelog${RESET}    open changelog in browser"
log_space
log_tree "Docs: ${WHITE}https://trydecember.com${RESET}"
log_space
log_step "ready"
echo ""
