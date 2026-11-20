from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DeviceBase(BaseModel):
    ip_address: str
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    friendly_name: Optional[str] = None
    source: str = "local_arp"


class DeviceCreate(DeviceBase):
    pass


class DeviceResponse(DeviceBase):
    id: int
    first_seen: datetime
    last_seen: datetime
    last_status: str

    model_config = ConfigDict(from_attributes=True)


class DeviceScanResponse(BaseModel):
    source: str
    observed_at: datetime
    device_count: int
    devices: list[DeviceResponse]

