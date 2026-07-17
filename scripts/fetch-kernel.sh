#!/bin/bash
set -eo pipefail

echo "Downloading Firecracker Linux kernel..."

wget -qO vmlinux.bin https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux.bin
chmod +x vmlinux.bin

echo "Done! The kernel is at vmlinux.bin."
