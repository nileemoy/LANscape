# LANscape 🌐

> A lightweight, local-first network monitoring dashboard and interactive Wi-Fi floor-plan heatmap for home networks.

LANscape continuously observes your local area network (LAN), tracks router reachability, graphs real-time ping latency, and visualizes connected devices across an interactive floor-plan map with physical Wi-Fi signal attenuation modeling.

---

## ✨ Features

- 🗺️ **Interactive Home Floor-Plan Map**: Visual representation of devices mapped to rooms (living room, bedrooms, TV lounge, workspace) with real-time status pulses.
- 🎯 **Drag-and-Drop Device Relocation**: Click and drag any device bubble across the floor plan with dynamic guidelines, distance readouts, and one-click room placement presets.
- 📡 **Dual-Band Wi-Fi Heatmap & Live Proximity Physics**: Live signal propagation overlay for **2.4 GHz** and **5 GHz** bands. Moving a device closer to or farther from the router automatically recalibrates signal strength (`-XX dBm`), quality bars, and wall attenuation in real time.
- 📈 **Real-Time Latency & Gateway Telemetry**: Continuous gateway ping monitoring, packet loss calculation, and host transfer meters.
- 🔍 **Local Device Discovery**: Discovers active subnet nodes using ARP scanning and subnet sweeps, with automatic deduplication of DHCP lease changes.
- 🌙 **Midnight Retro Dark Mode**: Instant switch between high-contrast retro pop styling and a midnight navy dark theme with local storage persistence.
- 🔒 **Privacy-First & Zero-Cloud**: Operates completely on your local network. No external telemetry, no cloud accounts, and no credentials needed.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons
- **Backend**: FastAPI (Python 3.10+), SQLAlchemy, SQLite, Pydantic
- **Telemetry**: Native operating system network tools (`arp`, ICMP ping, `psutil`)

---

## 🚀 Quick Start (Windows)

### Option 1: One-Click Startup
Double-click `start.bat` (or execute `./start.ps1` in PowerShell). This launches both the FastAPI backend and Vite frontend in their own processes.

### Option 2: Manual Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
API documentation is available at `http://127.0.0.1:8000/docs`.

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## ⚙️ Configuration

Copy `backend/.env.example` to `backend/.env` to customize settings:

```env
LANSCAPE_HOST=127.0.0.1
LANSCAPE_PORT=8000
LANSCAPE_ROUTER_IP=192.168.1.1
```

---

## 📄 License

This project is open-source under the MIT License.
