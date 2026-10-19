#!/usr/bin/env bash
# DESCRIPTION: Download and install a GitHub release .snap from Andarius/scw-secrets-desktop.
# USAGE: bin/snap-install-release.sh [tag]
# EXAMPLES:
#   bin/snap-install-release.sh           # latest release
#   bin/snap-install-release.sh v0.4.1    # specific tag

set -euo pipefail

repo="Andarius/scw-secrets-desktop"
# minisign key that signs release assets; keep in sync with src-tauri/update-signing.pub
signing_key="RWTGhZ8NSmkVq/y4pDwht/KbYbX8RV6RA0djY4b7nLvDadE2PAsmhLJo"
tag="${1:-latest}"

command -v minisign >/dev/null || {
    echo "minisign is required to verify the snap: https://jedisct1.github.io/minisign/" >&2
    exit 1
}

if [[ "${tag}" == "latest" ]]; then
    echo "Resolving latest release..."
    tag="$(gh release view --repo "${repo}" --json tagName --jq .tagName)"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

echo "Downloading release ${tag}..."
gh release download "${tag}" --repo "${repo}" --pattern '*.snap' --pattern '*.snap.minisig' --dir "${tmp}"

snap_file="$(ls "${tmp}"/*.snap | head -n1)"
comment="$(minisign -V -Q -P "${signing_key}" -m "${snap_file}" -x "${snap_file}.minisig")"
if [[ "${comment}" != "scw-secrets ${tag} $(basename "${snap_file}")" ]]; then
    echo "signature is for '${comment}', not ${tag}; refusing to install" >&2
    exit 1
fi
# --dangerous: GitHub snaps carry no store assertion; the minisign check above stands in for it
echo "Installing ${snap_file}..."
sudo snap install --dangerous --classic "${snap_file}"
