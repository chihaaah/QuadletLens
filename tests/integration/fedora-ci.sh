#!/usr/bin/env bash
set -euo pipefail
# Fedora userspace from signed RPM packages; no OCI image or systemd boot.
root="${RUNNER_TEMP:?}/compose2quadlet-fedora44"
repos="${RUNNER_TEMP}/compose2quadlet-fedora-repos"
mkdir -p "$repos"
sudo apt-get update -qq
sudo apt-get install -y dnf rpm
cat > "$repos/fedora.repo" <<'EOF'
[fedora]
name=Fedora 44
baseurl=https://dl.fedoraproject.org/pub/fedora/linux/releases/44/Everything/x86_64/os/
enabled=1
gpgcheck=1
gpgkey=https://fedoraproject.org/fedora.gpg
[updates]
name=Fedora 44 updates
baseurl=https://dl.fedoraproject.org/pub/fedora/linux/updates/44/Everything/x86_64/
enabled=1
gpgcheck=1
gpgkey=https://fedoraproject.org/fedora.gpg
EOF
sudo dnf --installroot="$root" --releasever=44 --setopt="reposdir=$repos" \
  --setopt=install_weak_deps=False -y install podman-5.8.7-1.fc44 systemd nodejs
sudo mkdir -p "$root/workspace" "$root/tmp" "$root/dev" "$root/proc"
sudo chmod 1777 "$root/tmp"
if [ ! -e "$root/dev/null" ]; then sudo mknod -m 666 "$root/dev/null" c 1 3; fi
sudo cp -a packages tests node_modules "$root/workspace/"
# Podman's reexec/version code reads /proc/self/cmdline even without starting containers.
sudo mount -t proc -o ro,nosuid,nodev,noexec proc "$root/proc"
trap 'sudo umount "$root/proc"' EXIT
mkdir -p quadlet-report
sudo chroot "$root" /usr/bin/env PATH=/usr/bin:/bin \
  QUADLET_REPORT_DIR=/workspace/quadlet-report \
  /usr/bin/node --test /workspace/tests/integration/quadlet.integration.mjs 2>&1 | tee quadlet-report/integration.log
sudo cp -a "$root/workspace/quadlet-report/." ./quadlet-report/
sudo chown -R "$(id -u):$(id -g)" ./quadlet-report
