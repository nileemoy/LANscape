import time
import psutil
from typing import Dict, Any


_last_check = {
    "bytes_sent": 0,
    "bytes_recv": 0,
    "timestamp": 0.0
}


def get_host_network_traffic() -> Dict[str, Any]:
    """
    Measures traffic counters and rate for the local host (laptop only)
    using psutil. This is explicitly labeled as 'host_laptop' traffic.
    """
    global _last_check
    current_time = time.time()
    counters = psutil.net_io_counters()

    bytes_sent = counters.bytes_sent
    bytes_recv = counters.bytes_recv

    upload_mbps = 0.0
    download_mbps = 0.0

    if _last_check["timestamp"] > 0:
        elapsed = current_time - _last_check["timestamp"]
        if elapsed > 0:
            sent_delta = max(0, bytes_sent - _last_check["bytes_sent"])
            recv_delta = max(0, bytes_recv - _last_check["bytes_recv"])
            # (bytes * 8) / (seconds * 1,000,000) = Mbps
            upload_mbps = round((sent_delta * 8) / (elapsed * 1_000_000), 2)
            download_mbps = round((recv_delta * 8) / (elapsed * 1_000_000), 2)

    _last_check = {
        "bytes_sent": bytes_sent,
        "bytes_recv": bytes_recv,
        "timestamp": current_time
    }

    return {
        "source": "host_laptop",
        "description": "Laptop local network interface only. NOT whole-house/router traffic.",
        "bytes_sent_total": bytes_sent,
        "bytes_recv_total": bytes_recv,
        "upload_mbps": upload_mbps,
        "download_mbps": download_mbps,
        "timestamp": current_time
    }

