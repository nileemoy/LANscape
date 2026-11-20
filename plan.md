# HomeNet --- Project Plan

**Project type:** Practical networking / network-monitoring application\
**Difficulty:** Intermediate\
**Target duration:** 7 days for a functional MVP\
**Platform:** Windows 11\
**Implementation:** Python, React, TypeScript, Docker\
**Router under test:** Zyxel PMG5617-R20B GPON ONT supplied with Airtel
Xstream Fiber

------------------------------------------------------------------------

## 1. Project overview

HomeNet is a local-network monitoring dashboard that collects
information about a home network, measures internet performance, stores
historical measurements, and presents the results through a React web
interface.

The first version will focus on capabilities that have already been
observed on the user's router:

1.  A router Network Map page that lists connected devices.
2.  A WAN Traffic Status page that exposes cumulative sent and received
    byte counters.
3.  A router status page that reports basic connection and uptime
    information.

The application must distinguish **measured router data** from **locally
measured laptop data** and from **estimated or unavailable
information**. It must never invent per-device traffic values.

### MVP outcome

At the end of the first week, aim to have:

-   A React dashboard showing router connectivity and the latest known
    device inventory.
-   WAN download/upload totals and rates, if a supported automated
    counter source is established.
-   Internet latency monitoring from the Windows host.
-   Optional on-demand speed tests.
-   SQLite history for collected measurements.
-   A Docker-based deployment for the application services, subject to
    Windows host-network discovery constraints.
-   A documented manual fallback if the router does not expose a
    supported programmatic interface.

------------------------------------------------------------------------

## 2. Confirmed environment and findings

### Local network

  -----------------------------------------------------------------------
  Item                                Observed value
  ----------------------------------- -----------------------------------
  Development OS                      Windows 11

  Laptop Wi-Fi IPv4                   `192.168.1.2`

  Router / default gateway            `192.168.1.1`

  Subnet mask                         `255.255.255.0`

  Network                             `192.168.1.0/24`

  Router ping                         Successful; observed average
                                      approximately 1 ms in one test

  Router model                        Zyxel PMG5617-R20B

  Router type                         GPON ONT
  -----------------------------------------------------------------------

### Router features observed

-   Router web interface is reachable at `http://192.168.1.1`.
-   The Network Map page displayed six device entries at the time it was
    inspected.
-   The LAN configuration page showed DHCP enabled, with pool starting
    at `192.168.1.2`, pool size 253, and a 24-hour lease duration.
-   The WAN Traffic Status page showed PPPoE sent and received byte
    counters.
-   The LAN traffic page showed zero values in the visible LAN port
    counters. This does **not** prove that Wi-Fi traffic is zero; the
    WLAN rows may be separate or the firmware may not populate those
    counters.
-   The NAT tab showed zero in the user's observation. This is not
    evidence that WAN traffic is zero.
-   TR-069/CWMP was enabled and configured for Airtel remote management.
    Do not modify it or use its private credentials.
-   The router's Static DHCP page showed no reservations and a maximum
    of eight entries. Static DHCP is not the live client list and does
    not need to be enabled for this project.

### WAN counters observed in one screenshot

The PPPoE row showed:

-   Bytes sent: `8,157,461,104`
-   Bytes received: `117,182,550,330`

An earlier screenshot showed:

-   Bytes sent: `8,151,326,861`
-   Bytes received: `116,890,248,298`

The differences between those two observations were:

-   Sent/upload: `6,134,243` bytes
-   Received/download: `292,302,032` bytes

The screenshots were not captured using a controlled stopwatch interval.
Therefore, do not treat any speed calculated from them as a verified
throughput measurement. The byte counters are cumulative interface
counters and may reset when the interface/session or router restarts.
Determine reset behavior before presenting monthly totals.

### Device inventory observed

The Network Map displayed six entries at the time of inspection. Device
names and addresses should be collected dynamically; do not hard-code
the screenshot's device list into the application.

------------------------------------------------------------------------

## 3. Goals and non-goals

### Goals

-   Discover and display devices visible to the router or local subnet.
-   Collect total WAN traffic counters when an approved, supported
    interface is available.
-   Calculate upload and download rates from counter deltas.
-   Monitor host-to-router and host-to-internet latency.
-   Store timestamped samples in SQLite.
-   Display historical charts and device-seen history.
-   Provide clear source labels and data-quality indicators.
-   Keep router configuration unchanged.

