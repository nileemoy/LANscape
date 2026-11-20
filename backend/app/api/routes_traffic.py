from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import TrafficSample
from app.schemas.traffic import TrafficSnapshotCreate, TrafficSampleResponse
from app.collectors.host_traffic import get_host_network_traffic

router = APIRouter(prefix="/traffic", tags=["traffic"])


@router.get("/host")
def get_host_traffic():
    """
    Returns current network counters and live rate for THIS laptop only.
    Clearly labelled to avoid confusing it with whole-home traffic.
    """
    return get_host_network_traffic()


@router.get("/current")
def get_current_traffic(db: Session = Depends(get_db)):
    """
    Returns the most recent router/WAN traffic sample, if available.
    """
    latest = (
        db.query(TrafficSample)
        .order_by(TrafficSample.sampled_at.desc())
        .first()
    )
    if not latest:
        return {
            "status": "no_router_counters_yet",
            "message": "Router automated counters are not yet connected. Record a manual snapshot or configure adapter.",
            "sample": None
        }
    return {
        "status": "ok",
        "sample": latest
    }


@router.post("/snapshot", response_model=TrafficSampleResponse)
def create_manual_snapshot(snapshot: TrafficSnapshotCreate, db: Session = Depends(get_db)):
    """
    Records a manually observed router counter snapshot (from router Web UI).
    Calculates rate if previous snapshot exists under same epoch.
    """
    now = datetime.utcnow()
    last = (
        db.query(TrafficSample)
        .filter(TrafficSample.interface_name == snapshot.interface_name)
        .order_by(TrafficSample.sampled_at.desc())
        .first()
    )

    sent_delta = 0.0
    recv_delta = 0.0
    upload_mbps = 0.0
    download_mbps = 0.0
    epoch = 1

    if last:
        epoch = last.counter_epoch
        # Reset detection: if counter decreased, start new epoch and don't calculate negative rate
        if (snapshot.bytes_sent_total < last.bytes_sent_total or
                snapshot.bytes_received_total < last.bytes_received_total):
            epoch += 1
        else:
            elapsed = (now - last.sampled_at).total_seconds()
            if elapsed > 0:
                sent_delta = snapshot.bytes_sent_total - last.bytes_sent_total
                recv_delta = snapshot.bytes_received_total - last.bytes_received_total
                upload_mbps = round((sent_delta * 8) / (elapsed * 1_000_000), 2)
                download_mbps = round((recv_delta * 8) / (elapsed * 1_000_000), 2)

    new_sample = TrafficSample(
        interface_name=snapshot.interface_name,
        bytes_sent_total=snapshot.bytes_sent_total,
        bytes_received_total=snapshot.bytes_received_total,
        sent_delta_bytes=sent_delta,
        received_delta_bytes=recv_delta,
        upload_mbps=upload_mbps,
        download_mbps=download_mbps,
        counter_epoch=epoch,
        source=snapshot.source or "manual_snapshot",
        sampled_at=now
    )
    db.add(new_sample)
    db.commit()
    db.refresh(new_sample)
    return new_sample

