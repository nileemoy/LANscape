from datetime import datetime
from fastapi import APIRouter
from app.collectors.latency import ping_host

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health():
    return {
        "status": "ok",
        "application": "HomeNet",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/router/status")
def get_router_status(router_ip: str = "192.168.1.1"):
    success, latency_ms = ping_host(router_ip, timeout_ms=1000)
    return {
        "router_ip": router_ip,
        "reachable": success,
        "latency_ms": latency_ms,
        "integration_type": "ping_only",
        "timestamp": datetime.utcnow().isoformat(),
        "error_message": None if success else "Router ping failed or timed out"
    }


@router.get("/latency/current")
def get_current_latency(router_ip: str = "192.168.1.1", internet_ip: str = "1.1.1.1"):
    router_ok, router_lat = ping_host(router_ip, timeout_ms=1000)
    net_ok, net_lat = ping_host(internet_ip, timeout_ms=1500)
    return {
        "router": {
            "target": router_ip,
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

