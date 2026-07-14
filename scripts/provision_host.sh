#!/bin/bash
set -e

echo "Starting Host Provisioning for Firecracker on Ubuntu 24.04..."

# Update packages
apt-get update -y
apt-get upgrade -y

# Install prerequisites
apt-get install -y curl wget git build-essential pkg-config libssl-dev jq bzip2 make iproute2 iptables dnsmasq

# Install Rust
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Install Firecracker
FC_VERSION="v1.7.0"
echo "Installing Firecracker $FC_VERSION..."
ARCH="$(uname -m)"
wget https://github.com/firecracker-microvm/firecracker/releases/download/${FC_VERSION}/firecracker-${FC_VERSION}-${ARCH}.tgz
tar -xzf firecracker-${FC_VERSION}-${ARCH}.tgz
sudo mv release-${FC_VERSION}-${ARCH}/firecracker-${FC_VERSION}-${ARCH} /usr/local/bin/firecracker
sudo mv release-${FC_VERSION}-${ARCH}/jailer-${FC_VERSION}-${ARCH} /usr/local/bin/jailer
rm -rf release-${FC_VERSION}-${ARCH} firecracker-${FC_VERSION}-${ARCH}.tgz

# Setup tap interfaces and network forwarding
# Assuming eth0 or enp3s0 is the main interface. We'll set a basic rule to enable IP forwarding.
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

echo "Provisioning complete. Rust and Firecracker are installed."