### Non-goals for the first week

-   Changing router settings, WAN/PPPoE configuration, DHCP, firewall,
    VLAN, bridge mode, or TR-069.
-   Accessing Airtel's ACS server or using private TR-069 credentials.
-   Circumventing router authentication or scraping protected pages with
    guessed credentials.
-   Claiming per-device GB usage without actual per-device counters.
-   Replacing the router or installing extra hardware.
-   Guaranteeing that Docker containers can perform Windows host LAN
    discovery without additional network configuration.

------------------------------------------------------------------------

## 4. Feature specification

### P0 --- Required MVP

#### 4.1 Router and internet health

Display:

-   Router reachability.
-   Router response time.
-   Internet reachability and latency to a configurable public test
    host.
-   Last successful collection timestamp.
-   Collector status and error message, if any.

#### 4.2 Device inventory

Preferred source order:

1.  Router-provided Network Map / client list through a documented,
    authorized read-only interface, if available.
2.  DHCP client list through a documented, authorized interface, if
    available.
3.  Local subnet discovery using ARP and ICMP as a fallback.

Each device record should support:

-   IP address.
-   MAC address (mask in UI by default; allow local reveal if needed).
-   Hostname/device name, if available.
-   Discovery source.
-   First seen and last seen timestamps.
-   Online/reachable status, with the caveat that some devices block
    ping.
-   Optional user-assigned friendly name.

A subnet scan or ARP cache is not a definitive list of all connected
clients. The UI must label such results as "discovered" rather than
"router-confirmed".

#### 4.3 WAN traffic monitoring

If a supported programmatic read-only source is identified, collect:

-   WAN interface name.
-   Bytes sent.
-   Bytes received.
-   Packets sent/received, if exposed.
-   Counter collection timestamp.
-   Interface uptime/session state, if exposed.

Calculate:

-   Upload/download rate in Mbps using byte-counter deltas and actual
    elapsed time.
-   Session traffic since the first sample.
-   Daily traffic derived from samples.
-   Historical traffic charts.

Counter handling requirements:

-   If a counter decreases, treat it as a reset or wraparound candidate;
    do not report a negative rate.
-   Start a new counter epoch after a reset.
-   Store raw counters as well as calculated deltas.
-   Do not assume a counter starts at zero at the beginning of a billing
    month.
-   Clearly label totals as "observed since HomeNet started tracking"
    unless a reliable billing-cycle baseline is configured.

#### 4.4 Latency monitoring

Collect at a configurable interval:

-   Router latency (`192.168.1.1`).
-   Internet endpoint latency (for example, `1.1.1.1`).
-   Packet loss where supported.
-   Timestamp and test duration.

Use modest intervals (for example, 10--30 seconds) and handle timeouts.

#### 4.5 Speed tests

-   Provide a manual "Run speed test" action.
-   Do not run speed tests every 10 seconds.
-   Show test timestamp, download Mbps, upload Mbps, and latency if
    returned.
-   Warn that speed tests consume data and temporarily use bandwidth.

### P1 --- After MVP

-   Per-device traffic, only if the router exposes trustworthy
    per-client counters or a separate authorized measurement point is
    introduced.
-   Device vendor identification using the MAC OUI database, with
    privacy and offline considerations.
-   Alerts for new devices, loss of internet connectivity, or unusual
    traffic.
-   Export CSV.
-   Optional PostgreSQL migration.
-   Router model adapter interface for supporting other routers.

------------------------------------------------------------------------

## 5. Technical architecture

``` text
                 HOME NETWORK
                      |
            Zyxel PMG5617-R20B
               /            \
      Network Map          WAN counters
      (web UI now)       (Traffic Status)
               \            /
                \          /
          Supported read-only source
              (to be verified)
                      |
             Python collector
             /      |       \
        Devices   WAN      Latency
        adapter  adapter   monitor
             \      |       /
                 FastAPI
                    |
                  SQLite
                    |
             React + TypeScript
                    |
             HomeNet dashboard
```

### Important integration gate

The router's web pages visibly contain useful information, but the
conversation has **not yet established** an official API, SNMP endpoint,
UPnP WAN statistics service, or documented endpoint for automatically
retrieving those values.

Before implementing an automated router adapter:

