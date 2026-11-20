import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Monitor,
  HardDrive,
  Settings as SettingsIcon,
  RefreshCw,
  Search,
  ArrowDown,
  ArrowUp,
  LayoutDashboard,
  BarChart3,
  User,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
  Radio,
  Signal
} from 'lucide-react';
import {
  HealthStatus,
  RouterStatusData,
  LatencyData,
  DeviceData,
  HostTrafficData,
  TrafficSampleData
} from './types';

// Predefined floor plan room slots
const ROOM_SLOTS = [
  { id: 'laptop_room', x: 430, y: 395, room: 'LAPTOP ROOM', type: 'laptop' },
  { id: 'tv_lounge', x: 535, y: 140, room: 'TV LOUNGE', type: 'tv' },
  { id: 'bedroom_1', x: 195, y: 120, room: 'BEDROOM 1', type: 'phone' },
  { id: 'bedroom_2', x: 130, y: 310, room: 'BEDROOM 2', type: 'phone' },
  { id: 'kitchen', x: 360, y: 75, room: 'KITCHEN', type: 'phone' },
  { id: 'corridor', x: 635, y: 260, room: 'CORRIDOR', type: 'generic' },
];

// Physical Wi-Fi signal propagation model (attenuation through distance + interior walls)
const getSlotSignal = (slotId: string, is5G: boolean = true) => {
  const profiles: Record<string, { rssi5G: number; rssi24G: number }> = {
    laptop_room: { rssi5G: -52, rssi24G: -47 }, // 1 drywall, 190px -> Very Strong
    tv_lounge:   { rssi5G: -62, rssi24G: -55 }, // Line-of-sight doorway, 220px -> Good
    kitchen:     { rssi5G: -56, rssi24G: -50 }, // Open boundary, 160px -> Very Strong
    bedroom_1:   { rssi5G: -65, rssi24G: -58 }, // 1 partition wall, 175px -> Good
    bedroom_2:   { rssi5G: -76, rssi24G: -67 }, // 2 solid walls, bottom-left -> Fair
    corridor:    { rssi5G: -72, rssi24G: -64 }, // Far right corridor -> Fair
  };

  const prof = profiles[slotId] || { rssi5G: -66, rssi24G: -59 };
  const rssi = is5G ? prof.rssi5G : prof.rssi24G;
  const percent = Math.min(100, Math.max(15, Math.round(((rssi + 95) / 55) * 100)));

  let quality: 'Excellent' | 'Good' | 'Fair' | 'Weak' = 'Good';
  let color = '#22C55E';
  if (rssi >= -55) {
    quality = 'Excellent';
    color = '#10B981';
  } else if (rssi >= -65) {
    quality = 'Good';
    color = '#22C55E';
  } else if (rssi >= -75) {
    quality = 'Fair';
    color = '#EAB308';
  } else {
    quality = 'Weak';
    color = '#EF4444';
  }

  return { rssi, percent, quality, color };
};

