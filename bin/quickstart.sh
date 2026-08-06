#!/usr/bin/env bash
# DESCRIPTION: Quickstart — install the packaged Scw Secrets app for this platform.
# USAGE: curl -fsSL https://raw.githubusercontent.com/Andarius/scw-secrets-desktop/master/bin/quickstart.sh | bash
# EXAMPLES:
#   curl -fsSL .../quickstart.sh | SCW_SECRETS_VERSION=v0.6.0 bash    # pin a release
#   curl -fsSL .../quickstart.sh | SCW_SECRETS_APP=appimage bash      # force the AppImage (no sudo)
#   curl -fsSL .../quickstart.sh | SCW_SECRETS_APP=source bash        # clone + build from source
#   curl -fsSL .../quickstart.sh | SCW_SECRETS_DIR=~/code/scw bash    # custom checkout dir (source only)

set -euo pipefail

REPO_SLUG="Andarius/scw-secrets-desktop"
RUN_HINT=""

resolve_tag() {
    local tag="${SCW_SECRETS_VERSION:-latest}"
    if [[ "$tag" == "latest" ]]; then
        tag="$(curl -fsSL "https://api.github.com/repos/$REPO_SLUG/releases/latest" \
            | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')"
    fi
    [[ -n "$tag" ]] && echo "$tag"
}

fetch_asset() { # tag asset dest
    echo "Downloading $2..."
    local progress="-sS"
    [[ -t 2 ]] && progress="--progress-bar"
    curl -fL "$progress" "https://github.com/$REPO_SLUG/releases/download/$1/$2" -o "$3"
}

# release → the packaged app matching this platform; no prebuilt asset → source
detect_flavor() {
    local app="${SCW_SECRETS_APP:-release}"
    if [[ "$app" != "release" ]]; then
        echo "$app"
        return
    fi
    case "$(uname -s)/$(uname -m)" in
        Linux/x86_64)
            if command -v snap >/dev/null; then echo snap; else echo appimage; fi ;;
        Darwin/arm64) echo macos-arm64 ;;
        Darwin/x86_64) echo macos-x64 ;;
        *) echo source ;;
    esac
}

install_release() { # flavor
    local flavor="$1" tag ver tmp
    tag="$(resolve_tag)" || { echo "could not resolve the latest release tag" >&2; return 1; }
    ver="${tag#v}"
    tmp="$(mktemp -d)"
    # expand now: the RETURN trap outlives this function's locals
    trap "rm -rf '$tmp'" RETURN
    case "$flavor" in
        snap)
            fetch_asset "$tag" "scw-secrets_${ver}_amd64.snap" "$tmp/scw-secrets.snap"
            echo "Installing the snap $tag (needs sudo)..."
            sudo snap install --dangerous --classic "$tmp/scw-secrets.snap"
            RUN_HINT="scw-secrets"
            ;;
        appimage)
            mkdir -p "$HOME/.local/bin"
            fetch_asset "$tag" "ScwSecrets.AppImage" "$HOME/.local/bin/scw-secrets"
            chmod +x "$HOME/.local/bin/scw-secrets"
            RUN_HINT="$HOME/.local/bin/scw-secrets"
            ;;
        macos-arm64|macos-x64)
            fetch_asset "$tag" "ScwSecrets-${flavor}.app.zip" "$tmp/ScwSecrets.app.zip"
            ditto -xk "$tmp/ScwSecrets.app.zip" "$tmp/extract"
            rm -rf /Applications/ScwSecrets.app
            cp -R "$tmp/extract/ScwSecrets.app" /Applications/
            xattr -dr com.apple.quarantine /Applications/ScwSecrets.app
            RUN_HINT="open /Applications/ScwSecrets.app"
            ;;
        *)
            echo "unknown SCW_SECRETS_APP flavor: $flavor (expected release, snap, appimage, macos-arm64, macos-x64, source, or none)" >&2
            return 1
            ;;
    esac
    echo "installed → Scw Secrets $tag ($flavor)"
}

build_source() {
    local repo="${SCW_SECRETS_REPO:-https://github.com/$REPO_SLUG.git}"
    local dir="${SCW_SECRETS_DIR:-$HOME/scw-secrets-desktop}"

    command -v git >/dev/null || { echo "git is required for a source build" >&2; exit 1; }
    if ! command -v deno >/dev/null; then
        echo "Deno not found — installing to \${DENO_INSTALL:-\$HOME/.deno}..."
        curl -fsSL https://deno.land/install.sh | sh </dev/null
        export PATH="${DENO_INSTALL:-$HOME/.deno}/bin:$PATH"
    fi

    if [[ -d "$dir/.git" ]]; then
        echo "Updating existing checkout in $dir..."
        git -C "$dir" pull --ff-only
    else
        git clone "$repo" "$dir"
    fi

    if command -v bun >/dev/null; then
        (cd "$dir" && bun install && bun run build && deno task embed)
        RUN_HINT="cd $dir && deno task dev"
    else
        echo "bun not found — skipping the frontend build; run 'bun install && bun run build && deno task embed' in $dir" >&2
    fi
}

main() {
    command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

    local flavor
    flavor="$(detect_flavor)"

    case "$flavor" in
        none) ;;
        source) build_source ;;
        *) install_release "$flavor" ;;
    esac

    cat <<EOF

Scw Secrets is ready.
${RUN_HINT:+  Run the app:  $RUN_HINT
}Profiles and projects are read from ~/.config/scw/config.yaml (and SCW_* env vars).
EOF
}

main "$@"