1.  Check the router's official documentation or ask Airtel/Zyxel
    support for a supported read-only management interface.
2.  Check whether SNMP is officially supported and enabled for local
    read-only monitoring.
3.  Check whether a documented local API is available.
4.  Do not use Airtel's TR-069 ACS credentials or attempt to access the
    provider's ACS.
5.  Do not automate login by guessing hidden endpoints or bypassing
    authentication.

If no supported interface is available, build the application with: -
local device discovery, - latency monitoring, - host traffic
monitoring, - speed tests, - manual router-counter snapshot import.

Keep the router adapter interface modular so an authorized integration
can be added later.

------------------------------------------------------------------------

## 6. Technology stack

  -----------------------------------------------------------------------
  Layer                   Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Backend                 Python 3.11+            Monitoring services

  API                     FastAPI                 REST endpoints

  Validation              Pydantic                Request/response models

  Database                SQLite                  Local history

  ORM                     SQLAlchemy              Database access

  Host traffic            psutil                  Traffic on the Windows
                                                  laptop only

  Network discovery       ARP table, ping;        Local network discovery
                          optional Scapy          

  Latency                 icmplib or subprocess   Reachability and RTT
                          ping                    

  Speed test              Ookla Speedtest CLI or  On-demand internet
                          a maintained library    speed tests

  Frontend                React + TypeScript +    Dashboard
                          Vite                    

  Styling                 Tailwind CSS            UI

  Charts                  Recharts                Time-series charts

  Containers              Docker / Docker Compose Reproducible app
                                                  services

  Tests                   pytest; frontend test   Automated tests
                          runner                  

  Version control         Git + GitHub            Portfolio and source
                                                  control
  -----------------------------------------------------------------------

Use maintained dependencies and pin versions in `requirements.txt` /
lockfiles after the prototype works.

------------------------------------------------------------------------

## 7. Suggested repository structure

