import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["application"] == "LANscape"
    assert "version" in data
    assert "timestamp" in data


def test_router_status_endpoint():
    response = client.get("/api/router/status")
    assert response.status_code == 200
    data = response.json()
    assert "reachable" in data
    assert "router_ip" in data
    assert data["router_ip"] == "192.168.1.1"


def test_latency_current_endpoint():
    response = client.get("/api/latency/current")
    assert response.status_code == 200
    data = response.json()
    assert "router" in data
    assert "internet" in data
    assert "timestamp" in data


def test_host_traffic_endpoint():
    response = client.get("/api/traffic/host")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "host_laptop"
    assert "bytes_sent_total" in data
    assert "bytes_recv_total" in data
    assert "upload_mbps" in data
    assert "download_mbps" in data


def test_devices_and_scan_endpoints():
    # Trigger scan without sweep (fast ARP cache read)
    scan_resp = client.post("/api/devices/scan?sweep=false")
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert "device_count" in scan_data
    assert "devices" in scan_data
    assert scan_data["source"] == "local_arp_scan"

    # Query device list
    list_resp = client.get("/api/devices")
    assert list_resp.status_code == 200
    devices = list_resp.json()
    assert isinstance(devices, list)


def test_traffic_snapshot_workflow():
    # Check current traffic before snapshot
    curr_resp = client.get("/api/traffic/current")
    assert curr_resp.status_code == 200

    # Post initial manual snapshot
    snap1 = {
        "interface_name": "pppoe0",
        "bytes_sent_total": 8151326861,
        "bytes_received_total": 116890248298,
        "source": "manual_snapshot"
    }
    resp1 = client.post("/api/traffic/snapshot", json=snap1)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["bytes_sent_total"] == 8151326861
    assert data1["upload_mbps"] == 0.0

    # Post second manual snapshot with delta
    snap2 = {
        "interface_name": "pppoe0",
        "bytes_sent_total": 8157461104,
        "bytes_received_total": 117182550330,
        "source": "manual_snapshot"
    }
    resp2 = client.post("/api/traffic/snapshot", json=snap2)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["bytes_sent_total"] == 8157461104
    assert data2["sent_delta_bytes"] == 6134243
    assert data2["received_delta_bytes"] == 292302032
    assert data2["counter_epoch"] >= 1

    # Verify current traffic now shows the latest
    curr_resp2 = client.get("/api/traffic/current")
    assert curr_resp2.status_code == 200
    assert curr_resp2.json()["sample"]["bytes_sent_total"] == 8157461104

