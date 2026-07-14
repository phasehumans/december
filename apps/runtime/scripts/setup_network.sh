#!/bin/bash
set -eo pipefail

# This script sets up IP tables rules to allow Firecracker VMs to access the public internet,
# but blocks access to private internal networks (e.g., 10.0.0.0/8)

echo "Setting up Firecracker VM network security rules..."

# 1. Enable IP forwarding on the host
sysctl -w net.ipv4.ip_forward=1

# 2. Block access to private subnets from the VMs
# Assuming the TAP devices are bridged or we just block forwarding from tap interfaces to private ranges.
# We will drop packets destined for internal IP ranges.
PRIVATE_RANGES=("10.0.0.0/8" "172.16.0.0/12" "192.168.0.0/16")

for range in "${PRIVATE_RANGES[@]}"; do
    iptables -I FORWARD -d "$range" -j DROP
    echo "Blocked access to $range"
done

# 3. Allow masquerading out to the public internet
# Assuming eth0 is the host's primary public interface.
# Change eth0 if the host uses a different public interface (e.g. ens5 or wlan0)
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# 4. Allow forwarding of established connections back to the VMs
iptables -I FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT

echo "Network security rules applied successfully!"
