#!/usr/bin/env bash
set -euo pipefail

REPO="phasehumans/december"
BINARY_NAME="december"
INSTALL_DIR="${DECEMBER_INSTALL_DIR:-$HOME/.december/bin}"

# Brand Colors (#87B2F4 Brand Blue)
BLUE="\033[38;2;135;178;244m"
GREEN="\033[38;2;110;231;183m"
RED="\033[38;2;252;165;165m"
WHITE="\033[38;2;244;244;245m"
GREY="\033[38;2;161;161;170m"
TRUNK="\033[38;2;63;63;70m"
RESET="\033[0m"

log_step()  { echo -e "${BLUE}✱${RESET}  ${WHITE}$1${RESET}"; }
log_tree()  { echo -e "${TRUNK}│${RESET}  ${GREY}$1${RESET}"; }
log_space() { echo -e "${TRUNK}│${RESET}"; }
log_error() { echo -e "${BLUE}✱${RESET}  ${RED}$1${RESET}"; }

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
            echo "darwin"
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

if [ "$TARGET" = "darwin" ]; then
    log_error "Standalone curl installer is supported for Linux & WSL."
    log_space
    log_tree "For macOS, please install via your package manager:"
    echo -e "${TRUNK}│${RESET}  ${WHITE}bun add -g @trydecember/cli${RESET}    ${GREY}(recommended)${RESET}"
    echo -e "${TRUNK}│${RESET}  ${WHITE}npm install -g @trydecember/cli${RESET}"
    log_space
    exit 1
fi

if [ "$TARGET" = "windows" ]; then
    log_error "Standalone curl installer is supported for Linux & WSL."
    log_space
    log_tree "For Windows, please install via your package manager or WSL:"
    echo -e "${TRUNK}│${RESET}  ${WHITE}bun add -g @trydecember/cli${RESET}    ${GREY}(recommended)${RESET}"
    echo -e "${TRUNK}│${RESET}  ${WHITE}npm install -g @trydecember/cli${RESET}"
    log_space
    exit 1
fi

if [ "$TARGET" = "unsupported_arch" ] || [ "$TARGET" = "unsupported_os" ]; then
    log_error "Unsupported platform: $(uname -s) $(uname -m)"
    log_space
    log_tree "You can still run December via package manager:"
    echo -e "${TRUNK}│${RESET}  ${WHITE}bun add -g @trydecember/cli${RESET}    ${GREY}(recommended)${RESET}"
    echo -e "${TRUNK}│${RESET}  ${WHITE}npm install -g @trydecember/cli${RESET}"
    log_space
    exit 1
fi

case "$TARGET" in
    x86_64-unknown-linux-gnu)   DISPLAY_TARGET="Linux / WSL (x64)" ;;
    aarch64-unknown-linux-gnu)  DISPLAY_TARGET="Linux / WSL (arm64)" ;;
    *)                          DISPLAY_TARGET="$TARGET" ;;
esac

log_step "installing december for ${DISPLAY_TARGET}..."

VERSION="${DECEMBER_VERSION:-latest}"
ARCHIVE="december-${TARGET}.tar.gz"

if [ "$VERSION" = "latest" ]; then
    DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ARCHIVE}"
else
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION#v}/${ARCHIVE}"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log_tree "downloading pre-compiled release binary..."
if ! curl -fL --progress-bar "$DOWNLOAD_URL" -o "${TMP_DIR}/${ARCHIVE}"; then
    log_space
    log_error "Failed to download from ${DOWNLOAD_URL}"
    log_tree "Check https://github.com/${REPO}/releases for available versions."
    exit 1
fi

printf "\033[1A\033[2K"
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
        log_error "Failed to locate extracted binary."
        exit 1
    fi
fi
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

# Clean up legacy ~/.local/bin/december to prevent PATH shadowing
if [ "$INSTALL_DIR" != "$HOME/.local/bin" ] && [ -e "$HOME/.local/bin/december" ]; then
    rm -f "$HOME/.local/bin/december" 2>/dev/null || true
    log_tree "Cleaned up legacy binary at $HOME/.local/bin/december to avoid PATH conflicts."
fi

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/december"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
    echo '{"installMethod":"curl"}' > "$CONFIG_FILE"
else
    if grep -q '"installMethod"' "$CONFIG_FILE"; then
        sed -i 's/"installMethod"[[:space:]]*:[[:space:]]*"[^"]*"/"installMethod": "curl"/' "$CONFIG_FILE" 2>/dev/null || true
    else
        sed -i 's/^{/{\n  "installMethod": "curl",/' "$CONFIG_FILE" 2>/dev/null || true
    fi
fi

log_space
log_step "${BLUE}december successfully installed${RESET} to ${WHITE}${INSTALL_DIR}/${BINARY_NAME}${RESET}"

# Check if INSTALL_DIR is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    log_space
    log_tree "Configuring PATH in shell profile..."

    SHELL_PROFILE=""
    DETECTED_SHELL="$(basename "${SHELL:-bash}")"

    if [ "$DETECTED_SHELL" = "zsh" ] || [ -n "${ZSH_VERSION:-}" ] || [ -f "$HOME/.zshrc" ]; then
        SHELL_PROFILE="$HOME/.zshrc"
    elif [ "$DETECTED_SHELL" = "bash" ] || [ -f "$HOME/.bashrc" ]; then
        SHELL_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.profile" ]; then
        SHELL_PROFILE="$HOME/.profile"
    else
        SHELL_PROFILE="$HOME/.bashrc"
    fi

    EXPORT_LINE="export PATH=\"${INSTALL_DIR}:\$PATH\""

    if [ -f "$SHELL_PROFILE" ] && grep -Fq "${INSTALL_DIR}" "$SHELL_PROFILE"; then
        log_tree "PATH export already present in ${SHELL_PROFILE}."
    else
        echo "" >> "$SHELL_PROFILE"
        echo "# Added by December CLI installer" >> "$SHELL_PROFILE"
        echo "$EXPORT_LINE" >> "$SHELL_PROFILE"
        log_tree "Added ${INSTALL_DIR} to ${WHITE}${SHELL_PROFILE}${RESET}"
    fi

    log_space
    log_tree "Restart your terminal or run:"
    echo -e "${TRUNK}│${RESET}  ${WHITE}source ${SHELL_PROFILE}${RESET}"
fi

log_space
log_step "run ${WHITE}december${RESET} to start your session"
log_tree "(If your active terminal still runs an older version, run: ${WHITE}hash -r${RESET} or restart terminal)"