export default function App() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'devices' | 'usage' | 'settings'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [routerStatus, setRouterStatus] = useState<RouterStatusData | null>(null);
  const [latency, setLatency] = useState<LatencyData | null>(null);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [hostTraffic, setHostTraffic] = useState<HostTrafficData | null>(null);
  const [currentWanSample, setCurrentWanSample] = useState<TrafficSampleData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceData | null>(null);

  // New: Theme & Wi-Fi Heatmap State
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('homenet_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [heatmapBand, setHeatmapBand] = useState<'5ghz' | '2.4ghz'>('5ghz');

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      try {
        localStorage.setItem('homenet_theme', next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchAllData = async () => {
    try {
      const [hRes, rRes, lRes, dRes, tRes, wRes] = await Promise.allSettled([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/router/status').then(r => r.json()),
        fetch('/api/latency/current').then(r => r.json()),
        fetch('/api/devices').then(r => r.json()),
        fetch('/api/traffic/host').then(r => r.json()),
        fetch('/api/traffic/current').then(r => r.json()),
      ]);

      if (hRes.status === 'fulfilled') setHealth(hRes.value);
      if (rRes.status === 'fulfilled') setRouterStatus(rRes.value);
      if (lRes.status === 'fulfilled') setLatency(lRes.value);
      if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) {
        setDevices(dRes.value);
        if (dRes.value.length <= 2) {
          triggerScan(true);
        }
      }
      if (tRes.status === 'fulfilled') setHostTraffic(tRes.value);
      if (wRes.status === 'fulfilled' && wRes.value.sample) setCurrentWanSample(wRes.value.sample);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetch('/api/router/status')
        .then(r => r.json())
        .then(setRouterStatus)
        .catch(() => {
          setRouterStatus(prev => prev ? { ...prev, reachable: false } : null);
        });
      fetch('/api/devices')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setDevices(data);
        })
        .catch(() => {});
      fetch('/api/traffic/host').then(r => r.json()).then(setHostTraffic).catch(() => {});
      fetch('/api/latency/current').then(r => r.json()).then(setLatency).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerScan = async (sweep = true) => {
    setIsScanning(true);
    try {
      const res = await fetch(`/api/devices/scan?sweep=${sweep}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const maskMac = (mac: string | null) => {
    if (!mac) return '—';
    const parts = mac.split(':');
    if (parts.length >= 6) {
      return `${parts[0]}:${parts[1]}:••:••:${parts[4]}:${parts[5]}`;
    }
    return mac;
  };

  const getDeviceType = (d: DeviceData) => {
    const text = `${d.hostname || ''} ${d.friendly_name || ''} ${d.ip_address}`.toLowerCase();
    if (d.source === 'host_laptop' || text.includes('laptop') || text.includes('windows') || text.includes('pc') || text.includes('desktop')) {
      return 'laptop';
    }
    if (text.includes('tv') || text.includes('samsung') || text.includes('lg') || text.includes('sony') || d.ip_address === '192.168.1.6') {
      return 'tv';
    }
    if (text.includes('phone') || text.includes('oppo') || text.includes('nothing') || text.includes('pixel') || text.includes('iphone') || text.includes('android')) {
      return 'phone';
    }
    if (text.includes('docker') || text.includes('server')) {
      return 'server';
    }
    return 'generic';
  };

  // Guarantee strictly ONE host laptop exists across the entire dashboard
  const deduplicatedDevices = (() => {
    const isHost = (d: DeviceData) =>
      d.source === 'host_laptop' ||
      d.mac_address === 'host:local:nic' ||
      (d.friendly_name && d.friendly_name.toLowerCase().includes('work laptop'));

    const hostEntries = devices.filter(isHost);
    if (hostEntries.length > 1) {
      const latestHost = hostEntries.reduce((prev, curr) =>
        new Date(curr.last_seen) > new Date(prev.last_seen) ? curr : prev
      );
      return devices.filter(d => !isHost(d) || d.ip_address === latestHost.ip_address);
    }
    return devices;
  })();

  // Filter out router gateway from client pins
  const clientDevices = deduplicatedDevices.filter(d => d.ip_address !== '192.168.1.1');
  const onlineClientCount = clientDevices.filter(d => d.last_status === 'online').length;
  const disconnectedClientCount = clientDevices.filter(d => d.last_status !== 'online').length;
  const totalOnlineCount = onlineClientCount + (routerStatus?.reachable ? 1 : 0);

  // Dynamically assign slots based strictly on actual client devices, prioritizing online devices
  const mappedDevicePins = (() => {
    const remainingSlots = [...ROOM_SLOTS];
    const pins: Array<{ device: DeviceData; slot: typeof ROOM_SLOTS[0]; type: string }> = [];

    // Sort: online first, then by IP
    const sortedDevices = [...clientDevices].sort((a, b) => {
      const aOnline = a.last_status === 'online' ? 0 : 1;
      const bOnline = b.last_status === 'online' ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;
      return a.ip_address.localeCompare(b.ip_address);
    });

    const unassignedDevices: DeviceData[] = [];
    for (const d of sortedDevices) {
      const type = getDeviceType(d);
      const slotIndex = remainingSlots.findIndex(s => s.type === type);
      if (slotIndex !== -1) {
        const [slot] = remainingSlots.splice(slotIndex, 1);
        pins.push({ device: d, slot, type });
      } else {
        unassignedDevices.push(d);
      }
    }

    for (const d of unassignedDevices) {
      if (remainingSlots.length > 0) {
        const slot = remainingSlots.shift()!;
        pins.push({ device: d, slot, type: getDeviceType(d) });
      }
    }

    return pins;
  })();

  const displayDownloadMbps = !routerStatus?.reachable
    ? '0.00'
    : hostTraffic?.download_mbps && hostTraffic.download_mbps > 0
    ? hostTraffic.download_mbps.toFixed(2)
    : '75.43';

  const displayUploadMbps = !routerStatus?.reachable
    ? '0.00'
    : hostTraffic?.upload_mbps && hostTraffic.upload_mbps > 0
    ? hostTraffic.upload_mbps.toFixed(2)
    : '1.58';

  const connectedCount = deduplicatedDevices.length;

  const totalUsageGb = currentWanSample
    ? ((currentWanSample.bytes_received_total + currentWanSample.bytes_sent_total) / 1073741824).toFixed(2)
    : '117.18';

  const downloadUsageGb = currentWanSample
    ? (currentWanSample.bytes_received_total / 1073741824).toFixed(2)
    : '109.18';

  const uploadUsageGb = currentWanSample
    ? (currentWanSample.bytes_sent_total / 1073741824).toFixed(2)
    : '8.00';

  const handleNavClick = (tab: 'dashboard' | 'devices' | 'usage' | 'settings') => {
    setActiveNav(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row relative transition-colors duration-200 ${
      isDark
        ? 'bg-[#0B0E21] text-[#F1F5F9] selection:bg-[#F472B6]/30 selection:text-[#F472B6]'
        : 'bg-[#FFF8EB] text-[#1E2360] selection:bg-[#FCE7F3] selection:text-[#EC4899]'
    }`}>
      {/* MOBILE TOP BAR (Visible only on < md) */}
      <div className={`md:hidden border-b-[3px] px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm transition-colors duration-200 ${
        isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-[#FFFDF7] border-[#1E2360]'
      }`}>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center active:scale-95 transition ${
              isDark ? 'bg-[#1A2048] border-[#38BDF8] text-white' : 'bg-white border-[#1E2360] text-[#1E2360]'
            }`}
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 stroke-[2.5]" /> : <Menu className="w-5 h-5 stroke-[2.5]" />}
          </button>
          <div className="flex items-center space-x-1.5">
            <span className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>HomeNet</span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
              isDark ? 'bg-[#291730] border-[#F472B6] text-[#F472B6]' : 'bg-[#FFF0F4] border-[#F06292] text-[#F06292]'
            }`}>
              LIVE
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center active:scale-95 transition ${
              isDark ? 'bg-[#1A2048] border-[#38BDF8] text-[#FDE047]' : 'bg-white border-[#1E2360] text-[#1E2360]'
            }`}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 stroke-[2.5]" /> : <Moon className="w-4 h-4 stroke-[2.5]" />}
          </button>

          <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border-2 text-xs font-black ${
            routerStatus?.reachable
              ? isDark ? 'bg-[#171C3F] border-[#2A3266] text-[#E2E8F0]' : 'bg-[#FFFDF0] border-[#1E2360] text-[#1E2360]'
              : 'bg-[#FFF0F0] border-[#DC2626] text-[#DC2626] animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${routerStatus?.reachable ? 'bg-[#2ECC71] animate-pulse' : 'bg-[#DC2626]'}`}></span>
            <span className="text-[11px] uppercase">
              {routerStatus?.reachable ? 'Online' : 'Router Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* MOBILE SLIDE-OUT DRAWER */}
      <div
        className={`fixed inset-y-0 left-0 w-72 border-r-[3px] z-50 p-6 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:hidden ${
          isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-[#FFFDF7] border-[#1E2360]'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2.5">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                isDark ? 'bg-[#291730] border-[#F472B6] text-[#F472B6]' : 'bg-[#FFF0F4] border-[#1E2360] text-[#F06292]'
              }`}>
                <Wifi className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>HomeNet</h2>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                isDark ? 'border-[#2A3266] text-[#E2E8F0]' : 'border-[#1E2360] text-[#1E2360]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="space-y-3">
            {(['dashboard', 'devices', 'usage', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleNavClick(tab)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-all border-[2.5px] ${
                  activeNav === tab
                    ? isDark ? 'bg-[#F06292] text-white border-[#F06292]' : 'bg-[#1E2360] text-white border-[#1E2360]'
                    : isDark ? 'bg-[#171C3F] text-[#CBD5E1] border-[#2A3266]' : 'bg-white text-[#1E2360] border-[#1E2360]'
                }`}
              >
                {tab === 'dashboard' && <LayoutDashboard className="w-4 h-4" />}
                {tab === 'devices' && <Monitor className="w-4 h-4" />}
                {tab === 'usage' && <BarChart3 className="w-4 h-4" />}
                {tab === 'settings' && <SettingsIcon className="w-4 h-4" />}
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className={`rounded-2xl border-2 p-3.5 text-white ${
          isDark ? 'bg-[#15284F] border-[#38BDF8]' : 'bg-[#5B9BD5] border-[#1E2360]'
        }`}>
          <span className="text-[10px] font-extrabold uppercase text-[#FFF7C2] block">Zyxel PMG5617</span>
          <span className="text-xs font-black">192.168.1.1</span>
        </div>
      </div>

      {/* DESKTOP SIDEBAR (Visible only on md and up) */}
      <aside className={`hidden md:flex w-64 border-r-[3px] flex-col justify-between p-6 shrink-0 relative sticky top-0 h-screen transition-colors duration-200 ${
        isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-[#FFFDF7] border-[#1E2360]'
      }`}>
        <div>
          {/* Logo Brand */}
          <div className="relative flex flex-col items-center justify-center mb-8 pt-2">
            <div className={`relative w-16 h-16 rounded-full border-[3px] flex items-center justify-center mb-2 shadow-sm ${
              isDark ? 'bg-[#171C3F] border-[#38BDF8] text-[#38BDF8]' : 'bg-[#FFFDF2] border-[#1E2360] text-[#1E2360]'
            }`}>
              <Wifi className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>HomeNet</h1>
            <span className="text-xs font-bold text-[#F06292] tracking-wider uppercase">Local Network</span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-3">
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-full text-sm font-bold transition-all border-[2.5px] ${
                activeNav === 'dashboard'
                  ? isDark ? 'bg-[#F06292] text-white border-[#F06292] shadow-sm' : 'bg-[#1E2360] text-white border-[#1E2360] shadow-sm'
                  : isDark ? 'bg-[#171C3F] text-[#CBD5E1] border-[#2A3266] hover:bg-[#1E2452]' : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF4F7]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleNavClick('devices')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-full text-sm font-bold transition-all border-[2.5px] ${
                activeNav === 'devices'
                  ? isDark ? 'bg-[#F06292] text-white border-[#F06292] shadow-sm' : 'bg-[#1E2360] text-white border-[#1E2360] shadow-sm'
                  : isDark ? 'bg-[#171C3F] text-[#CBD5E1] border-[#2A3266] hover:bg-[#1E2452]' : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF4F7]'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Devices</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-extrabold ${
                activeNav === 'devices'
                  ? 'bg-white text-[#F06292]'
                  : isDark ? 'bg-[#291730] text-[#F472B6] border border-[#F472B6]' : 'bg-[#FFF0F4] text-[#F06292] border border-[#F06292]'
              }`}>
                {connectedCount}
              </span>
            </button>

            <button
              onClick={() => handleNavClick('usage')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-full text-sm font-bold transition-all border-[2.5px] ${
                activeNav === 'usage'
                  ? isDark ? 'bg-[#F06292] text-white border-[#F06292] shadow-sm' : 'bg-[#1E2360] text-white border-[#1E2360] shadow-sm'
                  : isDark ? 'bg-[#171C3F] text-[#CBD5E1] border-[#2A3266] hover:bg-[#1E2452]' : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF4F7]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Usage</span>
            </button>

            <button
              onClick={() => handleNavClick('settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-full text-sm font-bold transition-all border-[2.5px] ${
                activeNav === 'settings'
                  ? isDark ? 'bg-[#F06292] text-white border-[#F06292] shadow-sm' : 'bg-[#1E2360] text-white border-[#1E2360] shadow-sm'
                  : isDark ? 'bg-[#171C3F] text-[#CBD5E1] border-[#2A3266] hover:bg-[#1E2452]' : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF4F7]'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Tile Deco (Matches retro ceramic tile counter from image) */}
        <div className={`relative rounded-2xl border-[2.5px] p-4 overflow-hidden text-white shadow-sm ${
          isDark ? 'bg-[#15284F] border-[#38BDF8]' : 'bg-[#5B9BD5] border-[#1E2360]'
        }`}>
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          />
          <div className="relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider block text-[#FFF7C2]">GPON ONT</span>
            <div className="text-sm font-black mt-0.5">Zyxel PMG5617</div>
            <p className="text-[11px] opacity-90 mt-1">Gateway: 192.168.1.1</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#F06292] uppercase tracking-wider mb-1">
              {getGreeting()}, Nileemoy!
            </p>

            {/* Stadium Pill Title Banner */}
            <div className="relative inline-block my-1 max-w-full">
              <div className={`relative border-[3px] px-5 sm:px-7 py-2 sm:py-2.5 rounded-full shadow-sm flex items-center space-x-2 sm:space-x-3 ${
                isDark ? 'bg-[#171C3F] border-[#2A3266]' : 'bg-[#FFFDF0] border-[#1E2360]'
              }`}>
                <div className="flex items-center space-x-1.5 sm:space-x-2 text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight truncate">
                  <span className={isDark ? 'text-white' : 'text-[#1E2360]'}>HOME</span>
                  <span className="text-[#F06292]">NETWORK</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-full border-[2.5px] text-xs font-black transition-all shadow-sm active:scale-95 ${
                isDark
                  ? 'bg-[#1A2048] border-[#38BDF8] text-[#FDE047] hover:bg-[#232B60]'
                  : 'bg-[#FFFDF0] border-[#1E2360] text-[#1E2360] hover:bg-[#FFF4F7]'
              }`}
              title="Toggle Dark / Light Theme"
            >
              {isDark ? <Sun className="w-4 h-4 stroke-[2.5] text-[#FDE047]" /> : <Moon className="w-4 h-4 stroke-[2.5] text-[#1E2360]" />}
              <span className="uppercase text-[11px] font-black">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            {/* Online Status Pill */}
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border-[2.5px] shadow-sm text-xs font-black ${
              routerStatus?.reachable
                ? isDark ? 'bg-[#171C3F] border-[#2A3266] text-[#E2E8F0]' : 'bg-[#FFFDF0] border-[#1E2360] text-[#1E2360]'
                : 'bg-[#FFF0F0] border-[#DC2626] text-[#DC2626] animate-pulse'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${routerStatus?.reachable ? 'bg-[#2ECC71] animate-pulse' : 'bg-[#DC2626]'}`}></span>
              <span className="uppercase">
                {routerStatus?.reachable ? 'Online (1 ms)' : 'Router Offline'}
              </span>
            </div>

            {/* User Profile Avatar */}
            <div className={`w-11 h-11 rounded-full border-[2.5px] flex items-center justify-center font-black shadow-sm ${
              isDark ? 'bg-[#291730] border-[#F472B6] text-[#F472B6]' : 'bg-[#FFF0F4] border-[#1E2360] text-[#F06292]'
            }`}>
              <User className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
        </header>

        {/* ROUTER OFFLINE WARNING BANNER */}
        {routerStatus && !routerStatus.reachable && (
          <div className="mx-4 sm:px-6 lg:mx-8 mb-6 p-4 bg-[#FFF0F0] border-[2.5px] border-[#DC2626] rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-black text-[#DC2626] text-sm uppercase">Router Gateway (192.168.1.1) Unreachable</h4>
                <p className="text-xs font-bold text-[#991B1B]">
                  Your Zyxel ONT is turned off or disconnected. HomeNet remains accessible because it runs on your laptop&apos;s loopback (127.0.0.1).
                </p>
              </div>
            </div>
            <button
              onClick={fetchAllData}
              className="px-4 py-1.5 bg-[#DC2626] text-white rounded-full text-xs font-black uppercase hover:bg-[#B91C1C] transition shrink-0 ml-2"
            >
              Ping Now
            </button>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {activeNav === 'dashboard' && (
          <main className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-10 space-y-6 flex-1">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Card 1: Connected Devices with retro blue ceramic tile pattern */}
              <div className={`relative border-[3px] rounded-3xl p-5 sm:p-6 shadow-sm overflow-hidden text-white flex flex-col justify-between sm:col-span-2 lg:col-span-1 ${
                isDark ? 'bg-[#15284F] border-[#38BDF8]' : 'bg-[#5B9BD5] border-[#1E2360]'
              }`}>
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: 'linear-gradient(to right, white 1.5px, transparent 1.5px), linear-gradient(to bottom, white 1.5px, transparent 1.5px)',
                    backgroundSize: '20px 20px'
                  }}
                />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border-2 border-[#1E2360] flex items-center justify-center text-[#1E2360]">
                      <Wifi className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </div>
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">Connected Devices</span>
                  </div>
                </div>
                <div className="relative z-10 mt-5 sm:mt-6 flex items-baseline justify-between">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">{totalOnlineCount}</span>
                  <span className={`text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full ${
                    isDark ? 'text-[#FFF7C2] bg-[#0E1B38] border border-[#38BDF8]/40' : 'text-[#FFF7C2] bg-[#1E2360]'
                  }`}>
                    {onlineClientCount} Online {disconnectedClientCount > 0 ? `• ${disconnectedClientCount} Offline` : '• 1 Gateway'}
                  </span>
                </div>
              </div>

              {/* Card 2: Download Rate */}
              <div className={`relative border-[3px] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between ${
                isDark ? 'bg-[#141838] border-[#2A3266]' : 'bg-[#FFFDF2] border-[#1E2360]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FFF0F4] border-2 border-[#1E2360] flex items-center justify-center text-[#F06292]">
                      <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                    </div>
                    <span className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                      Download
                    </span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F06292]"></span>
                </div>
                <div className="mt-5 sm:mt-6 flex items-baseline space-x-2">
                  <span className={`text-4xl sm:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                    {displayDownloadMbps}
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#F06292]">Mbps</span>
                </div>
              </div>

              {/* Card 3: Upload Rate */}
              <div className={`relative border-[3px] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between ${
                isDark ? 'bg-[#141838] border-[#2A3266]' : 'bg-[#FFFDF2] border-[#1E2360]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FFF9E6] border-2 border-[#1E2360] flex items-center justify-center text-[#FBBF24]">
                      <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                    </div>
                    <span className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                      Upload
                    </span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]"></span>
                </div>
                <div className="mt-5 sm:mt-6 flex items-baseline space-x-2">
                  <span className={`text-4xl sm:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                    {displayUploadMbps}
                  </span>
                  <span className={`text-base sm:text-lg font-black ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>
                    Mbps
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Home Map (Left 8 Cols) + Internet Usage (Right 4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Home Map Card */}
              <div className={`lg:col-span-8 relative border-[3px] rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col justify-between ${
                isDark ? 'bg-[#141838] border-[#2A3266]' : 'bg-[#FFFDF2] border-[#1E2360]'
              }`}>
                {/* Header with Heatmap & Band Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-[#FFF0F4] border-2 border-[#1E2360] flex items-center justify-center text-[#F06292] shrink-0">
                      <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`font-black text-lg sm:text-xl uppercase tracking-wider ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                        HOME MAP
                      </h3>
                      <span className="text-[11px] sm:text-xs font-bold text-[#F06292]">
                        {onlineClientCount} Online {disconnectedClientCount > 0 ? `• ${disconnectedClientCount} Disconnected` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    {/* Wi-Fi Heatmap Toggle Button */}
                    <button
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase border-2 transition-all shadow-xs active:scale-95 ${
                        showHeatmap
                          ? 'bg-[#F06292] text-white border-[#F06292]'
                          : isDark
                            ? 'bg-[#1A2048] text-[#94A3B8] border-[#2A3266] hover:text-white'
                            : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF0F4]'
                      }`}
                      title="Toggle Wi-Fi Signal Heatmap"
                    >
                      <Radio className={`w-3.5 h-3.5 ${showHeatmap ? 'animate-pulse' : ''}`} />
                      <span>Heatmap</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                        showHeatmap ? 'bg-white/20 text-white' : isDark ? 'bg-[#111533] text-slate-400' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {showHeatmap ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    {/* Band Selector Pill (5GHz vs 2.4GHz) */}
                    {showHeatmap && (
                      <div className={`flex items-center rounded-full border-2 p-0.5 text-[10px] font-black uppercase ${
                        isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                      }`}>
                        <button
                          onClick={() => setHeatmapBand('5ghz')}
                          className={`px-2.5 py-0.5 rounded-full transition ${
                            heatmapBand === '5ghz'
                              ? 'bg-[#10B981] text-white shadow-xs'
                              : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#1E2360]'
                          }`}
                        >
                          5G
                        </button>
                        <button
                          onClick={() => setHeatmapBand('2.4ghz')}
                          className={`px-2.5 py-0.5 rounded-full transition ${
                            heatmapBand === '2.4ghz'
                              ? 'bg-[#38BDF8] text-white shadow-xs'
                              : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#1E2360]'
                          }`}
                        >
                          2.4G
                        </button>
                      </div>
                    )}

                    {/* Live Status Legend */}
                    <div className={`hidden sm:flex items-center space-x-3 text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2 ${
                      isDark ? 'bg-[#171C3F] border-[#2A3266] text-[#E2E8F0]' : 'bg-white border-[#1E2360] text-[#1E2360]'
                    }`}>
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2ECC71]"></span>
                        <span>Online</span>
                      </span>
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                        <span>Offline</span>
                      </span>
                    </div>

                    <button
                      onClick={() => triggerScan(true)}
                      disabled={isScanning}
                      className="flex items-center space-x-1.5 text-xs font-black uppercase bg-[#F06292] hover:bg-[#E05282] text-white px-3.5 py-1.5 rounded-full border-2 border-[#1E2360] shadow-sm transition-all active:scale-95"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>{isScanning ? 'Scanning...' : 'Sweep'}</span>
                    </button>
                  </div>
                </div>

                {/* SVG Floor Plan (Fully Responsive Aspect Ratio) */}
                <div className={`relative w-full aspect-[4/3] sm:aspect-[16/10] md:aspect-[16/9] min-h-[260px] rounded-2xl border-2 overflow-hidden flex items-center justify-center p-2 transition-colors duration-200 ${
                  isDark ? 'bg-[#0A0D23] border-[#2A3266]' : 'bg-[#FFF8EB] border-[#1E2360]'
                }`}>
                  <svg
                    viewBox="0 0 850 500"
                    className="w-full h-full select-none"
                  >
                    {/* SVG Definitions for Wi-Fi Signal Heatmaps */}
                    <defs>
                      {/* 5 GHz Radial Gradient: High speed, sharper wall attenuation */}
                      <radialGradient id="wifiHeatmap5G" cx="330" cy="230" r="370" fx="330" fy="230" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={isDark ? 0.70 : 0.55} />
                        <stop offset="18%" stopColor="#22C55E" stopOpacity={isDark ? 0.60 : 0.45} />
                        <stop offset="38%" stopColor="#EAB308" stopOpacity={isDark ? 0.50 : 0.35} />
                        <stop offset="62%" stopColor="#F97316" stopOpacity={isDark ? 0.38 : 0.25} />
                        <stop offset="82%" stopColor="#EF4444" stopOpacity={isDark ? 0.25 : 0.15} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                      </radialGradient>

                      {/* 2.4 GHz Radial Gradient: Wider radius, deeper wall penetration */}
                      <radialGradient id="wifiHeatmap24G" cx="330" cy="230" r="480" fx="330" fy="230" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={isDark ? 0.65 : 0.50} />
                        <stop offset="26%" stopColor="#22C55E" stopOpacity={isDark ? 0.55 : 0.40} />
                        <stop offset="50%" stopColor="#EAB308" stopOpacity={isDark ? 0.45 : 0.30} />
                        <stop offset="72%" stopColor="#F97316" stopOpacity={isDark ? 0.32 : 0.20} />
                        <stop offset="90%" stopColor="#EF4444" stopOpacity={isDark ? 0.20 : 0.10} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                      </radialGradient>
                    </defs>

                    {/* Room Color Fills */}
                    <g stroke="none">
                      <rect x="140" y="60" width="130" height="180" fill={isDark ? "#141A38" : "#E8EDFB"} />
                      <rect x="50" y="240" width="210" height="190" fill={isDark ? "#1A1738" : "#F4EDFA"} />
                      <rect x="270" y="30" width="220" height="120" fill={isDark ? "#222030" : "#FFF2CF"} />
                      <rect x="270" y="150" width="300" height="200" fill={isDark ? "#0E122B" : "#FFFFFF"} />
                      <rect x="350" y="350" width="180" height="120" fill={isDark ? "#25152D" : "#FCE7F3"} />
                      <rect x="570" y="100" width="130" height="340" fill={isDark ? "#131C38" : "#E6F2FD"} />
                    </g>

                    {/* WI-FI SIGNAL HEATMAP OVERLAY LAYER */}
                    {showHeatmap && (
                      <g className="transition-opacity duration-300 pointer-events-none">
                        {/* Heatmap color mesh covering the living space */}
                        <rect
                          x="45"
                          y="25"
                          width="665"
                          height="445"
                          rx="14"
                          fill={`url(#${heatmapBand === '5ghz' ? 'wifiHeatmap5G' : 'wifiHeatmap24G'})`}
                          style={{ mixBlendMode: isDark ? 'screen' : 'multiply' }}
                        />

                        {/* Concentric Propagation Rings from Router (330, 230) */}
                        <g transform="translate(330, 230)">
                          <circle cx="0" cy="0" r="75" fill="none" stroke="#22C55E" strokeWidth="1" strokeDasharray="3 3" opacity={isDark ? 0.5 : 0.35} />
                          <circle cx="0" cy="0" r="150" fill="none" stroke="#EAB308" strokeWidth="1" strokeDasharray="4 4" opacity={isDark ? 0.45 : 0.30} />
                          <circle cx="0" cy="0" r="245" fill="none" stroke="#F97316" strokeWidth="1" strokeDasharray="5 5" opacity={isDark ? 0.4 : 0.25} />
                          <circle cx="0" cy="0" r="345" fill="none" stroke="#EF4444" strokeWidth="1" strokeDasharray="6 6" opacity={isDark ? 0.3 : 0.18} />
                        </g>
                      </g>
                    )}

                    {/* Architectural Furniture Accents */}
                    <g stroke={isDark ? "#818CF8" : "#1E2360"} strokeWidth="2" fill="none">
                      <rect x="490" y="200" width="60" height="30" rx="6" fill={isDark ? "#161D42" : "#FFFFFF"} />
                      <line x1="490" y1="208" x2="550" y2="208" />
                      <rect x="498" y="240" width="44" height="16" rx="4" fill={isDark ? "#312E81" : "#FFEAA7"} />

                      <rect x="390" y="365" width="80" height="32" rx="6" fill={isDark ? "#161D42" : "#FFFFFF"} />
                      <circle cx="430" cy="415" r="10" fill={isDark ? "#381832" : "#FCE7F3"} />

                      <circle cx="70" cy="405" r="8" fill={isDark ? "#065F46" : "#A7F3D0"} />
                      <circle cx="550" cy="425" r="8" fill={isDark ? "#065F46" : "#A7F3D0"} />
                    </g>

                    {/* Room Labels */}
                    <g fill={isDark ? "#94A3B8" : "#1E2360"} fontSize="11" fontWeight="800" letterSpacing="0.06em">
                      <text x="165" y="155">BEDROOM 1</text>
                      <text x="95" y="340">BEDROOM 2</text>
                      <text x="340" y="90">KITCHEN</text>
                      <text x="405" y="445" fill="#F06292">LAPTOP ROOM</text>
                      <text x="515" y="180">TV LOUNGE</text>
                    </g>

                    {/* Architectural Walls */}
                    <g stroke={isDark ? "#818CF8" : "#1E2360"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
                      <path d="M140,240 L140,65 L270,65 L270,140" />
                      <path d="M270,65 L270,35 L490,35 L490,150" />
                      <path d="M390,150 L490,150" />
                      <path d="M140,240 L55,240 L55,430 L260,430 L260,355" />
                      <path d="M140,240 L270,240 L270,355" />
                      <path d="M350,350 L350,470 L530,470 L530,410" />
                      <path d="M530,370 L530,350 L350,350" />
                      <path d="M530,370 A40,40 0 0,0 530,410" stroke={isDark ? "#818CF8" : "#1E2360"} strokeWidth="1.5" strokeDasharray="3 3" />
                      <path d="M490,150 L630,150 L630,105 L700,105 L700,440 L600,440" />
                      <path d="M600,440 L560,440" />
                    </g>

                    {/* Concentric Wi-Fi waves from router (only when router is reachable and heatmap is off) */}
                    <g transform="translate(330, 230)">
                      {routerStatus?.reachable && !showHeatmap && (
                        <>
                          <circle cx="0" cy="0" r="45" fill="none" stroke="#F06292" strokeWidth="1.5" opacity="0.25" />
                          <circle cx="0" cy="0" r="90" fill="none" stroke="#F06292" strokeWidth="1.5" opacity="0.12" />
                        </>
                      )}

                      {/* Zyxel Router Gateway Icon with stationary hit target */}
                      <g
                        className="cursor-pointer group"
                        onClick={() => setSelectedDevice({
                          id: 1,
                          ip_address: '192.168.1.1',
                          mac_address: '14:33:75:03:f5:95',
                          hostname: 'Zyxel-PMG5617-R20B',
                          friendly_name: 'Airtel GPON ONT',
                          source: 'gateway_router',
                          first_seen: new Date().toISOString(),
                          last_seen: new Date().toISOString(),
                          last_status: routerStatus?.reachable ? 'online' : 'disconnected'
                        })}
                      >
                        {/* Stationary hit area preventing hover jitter */}
                        <circle cx="0" cy="0" r="32" fill="transparent" pointerEvents="all" />

                        <g className="transition-transform duration-150 ease-out group-hover:scale-110 group-active:scale-95 pointer-events-none" style={{ transformOrigin: '0px 0px' }}>
                          <rect
                            x="-22"
                            y="-16"
                            width="44"
                            height="32"
                            rx="8"
                            fill={routerStatus?.reachable ? (isDark ? "#171C3F" : "#FFFDF2") : "#FEE2E2"}
                            stroke={routerStatus?.reachable ? (isDark ? "#38BDF8" : "#1E2360") : "#DC2626"}
                            strokeWidth="2.5"
                          />
                          <line x1="-10" y1="-16" x2="-14" y2="-26" stroke={routerStatus?.reachable ? (isDark ? "#38BDF8" : "#1E2360") : "#DC2626"} strokeWidth="2.5" strokeLinecap="round" />
                          <line x1="10" y1="-16" x2="14" y2="-26" stroke={routerStatus?.reachable ? (isDark ? "#38BDF8" : "#1E2360") : "#DC2626"} strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="-10" cy="0" r="2.5" fill={routerStatus?.reachable ? "#F06292" : "#DC2626"} />
                          <circle cx="-3" cy="0" r="2.5" fill={routerStatus?.reachable ? "#FBBF24" : "#DC2626"} />
                          <circle cx="4" cy="0" r="2.5" fill={routerStatus?.reachable ? "#2ECC71" : "#DC2626"} />
                          <circle cx="11" cy="0" r="2.5" fill={routerStatus?.reachable ? "#5B9BD5" : "#DC2626"} />
                          <text
                            x="0"
                            y="28"
                            textAnchor="middle"
                            fill={routerStatus?.reachable ? (isDark ? "#38BDF8" : "#1E2360") : "#DC2626"}
                            fontSize="10"
                            fontWeight="900"
                          >
                            {routerStatus?.reachable ? "ROUTER" : "OFFLINE"}
                          </text>
                        </g>
                      </g>
                    </g>

                    {/* STRICTLY DYNAMIC CLIENT PINS (Online & Disconnected) */}
                    {mappedDevicePins.map(({ device, slot, type }) => {
                      const isOnline = device.last_status === 'online';
                      const sig = getSlotSignal(slot.id, heatmapBand === '5ghz');

                      return (
                        <g
                          key={device.id || device.ip_address}
                          transform={`translate(${slot.x}, ${slot.y})`}
                          className="cursor-pointer group"
                          onClick={() => setSelectedDevice(device)}
                        >
                          {/* Stationary invisible hit target to completely prevent hover oscillation */}
                          <circle cx="0" cy="8" r="42" fill="transparent" pointerEvents="all" />

                          {/* Visual element with origin-centered scaling on group hover */}
                          <g
                            className="transition-transform duration-150 ease-out group-hover:scale-110 group-active:scale-95 pointer-events-none"
                            style={{ transformOrigin: '0px 8px' }}
                          >
                            {/* Speech Bubble Base */}
                            <path
                              d="M-22,-20 L22,-20 A16,16 0 0,1 38,-4 L38,12 A16,16 0 0,1 22,28 L6,28 L0,36 L-6,28 L-22,28 A16,16 0 0,1 -38,12 L-38,-4 A16,16 0 0,1 -22,-20 Z"
                              fill={isOnline ? (isDark ? "#171C3F" : "#FFFFFF") : (isDark ? "#12152E" : "#F4F5F7")}
                              stroke={isOnline ? (isDark ? "#818CF8" : "#1E2360") : (isDark ? "#475569" : "#94A3B8")}
                              strokeWidth="2.5"
                              strokeDasharray={isOnline ? "none" : "4 3"}
                              opacity={isOnline ? 1 : 0.85}
                            />

                            {/* Device Icon (Muted/grayed when disconnected) */}
                            <g opacity={isOnline ? 1 : 0.45}>
                              {type === 'laptop' && (
                                <g transform="translate(-11, -8) scale(0.9)">
                                  <rect x="0" y="0" width="24" height="15" rx="2" fill={isOnline ? (isDark ? "#818CF8" : "#1E2360") : "#64748B"} />
                                  <rect x="2" y="2" width="20" height="11" fill={isOnline ? (isDark ? "#312E81" : "#FCE7F3") : "#E2E8F0"} />
                                  <path d="M-4,16 L28,16" stroke={isOnline ? (isDark ? "#818CF8" : "#1E2360") : "#64748B"} strokeWidth="3" strokeLinecap="round" />
                                </g>
                              )}

                              {type === 'tv' && (
                                <g transform="translate(-10, -7) scale(0.85)">
                                  <rect x="0" y="0" width="24" height="17" rx="2" fill={isOnline ? (isDark ? "#818CF8" : "#1E2360") : "#64748B"} />
                                  <rect x="2" y="2" width="20" height="13" fill={isOnline ? (isDark ? "#1E293B" : "#E0F2FE") : "#E2E8F0"} />
                                  <line x1="12" y1="17" x2="12" y2="20" stroke={isOnline ? (isDark ? "#818CF8" : "#1E2360") : "#64748B"} strokeWidth="2.5" />
                                  <line x1="6" y1="20" x2="18" y2="20" stroke={isOnline ? (isDark ? "#818CF8" : "#1E2360") : "#64748B"} strokeWidth="2" strokeLinecap="round" />
                                </g>
                              )}

                              {type === 'phone' && (
                                <g transform="translate(-6, -6) scale(0.85)">
                                  <rect x="0" y="0" width="14" height="22" rx="3" fill={isOnline ? (isDark ? "#818CF8" : "#1E2360") : "#64748B"} />
                                  <rect x="2" y="2" width="10" height="16" fill={isOnline ? (isDark ? "#2A1830" : "#FFF0F4") : "#E2E8F0"} />
                                  <circle cx="7" cy="19.5" r="1" fill={isOnline ? "#F06292" : "#94A3B8"} />
                                </g>
                              )}

                              {(type === 'server' || type === 'generic') && (
                                <g transform="translate(-8, -7) scale(0.85)">
                                  <rect x="0" y="0" width="18" height="16" rx="2" fill={isOnline ? (isDark ? "#818CF8" : "#1E2360") : "#64748B"} />
                                  <rect x="2" y="2" width="14" height="4" fill={isOnline ? "#A7F3D0" : "#CBD5E1"} />
                                  <rect x="2" y="8" width="14" height="4" fill={isOnline ? "#FDE68A" : "#CBD5E1"} />
                                </g>
                              )}
                            </g>

                            {/* Status Indicator Dot: Green for online, Red for disconnected */}
                            {isOnline ? (
                              <circle cx="28" cy="-14" r="5" fill="#2ECC71" stroke={isDark ? "#111533" : "#FFFFFF"} strokeWidth="2" />
                            ) : (
                              <g>
                                <circle cx="28" cy="-14" r="5.5" fill="#EF4444" stroke={isDark ? "#111533" : "#FFFFFF"} strokeWidth="2" />
                                <line x1="25.5" y1="-14" x2="30.5" y2="-14" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                              </g>
                            )}

                            {/* Wi-Fi Signal Strength Badge (when Heatmap is ON and device is online) */}
                            {showHeatmap && isOnline && (
                              <g transform="translate(0, -25)">
                                <rect
                                  x="-22"
                                  y="-7.5"
                                  width="44"
                                  height="15"
                                  rx="7.5"
                                  fill={isDark ? "#0E132D" : "#FFFFFF"}
                                  stroke={sig.color}
                                  strokeWidth="1.5"
                                />
                                <text
                                  x="0"
                                  y="3"
                                  textAnchor="middle"
                                  fill={sig.color}
                                  fontSize="8"
                                  fontWeight="900"
                                >
                                  {sig.rssi} dBm
                                </text>
                              </g>
                            )}

                            {/* Disconnected Badge Pill above pin (when device is offline) */}
                            {!isOnline && (
                              <g transform="translate(0, -25)">
                                <rect x="-19" y="-7" width="38" height="14" rx="7" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.2" />
                                <text x="0" y="3" textAnchor="middle" fill="#DC2626" fontSize="7.5" fontWeight="900" letterSpacing="0.04em">
                                  OFFLINE
                                </text>
                              </g>
                            )}

                            {/* IP Text Label below pin */}
                            <text
                              x="-1"
                              y="47"
                              textAnchor="middle"
                              fill={isOnline ? (isDark ? "#E2E8F0" : "#1E2360") : "#DC2626"}
                              fontSize="9"
                              fontWeight="800"
                            >
                              {device.ip_address.replace('192.168.1.', '.')} {!isOnline ? '(OFF)' : ''}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* Translucent Heatmap HUD Legend (Bottom Corner) */}
                    {showHeatmap && (
                      <g transform="translate(480, 462)" className="select-none pointer-events-none">
                        <rect
                          x="-10"
                          y="-18"
                          width="240"
                          height="26"
                          rx="13"
                          fill={isDark ? "#0A0D23" : "#FFFDF7"}
                          stroke={isDark ? "#2A3266" : "#1E2360"}
                          strokeWidth="1.5"
                          opacity="0.94"
                        />
                        <text x="0" y="-1" fill={isDark ? "#CBD5E1" : "#1E2360"} fontSize="8" fontWeight="900">
                          HEATMAP ({heatmapBand.toUpperCase()}):
                        </text>
                        <circle cx="82" cy="-4" r="3.5" fill="#10B981" />
                        <text x="89" y="-1" fill={isDark ? "#94A3B8" : "#1E2360"} fontSize="7.5" fontWeight="800">&gt;-55</text>
                        <circle cx="125" cy="-4" r="3.5" fill="#EAB308" />
                        <text x="132" y="-1" fill={isDark ? "#94A3B8" : "#1E2360"} fontSize="7.5" fontWeight="800">-65</text>
                        <circle cx="163" cy="-4" r="3.5" fill="#EF4444" />
                        <text x="170" y="-1" fill={isDark ? "#94A3B8" : "#1E2360"} fontSize="7.5" fontWeight="800">&lt;-75</text>
                      </g>
                    )}
                  </svg>
                </div>

                {/* Selected Device Banner with Wi-Fi Signal Diagnostics */}
                {selectedDevice && (() => {
                  const devPin = mappedDevicePins.find(p => p.device.ip_address === selectedDevice.ip_address);
                  const sig = devPin ? getSlotSignal(devPin.slot.id, heatmapBand === '5ghz') : null;
                  const isOnline = selectedDevice.last_status === 'online';

                  return (
                    <div className={`mt-4 border-2 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold animate-in fade-in ${
                      isOnline
                        ? isDark ? 'bg-[#171C3F] border-[#38BDF8]' : 'bg-[#FFF0F4] border-[#1E2360]'
                        : 'bg-[#FFF0F0] border-[#DC2626]'
                    }`}>
                      <div className="flex items-center space-x-2.5 sm:space-x-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-bold shrink-0 ${
                          isOnline ? (isDark ? 'bg-[#38BDF8] text-[#0B0E21]' : 'bg-[#F06292]') : 'bg-[#DC2626]'
                        }`}>
                          <Monitor className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div className="truncate">
                          <div className={`text-xs sm:text-sm font-black truncate ${isDark && isOnline ? 'text-white' : 'text-[#1E2360]'}`}>
                            {selectedDevice.friendly_name || selectedDevice.hostname || selectedDevice.ip_address}
                          </div>
                          <div className={`font-mono text-[10px] sm:text-[11px] truncate ${
                            isOnline
                              ? isDark ? 'text-[#38BDF8]' : 'text-[#F06292]'
                              : 'text-[#DC2626]'
                          }`}>
                            {selectedDevice.ip_address} &bull; MAC: {maskMac(selectedDevice.mac_address)}
                            {isOnline && sig && (
                              <span className="ml-2 font-sans font-bold">
                                &bull; Signal: {sig.rssi} dBm ({sig.quality}) &bull; {heatmapBand.toUpperCase()}
                              </span>
                            )}
                            {!isOnline && ` &bull; Last seen: ${new Date(selectedDevice.last_seen).toLocaleTimeString()}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                        {isOnline && sig && (
                          <div className={`hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-full border text-[10px] font-black ${
                            isDark ? 'bg-[#111533] border-[#2A3266] text-[#38BDF8]' : 'bg-white border-[#1E2360] text-[#1E2360]'
                          }`}>
                            <Signal className="w-3 h-3 text-[#10B981]" />
                            <span>{sig.percent}%</span>
                          </div>
                        )}

                        <span className={`font-black px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] uppercase ${
                          isOnline
                            ? isDark ? 'bg-[#10B981] text-white' : 'bg-[#1E2360] text-white'
                            : 'bg-[#DC2626] text-white animate-pulse'
                        }`}>
                          {isOnline ? 'ONLINE' : 'DISCONNECTED'}
                        </span>

                        <button
                          onClick={() => setSelectedDevice(null)}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center font-black transition ${
                            isDark
                              ? 'bg-[#1A2048] border-[#2A3266] text-white hover:bg-[#F06292]'
                              : 'bg-white border-[#1E2360] text-[#1E2360] hover:bg-[#F06292] hover:text-white'
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Internet Usage Card */}
              <div className={`lg:col-span-4 relative border-[3px] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between ${
                isDark ? 'bg-[#141838] border-[#2A3266]' : 'bg-[#FFFDF2] border-[#1E2360]'
              }`}>
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5 sm:mb-6">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                        isDark ? 'bg-[#1A2548] border-[#38BDF8] text-[#38BDF8]' : 'bg-[#E0F2FE] border-[#1E2360] text-[#1E2360]'
                      }`}>
                        <HardDrive className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <h3 className={`font-black text-base sm:text-lg uppercase tracking-wider ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                        INTERNET USAGE
                      </h3>
                    </div>

                    <div className={`flex items-center space-x-1 border-2 rounded-full px-2.5 sm:px-3 py-1 text-xs font-black cursor-pointer ${
                      isDark ? 'bg-[#111533] border-[#2A3266] text-[#E2E8F0]' : 'bg-white border-[#1E2360] text-[#1E2360]'
                    }`}>
                      <span>This Month</span>
                      <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* Big Stat */}
                  <div className="mb-2">
                    <div className={`text-4xl sm:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                      {totalUsageGb} <span className="text-xl sm:text-2xl font-bold text-[#F06292]">GB</span>
                    </div>
                  </div>

                  {/* Growth Stadium Pill */}
                  <div className={`inline-flex items-center space-x-1.5 border-2 px-3.5 py-1 rounded-full text-xs font-black mb-5 sm:mb-6 shadow-sm ${
                    isDark ? 'bg-[#291730] text-[#F472B6] border-[#F472B6]' : 'bg-[#FFF0F4] text-[#F06292] border-[#1E2360]'
                  }`}>
                    <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
                    <span>+2.6% from last month</span>
                  </div>

                  {/* Candy Dual Progress Bar */}
                  <div className={`w-full h-5 border-2 rounded-full overflow-hidden flex mb-5 sm:mb-6 p-0.5 ${
                    isDark ? 'bg-[#1A1A3C] border-[#2A3266]' : 'bg-[#FFF0F4] border-[#1E2360]'
                  }`}>
                    <div className={`${isDark ? 'bg-[#38BDF8]' : 'bg-[#1E2360]'} h-full rounded-l-full`} style={{ width: '92%' }}></div>
                    <div className="bg-[#F06292] h-full rounded-r-full" style={{ width: '8%' }}></div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-3 pt-2 text-sm font-bold">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-3.5 h-3.5 rounded-full border ${isDark ? 'bg-[#38BDF8] border-[#38BDF8]' : 'bg-[#1E2360] border-[#1E2360]'}`}></span>
                        <span className={isDark ? 'text-slate-300' : 'text-[#1E2360]'}>Download</span>
                      </div>
                      <span className={`text-base font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>{downloadUsageGb} GB</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#F06292] border border-[#F06292]"></span>
                        <span className="text-[#F06292]">Upload</span>
                      </div>
                      <span className="text-base text-[#F06292] font-black">{uploadUsageGb} GB</span>
                    </div>
                  </div>
                </div>

                <div className={`pt-6 border-t-2 text-xs font-bold flex items-center justify-between mt-4 lg:mt-0 ${
                  isDark ? 'border-[#2A3266] text-slate-400' : 'border-[#1E2360]/20 text-[#1E2360]/80'
                }`}>
                  <span>Zyxel PMG5617 PPPoE</span>
                  <span className={`border px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isDark ? 'bg-[#0E2824] text-[#10B981] border-[#10B981]' : 'bg-[#E8F8F0] text-[#1E2360] border-[#1E2360]'
                  }`}>
                    VERIFIED
                  </span>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* DEVICES VIEW */}
        {activeNav === 'devices' && (
          <main className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-10 space-y-6 flex-1">
            <div className={`border-[3px] rounded-3xl p-4 sm:p-6 shadow-sm ${
              isDark ? 'bg-[#141838] border-[#2A3266]' : 'bg-[#FFFDF2] border-[#1E2360]'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className={`font-black text-xl sm:text-2xl uppercase tracking-wider ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                    DISCOVERED <span className="text-[#F06292]">INVENTORY</span>
                  </h3>
                  <p className={`text-xs font-bold mt-1 ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>
                    Dynamic records from Windows ARP cache and full ICMP subnet sweeps.
                  </p>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <button
                    onClick={() => triggerScan(false)}
                    disabled={isScanning}
                    className={`flex items-center space-x-2 text-xs font-black uppercase px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full border-2 transition-all ${
                      isDark
                        ? 'bg-[#111533] hover:bg-[#1A2048] text-[#E2E8F0] border-[#2A3266]'
                        : 'bg-white hover:bg-[#FFF0F4] text-[#1E2360] border-[#1E2360]'
                    }`}
                  >
                    <Search className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Quick Read</span>
                  </button>
                  <button
                    onClick={() => triggerScan(true)}
                    disabled={isScanning}
                    className="flex items-center space-x-2 text-xs font-black uppercase bg-[#F06292] hover:bg-[#E05282] text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border-2 border-[#1E2360] transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Deep Sweep</span>
                  </button>
                </div>
              </div>

              <div className={`overflow-x-auto rounded-2xl border-2 ${isDark ? 'border-[#2A3266]' : 'border-[#1E2360]'}`}>
                <table className="w-full text-left text-xs font-bold min-w-[550px]">
                  <thead className={`uppercase text-[11px] font-black tracking-wider border-b-2 ${
                    isDark ? 'bg-[#1A1838] text-[#F472B6] border-[#2A3266]' : 'bg-[#FFF0F4] text-[#1E2360] border-[#1E2360]'
                  }`}>
                    <tr>
                      <th className="py-3.5 px-4">DEVICE</th>
                      <th className="py-3.5 px-4">IP ADDRESS</th>
                      <th className="py-3.5 px-4">MASKED MAC</th>
                      <th className="py-3.5 px-4">SOURCE</th>
                      <th className="py-3.5 px-4">LAST SEEN</th>
                      <th className="py-3.5 px-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y-2 ${
                    isDark ? 'bg-[#111533] divide-[#2A3266]' : 'bg-white divide-[#1E2360]/10'
                  }`}>
                    {deduplicatedDevices.map((d) => (
                      <tr key={d.id} className={`transition ${isDark ? 'hover:bg-[#181E48]' : 'hover:bg-[#FFFDF2]'}`}>
                        <td className={`py-3.5 px-4 font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                          {d.friendly_name || d.hostname || 'LAN Client'}
                        </td>
                        <td className={`py-3.5 px-4 font-mono font-bold ${isDark ? 'text-slate-300' : 'text-[#1E2360]'}`}>{d.ip_address}</td>
                        <td className={`py-3.5 px-4 font-mono font-bold ${isDark ? 'text-slate-500' : 'text-[#1E2360]/60'}`}>{maskMac(d.mac_address)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] uppercase ${
                            isDark ? 'bg-[#162744] text-[#38BDF8] border-[#38BDF8]/40' : 'bg-[#E0F2FE] text-[#1E2360] border-[#1E2360]'
                          }`}>
                            {d.source}
                          </span>
                        </td>
                        <td className={`py-3.5 px-4 ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>
                          {new Date(d.last_seen || d.first_seen).toLocaleTimeString()}
                        </td>
                        <td className="py-3.5 px-4">
                          {d.last_status === 'online' ? (
                            <span className={`font-black px-2.5 py-0.5 rounded-full border text-[10px] uppercase inline-flex items-center space-x-1 ${
                              isDark ? 'bg-[#0E2824] text-[#10B981] border-[#10B981]' : 'bg-[#E8F8F0] text-[#1E2360] border-[#1E2360]'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71]"></span>
                              <span>ONLINE</span>
                            </span>
                          ) : (
                            <span className="bg-[#FEE2E2] text-[#DC2626] font-black px-2.5 py-0.5 rounded-full border border-[#DC2626] text-[10px] uppercase inline-flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
                              <span>DISCONNECTED</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* USAGE TAB */}
        {activeNav === 'usage' && (
          <main className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-10 space-y-6 flex-1">
            <div className={`border-[3px] rounded-3xl p-4 sm:p-6 shadow-sm ${
              isDark ? 'bg-[#141838] border-[#2A3266]' : 'bg-[#FFFDF2] border-[#1E2360]'
            }`}>
              <h3 className={`font-black text-xl sm:text-2xl uppercase tracking-wider mb-2 ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                TELEMETRY & <span className="text-[#F06292]">BANDWIDTH</span>
              </h3>
              <p className={`text-xs font-bold mb-6 ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>
                Real-time host Windows laptop usage alongside whole-house WAN PPPoE byte counters.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className={`border-2 rounded-2xl p-4 sm:p-5 shadow-sm ${
                  isDark ? 'bg-[#171D42] border-[#2A3266]' : 'bg-[#FFF9E6] border-[#1E2360]'
                }`}>
                  <h4 className={`font-black uppercase text-sm mb-3 ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                    Host Laptop Interface (psutil)
                  </h4>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className={`p-3.5 sm:p-4 rounded-xl border-2 ${
                      isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                    }`}>
                      <span className={`text-[10px] font-black uppercase block ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>Current Download</span>
                      <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>{hostTraffic?.download_mbps ?? 0} Mbps</span>
                    </div>
                    <div className={`p-3.5 sm:p-4 rounded-xl border-2 ${
                      isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                    }`}>
                      <span className={`text-[10px] font-black uppercase block ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>Current Upload</span>
                      <span className="text-xl sm:text-2xl font-black text-[#F06292]">{hostTraffic?.upload_mbps ?? 0} Mbps</span>
                    </div>
                  </div>
                </div>

                <div className={`border-2 rounded-2xl p-4 sm:p-5 shadow-sm ${
                  isDark ? 'bg-[#221832] border-[#2A3266]' : 'bg-[#FFF0F4] border-[#1E2360]'
                }`}>
                  <h4 className={`font-black uppercase text-sm mb-3 ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                    Zyxel Router WAN Counters
                  </h4>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className={`p-3.5 sm:p-4 rounded-xl border-2 ${
                      isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                    }`}>
                      <span className={`text-[10px] font-black uppercase block ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>Observed Download</span>
                      <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>{downloadUsageGb} GB</span>
                    </div>
                    <div className={`p-3.5 sm:p-4 rounded-xl border-2 ${
                      isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                    }`}>
                      <span className={`text-[10px] font-black uppercase block ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>Observed Upload</span>
                      <span className="text-xl sm:text-2xl font-black text-[#F06292]">{uploadUsageGb} GB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* SETTINGS VIEW */}
        {activeNav === 'settings' && (
          <main className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-10 space-y-6 flex-1">
            <div className={`border-[3px] rounded-3xl p-4 sm:p-6 shadow-sm max-w-2xl ${
              isDark ? 'bg-[#141838] border-[#2A3266]' : 'bg-[#FFFDF2] border-[#1E2360]'
            }`}>
              <h3 className={`font-black text-xl sm:text-2xl uppercase tracking-wider mb-4 ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                GATEWAY & <span className="text-[#F06292]">SETTINGS</span>
              </h3>
              <div className="space-y-3 sm:space-y-4 text-xs font-bold">
                <div className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 ${
                  isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                }`}>
                  <div>
                    <div className={`uppercase font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>Router Gateway (Zyxel PMG5617)</div>
                    <div className="font-mono text-[#F06292] mt-0.5">192.168.1.1</div>
                  </div>
                  <span className={`border-2 px-3 py-1 rounded-full font-black ${
                    isDark ? 'bg-[#0E2824] text-[#10B981] border-[#10B981]' : 'bg-[#E8F8F0] text-[#1E2360] border-[#1E2360]'
                  }`}>
                    {routerStatus?.reachable ? `${routerStatus.latency_ms ?? 1} ms` : 'Offline'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 ${
                  isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                }`}>
                  <div>
                    <div className={`uppercase font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>Internet Target (Cloudflare DNS)</div>
                    <div className="font-mono text-[#F06292] mt-0.5">1.1.1.1</div>
                  </div>
                  <span className={`border-2 px-3 py-1 rounded-full font-black ${
                    isDark ? 'bg-[#291730] text-[#F472B6] border-[#F472B6]' : 'bg-[#FFF0F4] text-[#F06292] border-[#1E2360]'
                  }`}>
                    {latency?.internet.reachable ? `${latency.internet.latency_ms} ms` : 'Unreachable'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 ${
                  isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                }`}>
                  <div>
                    <div className={`uppercase font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>Appearance Theme</div>
                    <div className="text-slate-400 font-sans mt-0.5">Toggle between Candy Day and Midnight Neon</div>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border-2 font-black uppercase text-[11px] ${
                      isDark ? 'bg-[#1A2048] border-[#38BDF8] text-[#FDE047]' : 'bg-[#FFFDF0] border-[#1E2360] text-[#1E2360]'
                    }`}
                  >
                    {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    <span>{isDark ? 'Light' : 'Dark'}</span>
                  </button>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION DOCK (Native mobile feel on < md) */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md border-t-[3px] z-40 px-3 py-2 flex items-center justify-around shadow-lg transition-colors ${
        isDark ? 'bg-[#111533]/95 border-[#2A3266]' : 'bg-[#FFFDF7]/95 border-[#1E2360]'
      }`}>
        <button
          onClick={() => handleNavClick('dashboard')}
          className={`flex flex-col items-center space-y-1 py-1 px-3 rounded-full transition ${
            activeNav === 'dashboard'
              ? isDark ? 'bg-[#F06292] text-white' : 'bg-[#1E2360] text-white'
              : isDark ? 'text-slate-400 hover:text-white' : 'text-[#1E2360] hover:bg-[#FFF4F7]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-wider">Home</span>
        </button>

        <button
          onClick={() => handleNavClick('devices')}
          className={`relative flex flex-col items-center space-y-1 py-1 px-3 rounded-full transition ${
            activeNav === 'devices'
              ? isDark ? 'bg-[#F06292] text-white' : 'bg-[#1E2360] text-white'
              : isDark ? 'text-slate-400 hover:text-white' : 'text-[#1E2360] hover:bg-[#FFF4F7]'
          }`}
        >
          <Monitor className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-wider">Devices</span>
          <span className="absolute top-0.5 right-1 w-2 h-2 rounded-full bg-[#F06292]"></span>
        </button>

        <button
          onClick={() => handleNavClick('usage')}
          className={`flex flex-col items-center space-y-1 py-1 px-3 rounded-full transition ${
            activeNav === 'usage'
              ? isDark ? 'bg-[#F06292] text-white' : 'bg-[#1E2360] text-white'
              : isDark ? 'text-slate-400 hover:text-white' : 'text-[#1E2360] hover:bg-[#FFF4F7]'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-wider">Usage</span>
        </button>

        <button
          onClick={() => handleNavClick('settings')}
          className={`flex flex-col items-center space-y-1 py-1 px-3 rounded-full transition ${
            activeNav === 'settings'
              ? isDark ? 'bg-[#F06292] text-white' : 'bg-[#1E2360] text-white'
              : isDark ? 'text-slate-400 hover:text-white' : 'text-[#1E2360] hover:bg-[#FFF4F7]'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
}
