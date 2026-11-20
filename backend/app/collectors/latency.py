import platform
import re
import subprocess
import time
from typing import Optional, Tuple


def ping_host(host: str, timeout_ms: int = 1000) -> Tuple[bool, Optional[float]]:
    """
    Pings a host using the system's native ping tool on Windows (or Linux fallback).
    Returns (success: bool, latency_ms: Optional[float]).
    Does not require raw socket privileges.
    """
    is_windows = platform.system().lower() == "windows"
    if is_windows:
        cmd = ["ping", "-n", "1", "-w", str(timeout_ms), host]
    else:
        cmd = ["ping", "-c", "1", "-W", str(max(1, timeout_ms // 1000)), host]

    start = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=(timeout_ms / 1000.0) + 1.5
        )
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        if proc.returncode != 0:
            return False, None

        # Parse output for time=XXms
        output = proc.stdout
        # Windows pattern: "time=1ms" or "time<1ms" or "Time=12ms"
        match = re.search(r"[Tt]ime[=<](\d+(?:\.\d+)?)ms", output)
        if match:
            return True, float(match.group(1))
        # If output succeeded but match didn't catch, use elapsed time as estimate
        return True, round(elapsed_ms, 2)
    except (subprocess.TimeoutExpired, Exception):
        return False, None

