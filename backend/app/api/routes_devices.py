import socket
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Device
from app.schemas.device import DeviceResponse, DeviceScanResponse
from app.collectors.local_discovery import discover_local_devices

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


def sync_devices(db: Session, sweep: bool = False):
    discovered = discover_local_devices(sweep_first=sweep)

    # Always ensure the local host machine is registered
    host_device = get_local_host_device()
    if not any(d["ip_address"] == host_device["ip_address"] for d in discovered):
        discovered.insert(0, host_device)

    now = datetime.utcnow()
    response_items = []
    for d in discovered:
        device = db.query(Device).filter(Device.ip_address == d["ip_address"]).first()
        friendly = d.get("friendly_name")
        if device:
            device.mac_address = d.get("mac_address") or device.mac_address
            device.hostname = d.get("hostname") or device.hostname
            if friendly and not device.friendly_name:
                device.friendly_name = friendly
            device.last_seen = now
            device.last_status = "online"
            device.source = d.get("source", "local_arp")
        else:
            device = Device(
                ip_address=d["ip_address"],
                mac_address=d.get("mac_address"),
                hostname=d.get("hostname"),
                friendly_name=friendly,
                source=d.get("source", "local_arp"),
                first_seen=now,
                last_seen=now,
                last_status="online"
            )
            db.add(device)
        db.commit()
        db.refresh(device)
        response_items.append(device)

    return response_items


@router.get("", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    """
    Returns latest known device list. If database has fewer than 2 devices,
    triggers a background scan to populate.
    """
    devices = db.query(Device).all()
    if len(devices) <= 1:
        devices = sync_devices(db, sweep=True)
    return devices


@router.post("/scan", response_model=DeviceScanResponse)
def scan_devices(sweep: bool = True, db: Session = Depends(get_db)):
    """
    Runs a dynamic ARP cache scan with subnet sweep (default True)
    so all active mobile devices and smart TVs are detected.
    """
    now = datetime.utcnow()
    response_items = sync_devices(db, sweep=sweep)

    return {
        "source": "local_arp_sweep" if sweep else "local_arp_cache",
        "observed_at": now,
        "device_count": len(response_items),
        "devices": response_items
    }
