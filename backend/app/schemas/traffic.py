from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TrafficSampleBase(BaseModel):
    interface_name: str
    bytes_sent_total: float
    bytes_received_total: float
    source: str  # router_wan, host_laptop, manual_snapshot


class TrafficSnapshotCreate(TrafficSampleBase):
    note: Optional[str] = None


class TrafficSampleResponse(TrafficSampleBase):
    id: int
    sent_delta_bytes: float
    received_delta_bytes: float
    upload_mbps: float
    download_mbps: float
    counter_epoch: int
    sampled_at: datetime

    model_config = ConfigDict(from_attributes=True)

