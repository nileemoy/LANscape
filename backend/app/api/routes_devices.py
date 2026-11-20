import socket
import concurrent.futures
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Device
from app.schemas.device import DeviceResponse, DeviceScanResponse
from app.collectors.local_discovery import discover_local_devices, parse_windows_arp
from app.collectors.latency import ping_host

router = APIRouter(prefix="/devices", tags=["devices"])


def get_local_host_device():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("1.1.1.1", 80))
        host_ip = s.getsockname()[0]
        s.close()
    except Exception:
        host_ip = "192.168.1.2"

    hostname = socket.gethostname()
    return {
        "ip_address": host_ip,
        "mac_address": "host:local:nic",
        "hostname": hostname,
        "friendly_name": "Work Laptop",
        "source": "host_laptop",
        "last_status": "online"
    }


def check_and_sync_devices(db: Session, sweep: bool = False) -> List[Device]:
    """
    Checks the local network state.
    - Discovers active devices via ARP and optional subnet sweep
    - Actively verifies reachability for all known devices in parallel
    - Explicitly sets last_status to 'online' or 'disconnected'
    """
    discovered = discover_local_devices(sweep_first=sweep)
    discovered_map = {d["ip_address"]: d for d in discovered}

    # Host laptop is always registered
    host = get_local_host_device()
    discovered_map[host["ip_address"]] = host

    now = datetime.utcnow()
    all_db_devices = db.query(Device).all()
    all_db_map = {dev.ip_address: dev for dev in all_db_devices}

    # Ensure there is strictly ONLY ONE host laptop in the entire system.
    # Purge any old host entries from when the laptop had a previous DHCP IP.
    stale_hosts = [
        dev for dev in all_db_devices
        if (dev.source in ("host_laptop", "previous_host") or dev.mac_address == "host:local:nic" or (dev.friendly_name and "Work Laptop" in dev.friendly_name))
        and dev.ip_address != host["ip_address"]
    ]
    for stale in stale_hosts:
        db.delete(stale)
        all_db_devices.remove(stale)
        all_db_map.pop(stale.ip_address, None)
    if stale_hosts:
        db.commit()

    # 1. Update/Add all discovered devices into the database
    for ip, d in discovered_map.items():
        dev = all_db_map.get(ip)
        if dev:
            if d.get("mac_address"):
                dev.mac_address = d.get("mac_address")
            if d.get("hostname"):
                dev.hostname = d.get("hostname")
            if d.get("friendly_name") and not dev.friendly_name:
                dev.friendly_name = d.get("friendly_name")
            if ip == host["ip_address"]:
                dev.source = "host_laptop"
                dev.friendly_name = "Work Laptop"
        else:
            dev = Device(
                ip_address=ip,
                mac_address=d.get("mac_address"),
                hostname=d.get("hostname"),
                friendly_name=d.get("friendly_name"),
                source=d.get("source", "local_arp"),
                first_seen=now,
                last_seen=now,
                last_status="online"
            )
            db.add(dev)
            all_db_devices.append(dev)
            all_db_map[ip] = dev

    # 2. Parallel verify reachability for all known devices
    def verify_device(dev: Device):
        if dev.ip_address == host["ip_address"]:
            return dev, True
        if dev.ip_address == "192.168.1.1":
            ok, _ = ping_host("192.168.1.1", timeout_ms=500)
            return dev, ok
        # Quick ping test with short timeout (350ms)
        ok, _ = ping_host(dev.ip_address, timeout_ms=350)
        return dev, ok

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(verify_device, all_db_devices))

    for dev, is_online in results:
        if is_online:
            dev.last_seen = now
            dev.last_status = "online"
        else:
            dev.last_status = "disconnected"

    db.commit()
    return db.query(Device).all()


@router.get("", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    """
    Returns latest known device list with real-time reachability status.
    """
    return check_and_sync_devices(db, sweep=False)


@router.post("/scan", response_model=DeviceScanResponse)
def scan_devices(sweep: bool = True, db: Session = Depends(get_db)):
    """
    Runs a dynamic scan with subnet sweep (default True)
    and updates device statuses (online vs disconnected).
    """
    now = datetime.utcnow()
    devices = check_and_sync_devices(db, sweep=sweep)

    return {
        "source": "local_arp_sweep" if sweep else "local_arp_scan",
        "observed_at": now,
        "device_count": len(devices),
        "devices": devices
    }