``` text
homenet/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── routes_health.py
│   │   │   ├── routes_devices.py
│   │   │   ├── routes_traffic.py
│   │   │   └── routes_latency.py
│   │   ├── collectors/
│   │   │   ├── base.py
│   │   │   ├── local_discovery.py
│   │   │   ├── host_traffic.py
│   │   │   ├── latency.py
│   │   │   └── zyxel_adapter.py
│   │   ├── db/
│   │   │   ├── database.py
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   ├── device.py
│   │   │   └── traffic.py
│   │   └── services/
│   │       ├── device_service.py
│   │       └── traffic_service.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── Dockerfile
├── data/
├── docs/
│   ├── router-notes.md
│   └── screenshots/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

## 8. API specification

Initial endpoints:

  --------------------------------------------------------------------------
  Method                  Endpoint                   Description
  ----------------------- -------------------------- -----------------------
  GET                     `/api/health`              Backend and collector
                                                     health

  GET                     `/api/router/status`       Router reachability and
                                                     integration status

  GET                     `/api/devices`             Latest discovered
                                                     device inventory

  POST                    `/api/devices/scan`        Trigger a local
                                                     discovery scan

  GET                     `/api/traffic/current`     Latest traffic counters
                                                     and calculated rates

  GET                     `/api/traffic/history`     Historical traffic
                                                     samples

  POST                    `/api/traffic/snapshot`    Record a manually
                                                     observed router counter
                                                     snapshot

  GET                     `/api/latency/current`     Latest latency
                                                     measurements

  GET                     `/api/latency/history`     Latency history

  POST                    `/api/speedtest`           Run an on-demand speed
                                                     test

  GET                     `/api/speedtest/history`   Previous speed tests
  --------------------------------------------------------------------------

The API should report data provenance, for example:

``` json
{
  "source": "local_arp",
  "observed_at": "2026-11-20T12:00:00Z",
  "devices": []
}
```

Use ISO 8601 timestamps. Do not expose router passwords or secrets
through API responses.

------------------------------------------------------------------------

## 9. Database design

### `devices`

-   `id`
-   `ip_address`
-   `mac_address`
-   `hostname`
-   `friendly_name`
-   `source`
-   `first_seen`
-   `last_seen`
-   `last_status`

### `traffic_samples`

-   `id`
-   `interface_name`
-   `bytes_sent_total`
-   `bytes_received_total`
-   `sent_delta_bytes`
-   `received_delta_bytes`
-   `upload_mbps`
-   `download_mbps`
-   `counter_epoch`
-   `source`
-   `sampled_at`

### `latency_samples`

-   `id`
-   `target`
-   `latency_ms`
-   `packet_loss_percent`
-   `success`
-   `sampled_at`

### `speed_tests`

-   `id`
-   `download_mbps`
-   `upload_mbps`
-   `latency_ms`
-   `server_name`
-   `tested_at`

### `router_status`

-   `id`
-   `reachable`
-   `response_ms`
-   `integration_type`
-   `last_successful_poll`
-   `error_message`

Store MAC addresses carefully. Keep the database local by default and do
not publish real household device identifiers in the public repository.

------------------------------------------------------------------------

## 10. Dashboard specification

### Overview page

Show: - Router status. - Internet status. - Number of currently
discovered devices. - Current WAN download/upload rate, if router
counters are integrated. - Laptop traffic separately, clearly
labelled. - Latest latency. - Last data collection time.

### Devices page

Show: - Device name / friendly name. - IP address. - Masked MAC
address. - Discovery source. - Last seen. - Reachability status.

Include a note that ping-based reachability does not always equal Wi-Fi
association status.

### Traffic page

Show: - WAN received/download total. - WAN sent/upload total. - Current
calculated Mbps. - Daily observed usage. - Historical chart. - Counter
reset markers.

If router WAN counters are not automatically accessible, label imported
samples as manual snapshots.

### Diagnostics page

Show: - Router ping. - Internet ping. - Packet loss. - Speed-test
history. - Collector errors and integration status.

------------------------------------------------------------------------

## 11. Seven-day implementation schedule

### Day 1 --- Environment and baseline collectors

-   Install Python, Node.js, Git and Docker Desktop.
-   Create the repository structure.
-   Create and activate a Python virtual environment.
-   Implement `/api/health`.
-   Implement router ping and local ARP-table parsing.
-   Record the current router inventory as a test reference, not as
    hard-coded production data.

**Deliverable:** Backend starts successfully and reports router
reachability.

### Day 2 --- Device discovery and host monitoring

-   Implement local subnet discovery for `192.168.1.0/24`.
-   Parse ARP results.
-   Add discovery source and last-seen timestamps.
-   Implement Windows host network counters with psutil.
-   Label host traffic as laptop-only.

**Deliverable:** Device list and laptop traffic endpoint.

### Day 3 --- WAN integration investigation and traffic engine

-   Determine whether a documented, authorized read-only router API or
    SNMP interface is available.
-   If available, implement the Zyxel adapter.
-   If unavailable, implement manual counter snapshots and a clear
    "router integration unavailable" state.
-   Implement counter-delta calculations and reset detection.
-   Persist samples to SQLite.

**Deliverable:** Reliable traffic history without fabricated readings.

### Day 4 --- React dashboard

-   Create React + TypeScript + Vite app.
-   Add navigation and overview cards.
-   Connect to FastAPI.
-   Add device inventory table.
-   Add router and internet status.

**Deliverable:** Functional frontend connected to the backend.

### Day 5 --- Analytics

-   Add upload/download time-series charts.
-   Add daily observed usage aggregation.
-   Add latency chart.
-   Add speed-test action and history.
-   Show source and freshness of every metric.

**Deliverable:** Monitoring and analytics dashboard.

### Day 6 --- Docker and reliability

-   Add backend and frontend Dockerfiles.
-   Add Docker Compose.
-   Persist SQLite data using a volume.
-   Test restart behavior and counter resets.
-   Verify Windows host discovery behavior.

**Important:** Docker Desktop on Windows may not expose the physical LAN
to containers in the same way as a native Windows process. If local
discovery fails in a container, run the collector natively on Windows
and containerize the API/database/frontend separately, or document the
required networking setup.

**Deliverable:** Reproducible deployment with known network limitations
documented.

### Day 7 --- Polish and portfolio release

-   Add error handling and tests.
-   Write README and architecture documentation.
-   Capture screenshots with private identifiers masked.
-   Add a short demo video or GIF.
-   Document limitations honestly.
-   Publish source code without credentials, IP-sensitive screenshots,
    or personal device identifiers.

**Deliverable:** Portfolio-ready HomeNet MVP.

------------------------------------------------------------------------

## 12. First setup steps on Windows 11

Open PowerShell:

``` powershell
mkdir homenet
cd homenet

