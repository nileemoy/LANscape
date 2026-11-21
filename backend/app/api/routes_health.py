from datetime import datetime
from typing import Optional
from fastapi import APIRouter
from app.collectors.latency import ping_host
from app.collectors.local_discovery import get_default_gateway_ip

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health():
    return {
        "status": "ok",
        "application": "LANscape",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/router/status")
def get_router_status(router_ip: Optional[str] = None):
    target_ip = router_ip or get_default_gateway_ip()
    success, latency_ms = ping_host(target_ip, timeout_ms=1000)
    return {
        "router_ip": target_ip,
        "reachable": success,
        "latency_ms": latency_ms,
        "integration_type": "dynamic_gateway_ping",
        "timestamp": datetime.utcnow().isoformat(),
        "error_message": None if success else "Router ping failed or timed out"
    }


@router.get("/latency/current")
def get_current_latency(router_ip: Optional[str] = None, internet_ip: str = "1.1.1.1"):
    target_ip = router_ip or get_default_gateway_ip()
    router_ok, router_lat = ping_host(target_ip, timeout_ms=1000)
    net_ok, net_lat = ping_host(internet_ip, timeout_ms=1500)
    return {
        "router": {
            "target": target_ip,
            "reachable": router_ok,
            "latency_ms": router_lat
        },
        "internet": {
            "target": internet_ip,
            "reachable": net_ok,
            "latency_ms": net_lat
        },
        "timestamp": datetime.utcnow().isoformat()
    }
