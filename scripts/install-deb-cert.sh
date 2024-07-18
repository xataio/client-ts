set -e -o pipefail

# This will sign files after `oclif pack:deb`, this script should be ran from
# the `dist/deb` folder
echo "$DEBIAN_GPG_KEY_PRIVATE" | base64 -d 2> /dev/null | gpg --import --batch --passphrase "$DEBIAN_GPG_KEY_PASS" 2> /dev/null
gpg --digest-algo SHA512 --clearsign --pinentry-mode loopback --passphrase "$DEBIAN_GPG_KEY_PASS" -u $DEBIAN_GPG_KEY_ID -o InRelease Release 2> /dev/null
gpg --digest-algo SHA512 -abs --pinentry-mode loopback --passphrase "$DEBIAN_GPG_KEY_PASS" -u $DEBIAN_GPG_KEY_ID -o Release.gpg Release 2> /dev/null
echo "Signed debian packages successfully"
echo "sha256 sums:"
sha256sum *Release*


mkdir -p $RUNNER_TEMP/cli/dist/apt
echo "$DEBIAN_GPG_KEY_PUBLIC" | base64 --decode > $RUNNER_TEMP/cli/dist/apt/release.key
