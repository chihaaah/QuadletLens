#!/usr/bin/env bash
set -euo pipefail
# Fedora userspace from signed RPM packages; no OCI image or systemd boot.
node tests/integration/compatibility.mjs --check-release "${FEDORA_RELEASE:-}"
root="${RUNNER_TEMP:?}/quadletlens-fedora-${FEDORA_RELEASE}"
repos="${RUNNER_TEMP}/quadletlens-fedora-${FEDORA_RELEASE}-repos"
release_url="https://dl.fedoraproject.org/pub/fedora/linux/releases/${FEDORA_RELEASE}/Everything/x86_64/os/"
updates_url="https://dl.fedoraproject.org/pub/fedora/linux/updates/${FEDORA_RELEASE}/Everything/x86_64/"
# Fail before package installation when a target is unavailable/EOL or the mirror is unreachable.
for url in "$release_url" "$updates_url"; do
  if ! curl --fail --silent --show-error --location --retry 2 --connect-timeout 15 --max-time 60 \
    "${url}repodata/repomd.xml" -o /dev/null; then
    echo "Fedora ${FEDORA_RELEASE} repository unavailable: $url (check release support, mirror and compatibility.json)" >&2
    exit 1
  fi
done
mkdir -p "$repos"
sudo apt-get update -qq
sudo apt-get install -y dnf rpm
cat > "$repos/fedora.repo" <<EOF
[fedora]
name=Fedora ${FEDORA_RELEASE}
baseurl=${release_url}
enabled=1
gpgcheck=1
gpgkey=https://fedoraproject.org/fedora.gpg
[updates]
name=Fedora ${FEDORA_RELEASE} updates
baseurl=${updates_url}
enabled=1
gpgcheck=1
gpgkey=https://fedoraproject.org/fedora.gpg
EOF
sudo dnf --installroot="$root" --releasever="$FEDORA_RELEASE" --setopt="reposdir=$repos" \
  --setopt=install_weak_deps=False -y install podman systemd nodejs fedora-release
podman_rpm="$(sudo rpm --root "$root" -q podman)"
systemd_rpm="$(sudo rpm --root "$root" -q systemd)"
echo "Fedora: $FEDORA_RELEASE"
echo "Podman RPM: $podman_rpm"
echo "systemd RPM: $systemd_rpm"
cat "$root/etc/os-release"
sudo mkdir -p "$root/workspace" "$root/tmp" "$root/dev" "$root/proc"
sudo chmod 1777 "$root/tmp"
if [ ! -e "$root/dev/null" ]; then sudo mknod -m 666 "$root/dev/null" c 1 3; fi
sudo cp -a packages tests node_modules "$root/workspace/"
# Query the same RPM database that host DNF populated; Fedora/Ubuntu rpm defaults differ.
sudo rpm --root "$root" -qal | sudo tee "$root/workspace/installed-rpm-files.txt" > /dev/null
# Podman's reexec/version code reads /proc/self/cmdline even without starting containers.
sudo mount -t proc -o ro,nosuid,nodev,noexec proc "$root/proc"
trap 'sudo umount "$root/proc"' EXIT
mkdir -p quadlet-report
# Keep reports even if an assertion fails; the command's failure status is preserved.
collect_reports() {
  if [ -d "$root/workspace/quadlet-report" ]; then
    sudo cp -a "$root/workspace/quadlet-report/." ./quadlet-report/
  fi
  sudo chown -R "$(id -u):$(id -g)" ./quadlet-report
  sudo umount "$root/proc"
}
trap collect_reports EXIT
sudo chroot "$root" /usr/bin/env PATH=/usr/bin:/bin \
  FEDORA_RELEASE="$FEDORA_RELEASE" PODMAN_RPM="$podman_rpm" SYSTEMD_RPM="$systemd_rpm" \
  TEST_COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}" \
  QUADLET_REPORT_DIR=/workspace/quadlet-report \
  INSTALLED_PACKAGE_MANIFEST=/workspace/installed-rpm-files.txt \
  /usr/bin/node --test /workspace/tests/integration/quadlet.integration.mjs 2>&1 | tee quadlet-report/integration.log
