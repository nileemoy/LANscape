import concurrent.futures
import platform
import re
import socket
import subprocess
from datetime import datetime
from typing import List, Dict, Optional
from app.collectors.latency import ping_host


def get_default_gateway_ip() -> str:
    """
    Dynamically discovers the local network default gateway router IP.
    Supports Windows, Linux, and macOS.
    Falls back to deriving from host socket interface or 192.168.1.1.
    """
    system = platform.system()
    try:
        if system == "Windows":
            res = subprocess.run(
                ["route", "print", "0.0.0.0"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            # Route Print output:
            # 0.0.0.0          0.0.0.0         192.168.1.1     192.168.1.2
            m = re.search(r"0\.0\.0\.0\s+0\.0\.0\.0\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", res.stdout)
            if m:
                gw = m.group(1).strip()
                if gw != "0.0.0.0":
                    return gw
        elif system in ("Linux", "Darwin"):
            res = subprocess.run(
                ["ip", "route", "show", "default"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            m = re.search(r"default via ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", res.stdout)
            if m:
                return m.group(1).strip()

            res = subprocess.run(["netstat", "-rn"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            m = re.search(r"(?:default|0\.0\.0\.0)\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", res.stdout)
            if m:
                return m.group(1).strip()
    except Exception as e:
        print(f"Error determining default gateway: {e}")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("1.1.1.1", 80))
        host_ip = s.getsockname()[0]
        s.close()
        parts = host_ip.split(".")
        return f"{parts[0]}.{parts[1]}.{parts[2]}.1"
    except Exception:
        return "192.168.1.1"


def get_local_subnet_prefix() -> str:
    """
    Derives the /24 subnet prefix from the active default gateway.
    E.g. gateway '192.168.0.1' -> '192.168.0'
    """
    gw = get_default_gateway_ip()
    return gw.rsplit(".", 1)[0]


def parse_arp_table() -> List[Dict[str, str]]:
    """
    Parses OS ARP cache across Windows, Linux, and macOS.
    Returns list of dicts: {'ip': str, 'mac': str, 'type': str}.
    Excludes broadcast, multicast, and loopback entries.
    """
    devices = []
    system = platform.system()
    try:
        if system == "Windows":
            res = subprocess.run(
                ["arp", "-a"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            pattern = re.compile(
                r"^\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+([0-9a-fA-F-]+)\s+(\w+)",
                re.MULTILINE
            )
            for ip, raw_mac, entry_type in pattern.findall(res.stdout):
                mac = raw_mac.lower().replace("-", ":")
                if mac in ("ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00"):
                    continue
                if ip.endswith(".255") or ip.startswith("224.") or ip.startswith("239.") or ip.startswith("127."):
                    continue
                devices.append({
                    "ip": ip,
                    "mac": mac,
                    "type": entry_type.lower()
                })
        else:
            # macOS / Linux arp -a format: "? (192.168.1.5) at a4:83:e7:.. [ether] on en0 ..."
            res = subprocess.run(
                ["arp", "-a"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            pattern = re.compile(
                r"\(([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)\s+at\s+([0-9a-fA-F:]+)"
            )
            for ip, raw_mac in pattern.findall(res.stdout):
                mac = raw_mac.lower()
                if mac in ("ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00", "(incomplete)"):
                    continue
                if ip.endswith(".255") or ip.startswith("224.") or ip.startswith("239.") or ip.startswith("127."):
                    continue
                devices.append({
                    "ip": ip,
                    "mac": mac,
                    "type": "dynamic"
                })

            if not devices and system == "Linux":
                res = subprocess.run(["ip", "neigh"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                for line in res.stdout.splitlines():
                    parts = line.split()
                    if len(parts) >= 5 and "lladdr" in parts:
                        ip = parts[0]
                        mac = parts[parts.index("lladdr") + 1].lower()
                        if not ip.endswith(".255"):
                            devices.append({
                                "ip": ip,
                                "mac": mac,
                                "type": "dynamic"
                            })
    except Exception as e:
        print(f"Error parsing ARP cache: {e}")
    return devices


# Backwards compatibility alias
parse_windows_arp = parse_arp_table


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


def sweep_subnet(subnet_prefix: Optional[str] = None, start: int = 1, end: int = 254, max_workers: int = 50):
    """
    Concurrently pings the subnet to refresh the local OS ARP table.
    """
    prefix = subnet_prefix or get_local_subnet_prefix()
    ips = [f"{prefix}.{i}" for i in range(start, end + 1)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(ping_host, ip, 400): ip for ip in ips}
        concurrent.futures.wait(futures, timeout=5.0)


def discover_local_devices(sweep_first: bool = False, subnet_prefix: Optional[str] = None) -> List[Dict]:
    """
    Discovers devices using local ARP cache, with optional preceding sweep.
    Dynamically resolves subnet prefix from default gateway if not specified.
    """
    prefix = subnet_prefix or get_local_subnet_prefix()

    if sweep_first:
        sweep_subnet(prefix)

    arp_entries = parse_arp_table()
    results = []
    for entry in arp_entries:
        ip = entry["ip"]
        if not ip.startswith(prefix):
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
