from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from app.db.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String, unique=True, index=True, nullable=False)
    mac_address = Column(String, index=True, nullable=True)
    hostname = Column(String, nullable=True)
    friendly_name = Column(String, nullable=True)
    source = Column(String, default="local_arp")  # router_confirmed, local_arp, manual
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    last_status = Column(String, default="online")  # online, unreachable


class TrafficSample(Base):
    __tablename__ = "traffic_samples"

    id = Column(Integer, primary_key=True, index=True)
    interface_name = Column(String, nullable=False)
    bytes_sent_total = Column(Float, nullable=False)
    bytes_received_total = Column(Float, nullable=False)
    sent_delta_bytes = Column(Float, default=0.0)
    received_delta_bytes = Column(Float, default=0.0)
    upload_mbps = Column(Float, default=0.0)
    download_mbps = Column(Float, default=0.0)
    counter_epoch = Column(Integer, default=1)
    source = Column(String, nullable=False)  # router_wan, host_laptop, manual_snapshot
    sampled_at = Column(DateTime, default=datetime.utcnow, index=True)


class LatencySample(Base):
    __tablename__ = "latency_samples"

    id = Column(Integer, primary_key=True, index=True)
    target = Column(String, nullable=False, index=True)  # e.g., '192.168.1.1', '1.1.1.1'
    latency_ms = Column(Float, nullable=True)
    packet_loss_percent = Column(Float, default=0.0)
    success = Column(Boolean, default=False)
    sampled_at = Column(DateTime, default=datetime.utcnow, index=True)


class SpeedTest(Base):
    __tablename__ = "speed_tests"

    id = Column(Integer, primary_key=True, index=True)
    download_mbps = Column(Float, nullable=False)
    upload_mbps = Column(Float, nullable=False)
    latency_ms = Column(Float, nullable=True)
    server_name = Column(String, nullable=True)
    tested_at = Column(DateTime, default=datetime.utcnow, index=True)


class RouterStatus(Base):
    __tablename__ = "router_status"

    id = Column(Integer, primary_key=True, index=True)
    reachable = Column(Boolean, default=False)
    response_ms = Column(Float, nullable=True)
    integration_type = Column(String, default="ping_only")  # ping_only, snmp, api, manual
    last_successful_poll = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)

