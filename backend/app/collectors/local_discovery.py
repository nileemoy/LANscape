import concurrent.futures
import platform
import re
import socket
import subprocess
from datetime import datetime
from typing import List, Dict, Optional
from app.collectors.latency import ping_host


def parse_windows_arp() -> List[Dict[str, str]]:
    """
    Parses Windows `arp -a` output.
    Returns list of dicts: {'ip': str, 'mac': str, 'type': str}.
    Excludes broadcast, multicast, and loopback entries.
    """
    devices = []
    try:
        res = subprocess.run(
            ["arp", "-a"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        # Lines typically look like:
        #   192.168.1.1           e8-65-d4-xx-xx-xx     dynamic
        pattern = re.compile(
            r"^\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+([0-9a-fA-F-]+)\s+(\w+)",
            re.MULTILINE
        )
        for ip, raw_mac, entry_type in pattern.findall(res.stdout):
            # Normalize MAC to lowercase colon or hyphen format
            mac = raw_mac.lower().replace("-", ":")

            # Filter out broadcast / multicast
            if mac in ("ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00"):
                continue
            if ip.endswith(".255") or ip.startswith("224.") or ip.startswith("239."):
                continue

            devices.append({
                "ip": ip,
                "mac": mac,
                "type": entry_type.lower()
            })
    except Exception as e:
        print(f"Error parsing arp: {e}")
    return devices


def resolve_hostname(ip: str) -> Optional[str]:
    """
    Attempts reverse DNS resolution for local IP with short timeout.
    """
    try:
        socket.setdefaulttimeout(0.5)
        name, _, _ = socket.gethostbyaddr(ip)
        return name
    except Exception:
        return None


def sweep_subnet(subnet_prefix: str = "192.168.1", start: int = 1, end: int = 254, max_workers: int = 50):
    """
    Concurrently pings the subnet to refresh the local OS ARP table.
    """
    ips = [f"{subnet_prefix}.{i}" for i in range(start, end + 1)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(ping_host, ip, 400): ip for ip in ips}
        concurrent.futures.wait(futures, timeout=5.0)


def discover_local_devices(sweep_first: bool = False, subnet_prefix: str = "192.168.1") -> List[Dict]:
    """
    Discovers devices using local ARP cache, with optional preceding sweep.
    """
    if sweep_first:
        sweep_subnet(subnet_prefix)

    arp_entries = parse_windows_arp()
    results = []
    for entry in arp_entries:
        ip = entry["ip"]
        if not ip.startswith(subnet_prefix):
            continue
        hostname = resolve_hostname(ip)
        results.append({
            "ip_address": ip,
            "mac_address": entry["mac"],
            "hostname": hostname,
            "source": "local_arp",
            "last_status": "online"
        })
    return results

