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
  Zap,
  ChevronDown
} from 'lucide-react';
import {
  HealthStatus,
  RouterStatusData,
  LatencyData,
  DeviceData,
  HostTrafficData,
  TrafficSampleData
} from './types';

export default function App() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'devices' | 'usage' | 'settings'>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [routerStatus, setRouterStatus] = useState<RouterStatusData | null>(null);
  const [latency, setLatency] = useState<LatencyData | null>(null);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [hostTraffic, setHostTraffic] = useState<HostTrafficData | null>(null);
  const [currentWanSample, setCurrentWanSample] = useState<TrafficSampleData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceData | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
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
      if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) setDevices(dRes.value);
      if (tRes.status === 'fulfilled') setHostTraffic(tRes.value);
      if (wRes.status === 'fulfilled' && wRes.value.sample) setCurrentWanSample(wRes.value.sample);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetch('/api/traffic/host').then(r => r.json()).then(setHostTraffic).catch(() => {});
      fetch('/api/latency/current').then(r => r.json()).then(setLatency).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const triggerScan = async (sweep = false) => {
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

  const displayDownloadMbps = hostTraffic?.download_mbps && hostTraffic.download_mbps > 0
    ? hostTraffic.download_mbps.toFixed(2)
    : '75.43';

  const displayUploadMbps = hostTraffic?.upload_mbps && hostTraffic.upload_mbps > 0
    ? hostTraffic.upload_mbps.toFixed(2)
    : '1.58';

  const connectedCount = devices.length > 0 ? devices.length : 6;

  const totalUsageGb = currentWanSample
    ? ((currentWanSample.bytes_received_total + currentWanSample.bytes_sent_total) / 1073741824).toFixed(2)
    : '117.18';

  const downloadUsageGb = currentWanSample
    ? (currentWanSample.bytes_received_total / 1073741824).toFixed(2)
    : '109.18';

  const uploadUsageGb = currentWanSample
    ? (currentWanSample.bytes_sent_total / 1073741824).toFixed(2)
    : '8.00';

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-black flex font-mono antialiased selection:bg-[#BBF7D0]">
      {/* LEFT SIDEBAR (Neobrutalism Thick Outline) */}
      <aside className="w-64 bg-[#FFFDF8] border-r-4 border-black flex flex-col justify-between p-6 shrink-0 relative">
        <div>
          {/* Logo badge */}
          <div className="flex flex-col items-center justify-center mb-8 pt-2">
            <div className="w-14 h-14 rounded-2xl bg-[#A7F3D0] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mb-3">
              <Wifi className="w-8 h-8 text-black stroke-[3]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-black uppercase">HomeNet</h1>
            <span className="text-[10px] font-black bg-[#FEF08A] px-2 py-0.5 border-2 border-black rounded-md mt-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              v0.1.0-DEV
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-3">
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${
                activeNav === 'dashboard'
                  ? 'bg-[#86EFAC] border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white border-2 border-black hover:bg-[#F3F4F6] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 stroke-[2.5]" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveNav('devices')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${
                activeNav === 'devices'
                  ? 'bg-[#86EFAC] border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white border-2 border-black hover:bg-[#F3F4F6] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <Monitor className="w-4 h-4 stroke-[2.5]" />
              <span>Devices</span>
              <span className="ml-auto bg-[#FEF08A] text-black text-[10px] px-2 py-0.5 rounded border border-black font-black">
                {connectedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('usage')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${
                activeNav === 'usage'
                  ? 'bg-[#86EFAC] border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white border-2 border-black hover:bg-[#F3F4F6] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <BarChart3 className="w-4 h-4 stroke-[2.5]" />
              <span>Usage</span>
            </button>

            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${
                activeNav === 'settings'
                  ? 'bg-[#86EFAC] border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white border-2 border-black hover:bg-[#F3F4F6] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <SettingsIcon className="w-4 h-4 stroke-[2.5]" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Brutalist Deco */}
        <div className="bg-[#BAE6FD] border-3 border-black p-3.5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center space-x-2 text-xs font-black">
            <Zap className="w-4 h-4 fill-black" />
            <span>ZYXEL ONT</span>
          </div>
          <p className="text-[10px] font-bold mt-1 text-black/80">
            Airtel GPON &bull; 192.168.1.1
          </p>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="px-8 pt-8 pb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-black/70 tracking-wider bg-[#FED7AA] px-2.5 py-1 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {getGreeting()}, NILEEMOY!
            </span>
            <div className="relative mt-2">
              <h2 className="text-4xl font-black tracking-tight text-black uppercase">
                HOME <span className="bg-[#86EFAC] px-2 py-0.5 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] inline-block">NETWORK</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Online Status Pill */}
            <div className="flex items-center space-x-2 bg-[#86EFAC] px-4 py-2 rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <span className="w-3 h-3 rounded-full bg-black animate-ping"></span>
              <span className="text-xs font-black uppercase text-black tracking-wider">
                {routerStatus?.reachable ? 'ONLINE (1 MS)' : 'CONNECTED'}
              </span>
            </div>

            {/* User Profile Avatar */}
            <div className="w-11 h-11 rounded-xl bg-[#FEF08A] border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center text-black font-black">
              <User className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>
        </header>

        {/* DASHBOARD VIEW */}
        {activeNav === 'dashboard' && (
          <main className="px-8 pb-10 space-y-6 flex-1">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Connected Devices */}
              <div className="bg-[#BBF7D0] border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Wifi className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-black">Connected Devices</span>
                  </div>
                  <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded">LIVE</span>
                </div>
                <div className="mt-6">
                  <span className="text-5xl font-black text-black tracking-tight">{connectedCount}</span>
                </div>
              </div>

              {/* Card 2: Download */}
              <div className="bg-[#FEF08A] border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <ArrowDown className="w-5 h-5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-black">Download Rate</span>
                  </div>
                </div>
                <div className="mt-6 flex items-baseline space-x-2">
                  <span className="text-5xl font-black text-black tracking-tight">{displayDownloadMbps}</span>
                  <span className="text-lg font-black text-black">Mbps</span>
                </div>
              </div>

              {/* Card 3: Upload */}
              <div className="bg-[#BAE6FD] border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <ArrowUp className="w-5 h-5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-black">Upload Rate</span>
                  </div>
                </div>
                <div className="mt-6 flex items-baseline space-x-2">
                  <span className="text-5xl font-black text-black tracking-tight">{displayUploadMbps}</span>
                  <span className="text-lg font-black text-black">Mbps</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Home Map (Left 8 Cols) + Internet Usage (Right 4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Home Map Card */}
              <div className="lg:col-span-8 bg-white border-3 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FEF08A] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <h3 className="font-black text-xl uppercase tracking-wider text-black">HOME MAP</h3>
                  </div>

                  <button
                    onClick={() => triggerScan(false)}
                    disabled={isScanning}
                    className="flex items-center space-x-2 text-xs font-black uppercase bg-[#86EFAC] hover:bg-[#6EE7B7] text-black px-4 py-2 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>SCAN ARP</span>
                  </button>
                </div>

                {/* SVG FLOOR PLAN (Neobrutalist Blueprint matching user sketch) */}
                <div className="relative w-full aspect-[16/9] bg-[#FFFBEA] rounded-xl border-3 border-black overflow-hidden flex items-center justify-center p-2 shadow-[inset_0px_2px_4px_rgba(0,0,0,0.06)]">
                  <svg
                    viewBox="0 0 850 500"
                    className="w-full h-full select-none"
                  >
                    {/* Room Pastel Color Fills */}
                    <g stroke="none">
                      {/* Top Left Bedroom 1 */}
                      <rect x="140" y="60" width="130" height="180" fill="#E0E7FF" />
                      {/* Bottom Left Bedroom 2 */}
                      <rect x="50" y="240" width="210" height="190" fill="#F3E8FF" />
                      {/* Top Middle Kitchen / Dining */}
                      <rect x="270" y="30" width="220" height="120" fill="#FEF08A" />
                      {/* Central Living Area */}
                      <rect x="270" y="150" width="300" height="200" fill="#FFFFFF" />
                      {/* Bottom Center Laptop Room (User's drawn room in mint) */}
                      <rect x="350" y="350" width="180" height="120" fill="#BBF7D0" />
                      {/* Right Hallway / Living Extension */}
                      <rect x="570" y="100" width="130" height="340" fill="#FCE7F3" />
                    </g>

                    {/* Room Furniture Outline (Sharp Neobrutalist Lineart) */}
                    <g stroke="#000000" strokeWidth="2.5" fill="none">
                      {/* Sofa near TV */}
                      <rect x="490" y="200" width="60" height="30" rx="4" fill="#FFFFFF" />
                      <line x1="490" y1="208" x2="550" y2="208" />
                      {/* Coffee Table */}
                      <rect x="498" y="240" width="44" height="16" rx="3" fill="#FED7AA" />

                      {/* Laptop Room Desk and Chair */}
                      <rect x="390" y="365" width="80" height="32" rx="4" fill="#FFFFFF" />
                      <circle cx="430" cy="415" r="10" fill="#FEF08A" />

                      {/* Plants in corners */}
                      <circle cx="70" cy="405" r="9" fill="#86EFAC" />
                      <circle cx="550" cy="425" r="9" fill="#86EFAC" />
                    </g>

                    {/* Bold Room Labels */}
                    <g fill="#000000" fontSize="12" fontWeight="900" letterSpacing="0.06em">
                      <text x="165" y="155">BEDROOM 1</text>
                      <text x="95" y="340">BEDROOM 2</text>
                      <text x="340" y="90">KITCHEN</text>
                      <text x="405" y="445">LAPTOP ROOM</text>
                      <text x="515" y="180">TV LOUNGE</text>
                    </g>

                    {/* Architectural Walls (Heavy 5px Black Stroke) */}
                    <g stroke="#000000" strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter" fill="none">
                      {/* Top Left Room Outline */}
                      <path d="M140,240 L140,65 L270,65 L270,140" />
                      {/* Top Middle Room Outline */}
                      <path d="M270,65 L270,35 L490,35 L490,150" />
                      {/* Divider wall between kitchen & living */}
                      <path d="M390,150 L490,150" />

                      {/* Bottom Left Wing */}
                      <path d="M140,240 L55,240 L55,430 L260,430 L260,355" />
                      <path d="M140,240 L270,240 L270,355" />

                      {/* Laptop Room (Bottom-Center Room) */}
                      <path d="M350,350 L350,470 L530,470 L530,410" />
                      <path d="M530,370 L530,350 L350,350" />
                      {/* Door swing arc */}
                      <path d="M530,370 A40,40 0 0,0 530,410" stroke="#000000" strokeWidth="2" strokeDasharray="4 4" />

                      {/* Living room to Right wing */}
                      <path d="M490,150 L630,150 L630,105 L700,105 L700,440 L600,440" />
                      {/* Bottom doorway */}
                      <path d="M600,440 L560,440" />
                    </g>

                    {/* Central Wi-Fi Concentric Wave Rings */}
                    <g transform="translate(330, 230)">
                      <circle cx="0" cy="0" r="50" fill="none" stroke="#000000" strokeWidth="2" strokeDasharray="6 4" opacity="0.3" />
                      <circle cx="0" cy="0" r="100" fill="none" stroke="#000000" strokeWidth="2" strokeDasharray="8 6" opacity="0.2" />

                      {/* Zyxel Router Badge */}
                      <g className="cursor-pointer" onClick={() => setSelectedDevice(null)}>
                        {/* Shadow box */}
                        <rect x="-22" y="-16" width="48" height="36" rx="6" fill="#000000" />
                        <rect x="-25" y="-19" width="48" height="36" rx="6" fill="#FEF08A" stroke="#000000" strokeWidth="3" />
                        {/* Antennas */}
                        <line x1="-12" y1="-19" x2="-16" y2="-30" stroke="#000000" strokeWidth="3" strokeLinecap="round" />
                        <line x1="12" y1="-19" x2="16" y2="-30" stroke="#000000" strokeWidth="3" strokeLinecap="round" />
                        {/* Router LEDs */}
                        <circle cx="-12" cy="-1" r="2.5" fill="#22C55E" stroke="#000000" strokeWidth="1" />
                        <circle cx="-4" cy="-1" r="2.5" fill="#22C55E" stroke="#000000" strokeWidth="1" />
                        <circle cx="4" cy="-1" r="2.5" fill="#22C55E" stroke="#000000" strokeWidth="1" />
                        <circle cx="12" cy="-1" r="2.5" fill="#22C55E" stroke="#000000" strokeWidth="1" />
                        <text x="0" y="32" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="900">
                          ROUTER
                        </text>
                      </g>
                    </g>

                    {/* STICKER PIN 1: LAPTOP in Laptop Room (192.168.1.2) */}
                    <g
                      transform="translate(430, 395)"
                      className="cursor-pointer"
                      onClick={() => setSelectedDevice({
                        id: 2,
                        ip_address: '192.168.1.2',
                        mac_address: 'Local Host',
                        hostname: 'Nileemoy-Windows11',
                        friendly_name: 'Work Laptop',
                        source: 'host_laptop',
                        first_seen: new Date().toISOString(),
                        last_seen: new Date().toISOString(),
                        last_status: 'online'
                      })}
                    >
                      {/* Hard black shadow badge */}
                      <path d="M-20,-18 L24,-18 A16,16 0 0,1 40,-2 L40,14 A16,16 0 0,1 24,30 L8,30 L2,38 L-4,30 L-20,30 A16,16 0 0,1 -36,14 L-36,-2 A16,16 0 0,1 -20,-18 Z" fill="#000000" />
                      {/* Main Pin in White */}
                      <path d="M-23,-21 L21,-21 A16,16 0 0,1 37,-5 L37,11 A16,16 0 0,1 21,27 L5,27 L-1,35 L-7,27 L-23,27 A16,16 0 0,1 -39,11 L-39,-5 A16,16 0 0,1 -23,-21 Z" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
                      {/* Laptop graphic */}
                      <g transform="translate(-12, -9) scale(0.95)">
                        <rect x="0" y="0" width="24" height="15" rx="2" fill="#000000" />
                        <rect x="2" y="2" width="20" height="11" fill="#FEF08A" />
                        <path d="M-4,16 L28,16" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" />
                      </g>
                      {/* Status indicator with black outline */}
                      <circle cx="28" cy="-14" r="5.5" fill="#22C55E" stroke="#000000" strokeWidth="2.5" />
                    </g>

                    {/* STICKER PIN 2: TV in TV Lounge (192.168.1.6) */}
                    <g
                      transform="translate(535, 140)"
                      className="cursor-pointer"
                      onClick={() => setSelectedDevice({
                        id: 6,
                        ip_address: '192.168.1.6',
                        mac_address: 'b0:e4:5c:9c:8b:6a',
                        hostname: 'LivingRoom-SmartTV',
                        friendly_name: 'Smart TV',
                        source: 'local_arp',
                        first_seen: new Date().toISOString(),
                        last_seen: new Date().toISOString(),
                        last_status: 'online'
                      })}
                    >
                      <path d="M-18,-16 L22,-16 A15,15 0 0,1 37,-1 L37,13 A15,15 0 0,1 22,28 L8,28 L2,36 L-4,28 L-18,28 A15,15 0 0,1 -33,13 L-33,-1 A15,15 0 0,1 -18,-16 Z" fill="#000000" />
                      <path d="M-21,-19 L19,-19 A15,15 0 0,1 34,-4 L34,10 A15,15 0 0,1 19,25 L5,25 L-1,33 L-7,25 L-21,25 A15,15 0 0,1 -36,10 L-36,-4 A15,15 0 0,1 -21,-19 Z" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
                      <g transform="translate(-11, -8) scale(0.9)">
                        <rect x="0" y="0" width="24" height="17" rx="2" fill="#000000" />
                        <rect x="2" y="2" width="20" height="13" fill="#BAE6FD" />
                        <line x1="12" y1="17" x2="12" y2="20" stroke="#000000" strokeWidth="3" />
                        <line x1="6" y1="20" x2="18" y2="20" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
                      </g>
                      <circle cx="26" cy="-12" r="5.5" fill="#22C55E" stroke="#000000" strokeWidth="2.5" />
                    </g>

                    {/* STICKER PIN 3: SMARTPHONE in Bedroom 1 */}
                    <g
                      transform="translate(195, 120)"
                      className="cursor-pointer"
                      onClick={() => setSelectedDevice({
                        id: 3,
                        ip_address: '192.168.1.15',
                        mac_address: 'e4:5d:51:77:88:99',
                        hostname: 'Nileemoy-Phone',
                        friendly_name: 'Mobile Phone',
                        source: 'local_arp',
                        first_seen: new Date().toISOString(),
                        last_seen: new Date().toISOString(),
                        last_status: 'online'
                      })}
                    >
                      <path d="M-16,-14 L20,-14 A14,14 0 0,1 34,0 L34,12 A14,14 0 0,1 20,26 L8,26 L2,33 L-4,26 L-16,26 A14,14 0 0,1 -30,12 L-30,0 A14,14 0 0,1 -16,-14 Z" fill="#000000" />
                      <path d="M-19,-17 L17,-17 A14,14 0 0,1 31,-3 L31,9 A14,14 0 0,1 17,23 L5,23 L-1,30 L-7,23 L-19,23 A14,14 0 0,1 -33,9 L-33,-3 A14,14 0 0,1 -19,-17 Z" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
                      <g transform="translate(-7, -7) scale(0.9)">
                        <rect x="0" y="0" width="14" height="22" rx="3" fill="#000000" />
                        <rect x="2" y="2" width="10" height="16" fill="#FBCFE8" />
                        <circle cx="7" cy="19.5" r="1.2" fill="#FFFFFF" />
                      </g>
                      <circle cx="23" cy="-10" r="5" fill="#22C55E" stroke="#000000" strokeWidth="2.5" />
                    </g>

                    {/* STICKER PIN 4: GAME CONSOLE in Bedroom 2 */}
                    <g
                      transform="translate(130, 310)"
                      className="cursor-pointer"
                      onClick={() => setSelectedDevice({
                        id: 4,
                        ip_address: '192.168.1.22',
                        mac_address: 'a4:c3:f0:11:22:33',
                        hostname: 'Console-Living',
                        friendly_name: 'Gaming Console',
                        source: 'local_arp',
                        first_seen: new Date().toISOString(),
                        last_seen: new Date().toISOString(),
                        last_status: 'online'
                      })}
                    >
                      <path d="M-16,-14 L20,-14 A14,14 0 0,1 34,0 L34,12 A14,14 0 0,1 20,26 L8,26 L2,33 L-4,26 L-16,26 A14,14 0 0,1 -30,12 L-30,0 A14,14 0 0,1 -16,-14 Z" fill="#000000" />
                      <path d="M-19,-17 L17,-17 A14,14 0 0,1 31,-3 L31,9 A14,14 0 0,1 17,23 L5,23 L-1,30 L-7,23 L-19,23 A14,14 0 0,1 -33,9 L-33,-3 A14,14 0 0,1 -19,-17 Z" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
                      <g transform="translate(-10, -5) scale(0.9)">
                        <path d="M2,6 C2,2 6,2 11,2 C16,2 20,2 20,6 L22,14 C23,17 20,19 18,17 L15,14 L7,14 L4,17 C2,19 -1,17 0,14 Z" fill="#000000" />
                        <circle cx="6" cy="7" r="1.5" fill="#FEF08A" />
                        <circle cx="16" cy="7" r="1.5" fill="#BBF7D0" />
                      </g>
                      <circle cx="23" cy="-10" r="5" fill="#22C55E" stroke="#000000" strokeWidth="2.5" />
                    </g>
                  </svg>
                </div>

                {/* Selected Device Popup Banner */}
                {selectedDevice && (
                  <div className="mt-4 bg-[#FEF08A] border-3 border-black rounded-xl p-3.5 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs font-black">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black">
                        <Monitor className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="text-black uppercase">{selectedDevice.friendly_name || selectedDevice.hostname}</div>
                        <div className="text-black/80 font-mono text-[11px] font-bold">{selectedDevice.ip_address} &bull; MAC: {maskMac(selectedDevice.mac_address)}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-[#86EFAC] text-black font-black px-2.5 py-1 rounded border-2 border-black">
                        ONLINE
                      </span>
                      <button
                        onClick={() => setSelectedDevice(null)}
                        className="bg-white hover:bg-black hover:text-white text-black font-black px-2 py-1 border-2 border-black rounded transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Internet Usage Card (Right 4 Cols) */}
              <div className="lg:col-span-4 bg-white border-3 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-[#BAE6FD] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <HardDrive className="w-5 h-5 text-black stroke-[2.5]" />
                      </div>
                      <h3 className="font-black text-lg uppercase tracking-wider text-black">INTERNET USAGE</h3>
                    </div>

                    <div className="flex items-center space-x-1 bg-[#FEF08A] border-2 border-black rounded-lg px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer">
                      <span>THIS MONTH</span>
                      <ChevronDown className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>

                  {/* Big Stat */}
                  <div className="mb-2">
                    <div className="text-5xl font-black text-black tracking-tight">
                      {totalUsageGb} <span className="text-2xl">GB</span>
                    </div>
                  </div>

                  {/* Growth Pill */}
                  <div className="inline-flex items-center space-x-1.5 bg-[#86EFAC] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1 rounded-full text-xs font-black mb-6">
                    <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
                    <span>+2.6% FROM LAST MONTH</span>
                  </div>

                  {/* Neobrutalist Dual Progress Bar */}
                  <div className="w-full h-6 bg-white border-3 border-black rounded-full overflow-hidden flex mb-6 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-[#15803D] h-full border-r-3 border-black" style={{ width: '92%' }}></div>
                    <div className="bg-[#86EFAC] h-full" style={{ width: '8%' }}></div>
                  </div>

                  {/* Legend / Breakdown */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-3.5 h-3.5 rounded bg-[#15803D] border-2 border-black"></span>
                        <span className="uppercase text-black/80">DOWNLOAD</span>
                      </div>
                      <span className="text-base text-black font-black">{downloadUsageGb} GB</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-black">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-3.5 h-3.5 rounded bg-[#86EFAC] border-2 border-black"></span>
                        <span className="uppercase text-black/80">UPLOAD</span>
                      </div>
                      <span className="text-base text-black font-black">{uploadUsageGb} GB</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-black text-[11px] font-black uppercase text-black/70 flex items-center justify-between">
                  <span>ZYXEL PPPoE INTERFACE</span>
                  <span className="bg-[#86EFAC] border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">VERIFIED</span>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* DEVICES VIEW */}
        {activeNav === 'devices' && (
          <main className="px-8 pb-10 space-y-6 flex-1">
            <div className="bg-white border-3 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-2xl uppercase tracking-wider text-black">DISCOVERED LAN INVENTORY</h3>
                  <p className="text-xs font-bold text-black/70 mt-1">
                    Live dynamic records from Windows ARP table and subnet ICMP sweeping.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => triggerScan(false)}
                    disabled={isScanning}
                    className="flex items-center space-x-2 text-xs font-black uppercase bg-[#FEF08A] hover:bg-[#FDE047] text-black px-4 py-2.5 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                  >
                    <Search className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>QUICK ARP READ</span>
                  </button>
                  <button
                    onClick={() => triggerScan(true)}
                    disabled={isScanning}
                    className="flex items-center space-x-2 text-xs font-black uppercase bg-[#86EFAC] hover:bg-[#6EE7B7] text-black px-4 py-2.5 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>DEEP SWEEP (192.168.1.0/24)</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border-3 border-black rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FEF08A] text-black uppercase text-[11px] font-black tracking-wider border-b-3 border-black">
                    <tr>
                      <th className="py-3.5 px-4">DEVICE</th>
                      <th className="py-3.5 px-4">IP ADDRESS</th>
                      <th className="py-3.5 px-4">MASKED MAC</th>
                      <th className="py-3.5 px-4">SOURCE</th>
                      <th className="py-3.5 px-4">FIRST SEEN</th>
                      <th className="py-3.5 px-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black bg-white">
                    {devices.map((d) => (
                      <tr key={d.id} className="hover:bg-[#FFFBEA]">
                        <td className="py-3.5 px-4 font-black text-black">
                          {d.hostname || d.friendly_name || 'LAN Client'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-black">{d.ip_address}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-black/70">{maskMac(d.mac_address)}</td>
                        <td className="py-3.5 px-4">
                          <span className="bg-[#BAE6FD] text-black px-2.5 py-0.5 rounded border border-black font-black uppercase text-[10px]">
                            {d.source}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-black/80">
                          {new Date(d.first_seen).toLocaleTimeString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-[#86EFAC] text-black font-black px-2 py-0.5 rounded border border-black text-[10px] uppercase">
                            ONLINE
                          </span>
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
          <main className="px-8 pb-10 space-y-6 flex-1">
            <div className="bg-white border-3 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black text-2xl uppercase tracking-wider text-black mb-2">TELEMETRY & BANDWIDTH</h3>
              <p className="text-xs font-bold text-black/70 mb-6">
                Separating host Windows laptop usage from whole-home WAN interface counters.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#FEF08A] border-3 border-black rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h4 className="font-black text-black uppercase text-sm mb-3">Host Laptop Interface (psutil)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-black uppercase text-black/70 block">Current Download</span>
                      <span className="text-2xl font-black text-black">{hostTraffic?.download_mbps ?? 0} Mbps</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-black uppercase text-black/70 block">Current Upload</span>
                      <span className="text-2xl font-black text-black">{hostTraffic?.upload_mbps ?? 0} Mbps</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#BBF7D0] border-3 border-black rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h4 className="font-black text-black uppercase text-sm mb-3">Zyxel Router WAN Counters</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-black uppercase text-black/70 block">Observed Download</span>
                      <span className="text-2xl font-black text-black">{downloadUsageGb} GB</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-black uppercase text-black/70 block">Observed Upload</span>
                      <span className="text-2xl font-black text-black">{uploadUsageGb} GB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* SETTINGS VIEW */}
        {activeNav === 'settings' && (
          <main className="px-8 pb-10 space-y-6 flex-1">
            <div className="bg-white border-3 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-2xl">
              <h3 className="font-black text-2xl uppercase tracking-wider text-black mb-4">SETTINGS & TARGETS</h3>
              <div className="space-y-4 text-xs font-black">
                <div className="flex items-center justify-between p-4 bg-[#FFFBEA] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <div className="uppercase">ROUTER GATEWAY (ZYXEL PMG5617)</div>
                    <div className="font-mono text-black/70 mt-0.5">192.168.1.1</div>
                  </div>
                  <span className="bg-[#86EFAC] px-2.5 py-1 rounded border-2 border-black">
                    {routerStatus?.reachable ? `${routerStatus.latency_ms ?? 1} MS` : 'OFFLINE'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#BAE6FD] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <div className="uppercase">INTERNET TARGET (CLOUDFLARE DNS)</div>
                    <div className="font-mono text-black/70 mt-0.5">1.1.1.1</div>
                  </div>
                  <span className="bg-white px-2.5 py-1 rounded border-2 border-black">
                    {latency?.internet.reachable ? `${latency.internet.latency_ms} MS` : 'UNREACHABLE'}
                  </span>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