mkdir backend, frontend, data, docs

cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If script activation is blocked in the current PowerShell session:

``` powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Install the initial backend dependencies:

``` powershell
python -m pip install --upgrade pip
pip install fastapi uvicorn[standard] psutil icmplib sqlalchemy pydantic
pip freeze > requirements.txt
```

Create a minimal `backend/app/main.py`:

``` python
from fastapi import FastAPI

app = FastAPI(title="HomeNet API", version="0.1.0")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "application": "HomeNet"
    }
```

Run it from the `backend` directory:

``` powershell
uvicorn app.main:app --reload
```

For this command, create an empty `backend/app/__init__.py` first.

Open:

-   API: `http://127.0.0.1:8000/api/health`
-   API docs: `http://127.0.0.1:8000/docs`

Then initialize the frontend from the project root:

``` powershell
cd ..\..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install recharts
```

Tailwind setup should follow the current Tailwind + Vite installation
instructions for the selected Tailwind version rather than relying on
older configuration steps.

------------------------------------------------------------------------

## 13. Testing and acceptance criteria

The MVP is ready when:

-   [ ] Backend starts on Windows 11.
-   [ ] `/api/health` returns a healthy response.
-   [ ] Router reachability is measured and timestamped.
-   [ ] Device discovery returns dynamically discovered records.
-   [ ] The UI identifies the source of each device record.
-   [ ] Laptop traffic is not mislabelled as whole-house traffic.
-   [ ] WAN counters are collected automatically only if a supported
    interface is verified.
-   [ ] Manual WAN snapshots can be recorded if automatic integration is
    unavailable.
-   [ ] Counter deltas produce correct rates using measured elapsed
    time.
-   [ ] Counter resets do not create negative bandwidth.
-   [ ] Historical samples persist after application restart.
-   [ ] Dashboard charts use actual stored samples, not fabricated demo
    values.
-   [ ] Secrets and household identifiers are excluded from Git.

------------------------------------------------------------------------

## 14. Security and privacy rules

-   Never commit router administrator credentials, Wi-Fi passwords, ACS
    credentials, or tokens.
-   Never publish unredacted screenshots of router pages.
-   Keep the application bound to localhost during development unless
    remote access is intentionally secured.
-   Do not expose the router's administration page to the public
    internet.
-   Do not change TR-069, WAN, PPPoE, VLAN, GPON, firewall, DHCP, or
    bridge settings for this project.
-   Use only authorized, read-only router interfaces.
-   Mask MAC addresses in screenshots and the public demo.
-   Keep real device names and household traffic history out of public
    sample data.

------------------------------------------------------------------------

## 15. Known limitations and honest portfolio claims

### What is demonstrated

-   A Zyxel PMG5617-R20B router is accessible on the local network.
-   Its Network Map displayed six device entries during inspection.
-   Its WAN Traffic Status page exposed PPPoE cumulative sent and
    received byte counters.
-   Its LAN configuration showed DHCP enabled.
-   Router reachability was verified from Windows 11.

### What is not yet demonstrated

-   Automated programmatic retrieval of the Zyxel Network Map.
-   Automated programmatic retrieval of WAN counters.
-   SNMP availability.
-   UPnP availability.
-   Reliable per-device byte accounting.
-   Billing-cycle usage accuracy.

Do not claim these as completed until implemented and tested.

### Suggested resume description after completion

**HomeNet --- Home Network Monitoring & Analytics Platform**

Developed a Python and React-based network monitoring platform to
discover LAN devices, monitor connectivity and latency, collect WAN
traffic statistics where supported, and visualize historical network
usage. Implemented REST APIs, SQLite-based telemetry storage,
traffic-rate calculations, and Docker-based deployment.

Only retain claims that are actually completed and verified.

------------------------------------------------------------------------

## 16. Immediate next actions

1.  Create the project folders and Python virtual environment.
2.  Start the FastAPI health endpoint.
3.  Implement router ping and ARP discovery natively on Windows.
4.  Investigate an authorized read-only interface for the Zyxel router.
5.  Build the traffic-counter engine with manual snapshot support as a
    fallback.
6.  Connect the React dashboard after the backend endpoints are stable.

**Guiding principle:** Build a working, honest monitoring product first.
Treat router-specific automation and per-device traffic accounting as
capabilities to verify, not assumptions.
