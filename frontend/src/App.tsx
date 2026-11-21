import React, { useState, useEffect, useRef } from 'react';
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
  Signal,
  Move,
  RotateCcw,
  MapPin,
  Zap,
  Layers,
  Compass,
  Crosshair,
  PenTool,
  Plus,
  Trash2,
  Undo,
  Check
} from 'lucide-react';
import {
  HealthStatus,
  RouterStatusData,
  LatencyData,
  DeviceData,
  HostTrafficData,
  TrafficSampleData
} from './types';

// Floor Plan Custom Wall Geometry & Defaults
export interface WallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Starter floor plan: clean open perimeter with partition walls
const DEFAULT_STARTER_WALLS: WallSegment[] = [
  { id: 'w_bed1_v',  x1: 270, y1: 45,  x2: 270, y2: 230 },
  { id: 'w_bed_h',   x1: 60,  y1: 230, x2: 270, y2: 230 },
  { id: 'w_kitchen', x1: 520, y1: 45,  x2: 520, y2: 200 },
  { id: 'w_office_v', x1: 520, y1: 300, x2: 520, y2: 455 },
  { id: 'w_office_h', x1: 340, y1: 310, x2: 520, y2: 310 },
];

const DEFAULT_CLIENT_SLOTS = [
  { id: 'slot_laptop', x: 430, y: 390, label: 'Work Area', type: 'laptop' },
  { id: 'slot_tv',     x: 650, y: 150, label: 'TV Lounge', type: 'tv' },
  { id: 'slot_phone1', x: 170, y: 130, label: 'Bedroom 1', type: 'phone' },
  { id: 'slot_phone2', x: 170, y: 340, label: 'Bedroom 2', type: 'phone' },
  { id: 'slot_phone3', x: 380, y: 110, label: 'Kitchen',   type: 'phone' },
  { id: 'slot_other',  x: 650, y: 360, label: 'Balcony',   type: 'generic' },
];

// Check if a line segment (rx, ry) -> (tx, ty) intersects wall (x1, y1) -> (x2, y2)
function checkWallIntersection(
  rx: number, ry: number,
  tx: number, ty: number,
  x1: number, y1: number,
  x2: number, y2: number
): boolean {
  const s1_x = tx - rx;
  const s1_y = ty - ry;
  const s2_x = x2 - x1;
  const s2_y = y2 - y1;

  const det = -s2_x * s1_y + s1_x * s2_y;
  if (Math.abs(det) < 0.0001) return false;

  const s = (-s1_y * (rx - x1) + s1_x * (ry - y1)) / det;
  const t = ( s2_x * (ry - y1) - s2_y * (rx - x1)) / det;

  return (s > 0.02 && s < 0.98 && t >= 0 && t <= 1);
}

// Physical Wi-Fi signal propagation model taking custom user walls into account
const getSignalAtCoord = (
  x: number,
  y: number,
  is5G: boolean = true,
  routerX: number = 330,
  routerY: number = 230,
  customWalls: WallSegment[] = []
) => {
  const dx = x - routerX;
  const dy = y - routerY;
  const distPx = Math.sqrt(dx * dx + dy * dy);
  const distMeters = Math.max(0.5, distPx / 55).toFixed(1);

  // Count how many custom user walls intersect the direct RF transmission path
  const wallsCrossed = customWalls.filter(w =>
    checkWallIntersection(routerX, routerY, x, y, w.x1, w.y1, w.x2, w.y2)
  ).length;

  // Path loss model with logarithmic distance decay
  const baseLoss = is5G
    ? 20 * Math.log10(Math.max(14, distPx) / 16)
    : 16 * Math.log10(Math.max(14, distPx) / 16);

  // Each user-drawn wall imposes real physical RF attenuation
  const wallPenalty = wallsCrossed * (is5G ? 6.5 : 4.0);

  const rawRssi = (is5G ? -36 : -32) - baseLoss - wallPenalty;
  const rssi = Math.max(-90, Math.min(-34, Math.round(rawRssi)));
  const percent = Math.min(100, Math.max(12, Math.round(((rssi + 95) / 55) * 100)));

  // Realistic Wi-Fi throughput estimation
  let estimatedSpeedMbps = 15;
  if (rssi >= -48) estimatedSpeedMbps = is5G ? 280 : 95;
  else if (rssi >= -58) estimatedSpeedMbps = is5G ? 190 : 75;
  else if (rssi >= -67) estimatedSpeedMbps = is5G ? 120 : 55;
  else if (rssi >= -75) estimatedSpeedMbps = is5G ? 60 : 35;
  else if (rssi >= -82) estimatedSpeedMbps = is5G ? 25 : 15;
  else estimatedSpeedMbps = is5G ? 8 : 4;

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

  return { rssi, percent, quality, color, distPx: Math.round(distPx), distMeters, estimatedSpeedMbps, wallsCrossed };
};

const getRoomNameAtCoord = (x: number, y: number): string => {
  if (x < 270 && y < 235) return 'Bedroom 1';
  if (x < 270 && y >= 235) return 'Bedroom 2';
  if (x >= 270 && x <= 520 && y < 200) return 'Kitchen / Dining';
  if (x >= 270 && x <= 520 && y >= 310) return 'Work Office';
  if (x > 520 && y < 250) return 'TV Lounge';
  if (x > 520 && y >= 250) return 'Balcony / Hall';
  return 'Living Room';
};

// Backwards compatibility wrapper
const getSlotSignal = (slotId: string, is5G: boolean = true) => {
  const slot = DEFAULT_CLIENT_SLOTS.find(s => s.id === slotId) || DEFAULT_CLIENT_SLOTS[0];
  return getSignalAtCoord(slot.x, slot.y, is5G);
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
      const saved = localStorage.getItem('lanscape_theme') || localStorage.getItem('homenet_theme');
      return saved === 'dark';
    } catch {
      return false;
    }
  });
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [heatmapBand, setHeatmapBand] = useState<'5ghz' | '2.4ghz'>('5ghz');

  // Custom Floor Plan Walls & Wall Designer State
  const [walls, setWalls] = useState<WallSegment[]>(() => {
    try {
      const saved = localStorage.getItem('lanscape_walls');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_STARTER_WALLS;
  });

  const [isWallBuilderOpen, setIsWallBuilderOpen] = useState(false);
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{ x: number; y: number } | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);

  const [routerPos, setRouterPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('lanscape_router_pos');
      return saved ? JSON.parse(saved) : { x: 330, y: 230 };
    } catch {
      return { x: 330, y: 230 };
    }
  });

  const [showSpeedInspector, setShowSpeedInspector] = useState<boolean>(false);
  const [hoverProbe, setHoverProbe] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  // Interactive Floor Plan Device Placement & Dragging
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [customLocations, setCustomLocations] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem('lanscape_device_locations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [draggingIp, setDraggingIp] = useState<string | null>(null);

  const resetRouterPos = () => {
    setRouterPos({ x: 330, y: 230 });
    try {
      localStorage.removeItem('lanscape_router_pos');
    } catch {}
  };

  const addWallDirect = (orientation: 'horizontal' | 'vertical') => {
    const id = `wall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newWall: WallSegment = orientation === 'horizontal'
      ? { id, x1: 280, y1: 240, x2: 520, y2: 240 }
      : { id, x1: 400, y1: 100, x2: 400, y2: 360 };
    const next = [...walls, newWall];
    setWalls(next);
    try { localStorage.setItem('lanscape_walls', JSON.stringify(next)); } catch {}
  };

  const deleteWall = (id: string) => {
    const next = walls.filter(w => w.id !== id);
    setWalls(next);
    try { localStorage.setItem('lanscape_walls', JSON.stringify(next)); } catch {}
  };

  const undoLastWall = () => {
    if (walls.length === 0) return;
    const next = walls.slice(0, -1);
    setWalls(next);
    try { localStorage.setItem('lanscape_walls', JSON.stringify(next)); } catch {}
  };

  const clearAllWalls = () => {
    setWalls([]);
    try { localStorage.setItem('lanscape_walls', JSON.stringify([])); } catch {}
  };

  const resetDefaultWalls = () => {
    setWalls(DEFAULT_STARTER_WALLS);
    try { localStorage.setItem('lanscape_walls', JSON.stringify(DEFAULT_STARTER_WALLS)); } catch {}
  };

  const updateDeviceLocation = (ip: string, x: number, y: number) => {
    const clampedX = Math.round(Math.max(65, Math.min(785, x)));
    const clampedY = Math.round(Math.max(45, Math.min(455, y)));
    setCustomLocations(prev => {
      const next = { ...prev, [ip]: { x: clampedX, y: clampedY } };
      try {
        localStorage.setItem('lanscape_device_locations', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetDeviceLocation = (ip: string) => {
    setCustomLocations(prev => {
      const next = { ...prev };
      delete next[ip];
      try {
        localStorage.setItem('lanscape_device_locations', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetAllLocations = () => {
    setCustomLocations({});
    try {
      localStorage.removeItem('lanscape_device_locations');
    } catch {}
  };

  const handlePointerDownRouter = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    setDraggingIp('__router__');
  };

  const handlePointerDownDevice = (e: React.PointerEvent, ip: string, device: DeviceData) => {
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    setDraggingIp(ip);
    setSelectedDevice(device);
  };

  const handlePointerDownSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isWallBuilderOpen) return;
    if (draggingIp) return;
    if (!svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const inv = pt.matrixTransform(ctm.inverse());
    const snapX = Math.round(Math.max(60, Math.min(790, inv.x)) / 20) * 20;
    const snapY = Math.round(Math.max(45, Math.min(455, inv.y)) / 20) * 20;

    setDrawingStart({ x: snapX, y: snapY });
    setDrawingCurrent({ x: snapX, y: snapY });
  };

  const handlePointerMoveSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const inv = pt.matrixTransform(ctm.inverse());
    const clampedX = Math.round(Math.max(60, Math.min(790, inv.x)));
    const clampedY = Math.round(Math.max(45, Math.min(455, inv.y)));

    setHoverProbe({ x: clampedX, y: clampedY, visible: true });

    if (isWallBuilderOpen && drawingStart) {
      let snapX = Math.round(clampedX / 20) * 20;
      let snapY = Math.round(clampedY / 20) * 20;
      // Auto-snap to orthogonal (horizontal or vertical) unless Shift is pressed
      if (!e.shiftKey) {
        const dx = Math.abs(snapX - drawingStart.x);
        const dy = Math.abs(snapY - drawingStart.y);
        if (dx > dy) {
          snapY = drawingStart.y;
        } else {
          snapX = drawingStart.x;
        }
      }
      setDrawingCurrent({ x: snapX, y: snapY });
      return;
    }

    if (draggingIp === '__router__') {
      setRouterPos({ x: clampedX, y: clampedY });
      return;
    }

    if (draggingIp) {
      setCustomLocations(prev => ({
        ...prev,
        [draggingIp]: { x: clampedX, y: clampedY }
      }));
    }
  };

  const handlePointerUpSvg = () => {
    if (isWallBuilderOpen && drawingStart && drawingCurrent) {
      const length = Math.hypot(drawingCurrent.x - drawingStart.x, drawingCurrent.y - drawingStart.y);
      if (length >= 35) {
        const newWall: WallSegment = {
          id: `wall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          x1: drawingStart.x,
          y1: drawingStart.y,
          x2: drawingCurrent.x,
          y2: drawingCurrent.y
        };
        const next = [...walls, newWall];
        setWalls(next);
        try { localStorage.setItem('lanscape_walls', JSON.stringify(next)); } catch {}
      }
      setDrawingStart(null);
      setDrawingCurrent(null);
      return;
    }

    if (draggingIp === '__router__') {
      setDraggingIp(null);
      try {
        localStorage.setItem('lanscape_router_pos', JSON.stringify(routerPos));
      } catch {}
      return;
    }
    if (draggingIp) {
      setDraggingIp(null);
      try {
        localStorage.setItem('lanscape_device_locations', JSON.stringify(customLocations));
      } catch {}
    }
  };

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      try {
        localStorage.setItem('lanscape_theme', next ? 'dark' : 'light');
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
    if (text.includes('tv') || text.includes('samsung') || text.includes('lg') || text.includes('sony')) {
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
  const clientDevices = deduplicatedDevices.filter(d => d.ip_address !== (routerStatus?.router_ip || '192.168.1.1'));
  const onlineClientCount = clientDevices.filter(d => d.last_status === 'online').length;
  const disconnectedClientCount = clientDevices.filter(d => d.last_status !== 'online').length;
  const totalOnlineCount = onlineClientCount + (routerStatus?.reachable ? 1 : 0);

  // Dynamically assign slots based strictly on actual client devices, prioritizing online devices
  const mappedDevicePins = (() => {
    const activeSlots = DEFAULT_CLIENT_SLOTS;
    const remainingSlots = [...activeSlots];
    const rawPins: Array<{ device: DeviceData; slot: typeof activeSlots[0]; type: string }> = [];

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
        rawPins.push({ device: d, slot, type });
      } else {
        unassignedDevices.push(d);
      }
    }

    for (const d of unassignedDevices) {
      if (remainingSlots.length > 0) {
        const slot = remainingSlots.shift()!;
        rawPins.push({ device: d, slot, type: getDeviceType(d) });
      }
    }

    return rawPins.map(p => {
      const custom = customLocations[p.device.ip_address];
      const x = custom ? custom.x : p.slot.x;
      const y = custom ? custom.y : p.slot.y;
      const sig = getSignalAtCoord(x, y, heatmapBand === '5ghz', routerPos.x, routerPos.y, walls);
      const roomName = getRoomNameAtCoord(x, y);
      return {
        ...p,
        x,
        y,
        isCustom: !!custom,
        sig,
        roomName
      };
    });
  })();

  const displayDownloadMbps = !routerStatus?.reachable
    ? '0.00'
    : hostTraffic && typeof hostTraffic.download_mbps === 'number'
    ? hostTraffic.download_mbps.toFixed(2)
    : '0.00';

  const displayUploadMbps = !routerStatus?.reachable
    ? '0.00'
    : hostTraffic && typeof hostTraffic.upload_mbps === 'number'
    ? hostTraffic.upload_mbps.toFixed(2)
    : '0.00';

  const connectedCount = deduplicatedDevices.length;

  // Real live data: prefer router WAN snapshot when available; fallback to real host network counters from psutil
  const rawRecvBytes = currentWanSample
    ? currentWanSample.bytes_received_total
    : hostTraffic
    ? hostTraffic.bytes_recv_total
    : 0;

  const rawSentBytes = currentWanSample
    ? currentWanSample.bytes_sent_total
    : hostTraffic
    ? hostTraffic.bytes_sent_total
    : 0;

  const rawTotalBytes = rawRecvBytes + rawSentBytes;

  const totalUsageGb = (rawTotalBytes / 1073741824).toFixed(2);
  const downloadUsageGb = (rawRecvBytes / 1073741824).toFixed(2);
  const uploadUsageGb = (rawSentBytes / 1073741824).toFixed(2);

  const downloadPercent = rawTotalBytes > 0
    ? Math.min(100, Math.max(1, Math.round((rawRecvBytes / rawTotalBytes) * 100)))
    : 50;
  const uploadPercent = 100 - downloadPercent;

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
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full border-2 overflow-hidden flex items-center justify-center shrink-0 ${
              isDark ? 'border-[#38BDF8]' : 'border-[#1E2360]'
            }`}>
              <img src="/logo.png" alt="LANscape" className="w-full h-full object-cover" />
            </div>
            <span className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>LANscape</span>
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
              <div className={`w-10 h-10 rounded-full border-2 overflow-hidden flex items-center justify-center shrink-0 ${
                isDark ? 'bg-[#291730] border-[#F472B6]' : 'bg-[#FFF0F4] border-[#1E2360]'
              }`}>
                <img src="/logo.png" alt="LANscape" className="w-full h-full object-cover" />
              </div>
              <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>LANscape</h2>
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
          <span className="text-[10px] font-extrabold uppercase text-[#FFF7C2] block">Router Gateway</span>
          <span className="text-xs font-black">{routerStatus?.router_ip || 'Detecting...'}</span>
        </div>
      </div>

      {/* DESKTOP SIDEBAR (Visible only on md and up) */}
      <aside className={`hidden md:flex w-64 border-r-[3px] flex-col justify-between p-6 shrink-0 relative sticky top-0 h-screen transition-colors duration-200 ${
        isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-[#FFFDF7] border-[#1E2360]'
      }`}>
        <div>
          {/* Logo Brand */}
          <div className="relative flex flex-col items-center justify-center mb-8 pt-2">
            <div className={`relative w-20 h-20 rounded-full border-[3px] overflow-hidden flex items-center justify-center mb-2 shadow-sm ${
              isDark ? 'bg-[#171C3F] border-[#38BDF8]' : 'bg-[#FFFDF2] border-[#1E2360]'
            }`}>
              <img src="/logo.png" alt="LANscape Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>LANscape</h1>
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
            <span className="text-[11px] font-extrabold uppercase tracking-wider block text-[#FFF7C2]">
              {routerStatus?.reachable ? 'Online Gateway' : 'Router Gateway'}
            </span>
            <div className="text-sm font-black mt-0.5">Router Gateway</div>
            <p className="text-[11px] opacity-90 mt-1">Gateway: {routerStatus?.router_ip || 'Detecting...'}</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#F06292] uppercase tracking-wider mb-1">
              {getGreeting()}!
            </p>

            {/* Stadium Pill Title Banner */}
            <div className="relative inline-block my-1 max-w-full">
              <div className={`relative border-[3px] px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-sm flex items-center space-x-2.5 sm:space-x-3 ${
                isDark ? 'bg-[#171C3F] border-[#2A3266]' : 'bg-[#FFFDF0] border-[#1E2360]'
              }`}>
                <div className={`w-8 h-8 rounded-full border-2 overflow-hidden shrink-0 ${
                  isDark ? 'border-[#38BDF8]' : 'border-[#1E2360]'
                }`}>
                  <img src="/logo.png" alt="LANscape Logo" className="w-full h-full object-cover" />
                </div>
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

            {/* User Profile Avatar with Logo */}
            <div className={`w-11 h-11 rounded-full border-[2.5px] overflow-hidden flex items-center justify-center font-black shadow-sm ${
              isDark ? 'bg-[#291730] border-[#F472B6]' : 'bg-[#FFF0F4] border-[#1E2360]'
            }`}>
              <img src="/logo.png" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* ROUTER OFFLINE WARNING BANNER */}
        {routerStatus && !routerStatus.reachable && (
          <div className="mx-4 sm:px-6 lg:mx-8 mb-6 p-4 bg-[#FFF0F0] border-[2.5px] border-[#DC2626] rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-black text-[#DC2626] text-sm uppercase">Router Gateway ({routerStatus?.router_ip || 'Default Gateway'}) Unreachable</h4>
                <p className="text-xs font-bold text-[#991B1B]">
                  Your router/gateway is offline or unreachable. LANscape remains accessible because it runs on your local machine.
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

                    {/* Floor Plan Wall Designer Toggle */}
                    <button
                      onClick={() => setIsWallBuilderOpen(!isWallBuilderOpen)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase border-2 transition-all shadow-xs active:scale-95 ${
                        isWallBuilderOpen
                          ? 'bg-[#F06292] text-white border-[#F06292] animate-pulse'
                          : isDark
                            ? 'bg-[#1A2048] text-[#CBD5E1] border-[#2A3266] hover:text-white'
                            : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF0F4]'
                      }`}
                      title="Draw and design your walls to see real-time Wi-Fi attenuation"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{isWallBuilderOpen ? 'Done Walls' : 'Design Walls'}</span>
                    </button>

                    {/* Speed & Signal Inspector Toggle */}
                    <button
                      onClick={() => setShowSpeedInspector(!showSpeedInspector)}
                      className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs font-black uppercase border-2 transition-all shadow-xs active:scale-95 ${
                        showSpeedInspector
                          ? 'bg-[#10B981] text-white border-[#10B981]'
                          : isDark
                            ? 'bg-[#1A2048] text-[#94A3B8] border-[#2A3266] hover:text-white'
                            : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF0F4]'
                      }`}
                      title="Hover anywhere on the floor plan to inspect real-time Wi-Fi speed & signal"
                    >
                      <Zap className={`w-3.5 h-3.5 ${showSpeedInspector ? 'animate-pulse' : ''}`} />
                      <span className="hidden sm:inline">Speed Probe</span>
                    </button>

                    {/* Reset Router Position Button (when router was dragged) */}
                    {(routerPos.x !== 330 || routerPos.y !== 230) && (
                      <button
                        onClick={resetRouterPos}
                        className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs font-black uppercase border-2 transition-all ${
                          isDark ? 'bg-[#171C3F] text-[#38BDF8] border-[#38BDF8]' : 'bg-white text-[#1E2360] border-[#1E2360]'
                        }`}
                        title="Reset router back to center location"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">Center Router</span>
                      </button>
                    )}

                    {/* Reset Pins Layout Button */}
                    {Object.keys(customLocations).length > 0 && (
                      <button
                        onClick={resetAllLocations}
                        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-black uppercase border-2 transition-all active:scale-95 ${
                          isDark
                            ? 'bg-[#171C3F] text-[#94A3B8] border-[#2A3266] hover:text-white hover:border-[#38BDF8]'
                            : 'bg-white text-[#1E2360] border-[#1E2360] hover:bg-[#FFF0F4]'
                        }`}
                        title="Reset all devices to default room layout"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reset Pins</span>
                      </button>
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

                {/* Wall Designer Sub-Toolbar Banner */}
                {isWallBuilderOpen && (
                  <div className={`mb-3 p-3 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 ${
                    isDark ? 'bg-[#171C3F] border-[#38BDF8]' : 'bg-[#FFF0F4] border-[#1E2360]'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F06292] animate-ping" />
                      <span className={`font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>
                        🧱 WALL DESIGNER:
                      </span>
                      <span className={`text-[11px] hidden sm:inline ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        Click & drag on the map to draw walls • Click any wall to remove it
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => addWallDirect('horizontal')}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition ${
                          isDark ? 'bg-[#111533] border-[#2A3266] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#0B0E21]' : 'bg-white border-[#1E2360] text-[#1E2360] hover:bg-[#1E2360] hover:text-white'
                        }`}
                        title="Add a horizontal wall in the center"
                      >
                        + Horiz Wall
                      </button>
                      <button
                        onClick={() => addWallDirect('vertical')}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition ${
                          isDark ? 'bg-[#111533] border-[#2A3266] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#0B0E21]' : 'bg-white border-[#1E2360] text-[#1E2360] hover:bg-[#1E2360] hover:text-white'
                        }`}
                        title="Add a vertical wall in the center"
                      >
                        + Vert Wall
                      </button>
                      <button
                        onClick={undoLastWall}
                        disabled={walls.length === 0}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition ${
                          walls.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                        } ${
                          isDark ? 'bg-[#111533] border-[#2A3266] text-white hover:bg-white/10' : 'bg-white border-[#1E2360] text-[#1E2360] hover:bg-gray-100'
                        }`}
                        title="Undo last added wall"
                      >
                        <Undo className="w-3 h-3 inline mr-1" /> Undo
                      </button>
                      <button
                        onClick={clearAllWalls}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition ${
                          isDark ? 'border-red-800 text-red-400 hover:bg-red-950' : 'border-red-300 text-red-600 hover:bg-red-50'
                        }`}
                        title="Remove all walls"
                      >
                        <Trash2 className="w-3 h-3 inline mr-1" /> Clear
                      </button>
                      <button
                        onClick={resetDefaultWalls}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition ${
                          isDark ? 'bg-[#111533] border-[#2A3266] text-slate-300' : 'bg-white border-[#1E2360] text-[#1E2360]'
                        }`}
                        title="Reset to default starter floor plan"
                      >
                        ↺ Reset
                      </button>
                      <button
                        onClick={() => setIsWallBuilderOpen(false)}
                        className="px-3 py-1 rounded-full text-[11px] font-black bg-[#10B981] text-white border border-[#10B981] hover:bg-[#059669] transition flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3 inline" />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SVG Floor Plan (Fully Responsive Aspect Ratio) */}
                <div className={`relative w-full aspect-[4/3] sm:aspect-[16/10] md:aspect-[16/9] min-h-[260px] rounded-2xl border-2 overflow-hidden flex items-center justify-center p-2 transition-colors duration-200 ${
                  isDark ? 'bg-[#0A0D23] border-[#2A3266]' : 'bg-[#FFF8EB] border-[#1E2360]'
                }`}>
                  <svg
                    ref={svgRef}
                    viewBox="0 0 850 500"
                    className={`w-full h-full select-none ${isWallBuilderOpen ? 'cursor-crosshair' : draggingIp ? 'cursor-grabbing' : ''}`}
                    style={{ touchAction: 'none' }}
                    onPointerDown={handlePointerDownSvg}
                    onPointerMove={handlePointerMoveSvg}
                    onPointerUp={handlePointerUpSvg}
                    onPointerLeave={() => {
                      handlePointerUpSvg();
                      setHoverProbe(prev => ({ ...prev, visible: false }));
                    }}
                  >
                    {/* SVG Definitions for Wi-Fi Signal Heatmaps */}
                    <defs>
                      {/* 5 GHz Radial Gradient: High speed, sharper wall attenuation */}
                      <radialGradient id="wifiHeatmap5G" cx={routerPos.x} cy={routerPos.y} r="370" fx={routerPos.x} fy={routerPos.y} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={isDark ? 0.70 : 0.55} />
                        <stop offset="18%" stopColor="#22C55E" stopOpacity={isDark ? 0.60 : 0.45} />
                        <stop offset="38%" stopColor="#EAB308" stopOpacity={isDark ? 0.50 : 0.35} />
                        <stop offset="62%" stopColor="#F97316" stopOpacity={isDark ? 0.38 : 0.25} />
                        <stop offset="82%" stopColor="#EF4444" stopOpacity={isDark ? 0.25 : 0.15} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                      </radialGradient>

                      {/* 2.4 GHz Radial Gradient: Wider radius, deeper wall penetration */}
                      <radialGradient id="wifiHeatmap24G" cx={routerPos.x} cy={routerPos.y} r="480" fx={routerPos.x} fy={routerPos.y} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={isDark ? 0.65 : 0.50} />
                        <stop offset="26%" stopColor="#22C55E" stopOpacity={isDark ? 0.55 : 0.40} />
                        <stop offset="50%" stopColor="#EAB308" stopOpacity={isDark ? 0.45 : 0.30} />
                        <stop offset="72%" stopColor="#F97316" stopOpacity={isDark ? 0.32 : 0.20} />
                        <stop offset="90%" stopColor="#EF4444" stopOpacity={isDark ? 0.20 : 0.10} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                      </radialGradient>
                    </defs>

                    {/* Architectural Floor Plan Base & Outer Boundary */}
                    <rect
                      x="60"
                      y="45"
                      width="730"
                      height="410"
                      rx="16"
                      fill={isDark ? "#0F142D" : "#FAF8F5"}
                      stroke={isDark ? "#818CF8" : "#1E2360"}
                      strokeWidth="4"
                    />

                    {/* Subtle Alignment Dot Grid (Visible in Wall Designer Mode) */}
                    {isWallBuilderOpen && (
                      <g className="pointer-events-none select-none">
                        <pattern id="wallDotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <circle cx="10" cy="10" r="1.2" fill={isDark ? "#818CF8" : "#1E2360"} opacity="0.3" />
                        </pattern>
                        <rect x="60" y="45" width="730" height="410" rx="16" fill="url(#wallDotGrid)" />
                      </g>
                    )}

                    {/* Floor Area Subtle Tinting */}
                    <g stroke="none" className="pointer-events-none">
                      <rect x="60" y="45" width="210" height="185" fill={isDark ? "#141A38" : "#EEF2FF"} opacity="0.55" rx="12" />
                      <rect x="60" y="235" width="210" height="220" fill={isDark ? "#1A1738" : "#FAF5FF"} opacity="0.55" rx="12" />
                      <rect x="270" y="45" width="250" height="155" fill={isDark ? "#222030" : "#FEF3C7"} opacity="0.45" rx="12" />
                      <rect x="520" y="45" width="270" height="205" fill={isDark ? "#131C38" : "#E0F2FE"} opacity="0.45" rx="12" />
                      <rect x="520" y="250" width="270" height="205" fill={isDark ? "#161D42" : "#F1F5F9"} opacity="0.45" rx="12" />
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

                        {/* Concentric Propagation Rings from Dynamic Router Location */}
                        <g transform={`translate(${routerPos.x}, ${routerPos.y})`}>
                          <circle cx="0" cy="0" r="75" fill="none" stroke="#22C55E" strokeWidth="1" strokeDasharray="3 3" opacity={isDark ? 0.5 : 0.35} />
                          <circle cx="0" cy="0" r="150" fill="none" stroke="#EAB308" strokeWidth="1" strokeDasharray="4 4" opacity={isDark ? 0.45 : 0.30} />
                          <circle cx="0" cy="0" r="245" fill="none" stroke="#F97316" strokeWidth="1" strokeDasharray="5 5" opacity={isDark ? 0.4 : 0.25} />
                          <circle cx="0" cy="0" r="345" fill="none" stroke="#EF4444" strokeWidth="1" strokeDasharray="6 6" opacity={isDark ? 0.3 : 0.18} />
                        </g>
                      </g>
                    )}

                    {/* Room Area Directional Labels */}
                    <g fill={isDark ? "#94A3B8" : "#1E2360"} fontSize="11" fontWeight="800" letterSpacing="0.06em" className="pointer-events-none select-none">
                      <text x="135" y="145">BEDROOM 1</text>
                      <text x="135" y="350">BEDROOM 2</text>
                      <text x="350" y="100">KITCHEN</text>
                      <text x="400" y="435" fill="#F06292">WORK NOOK</text>
                      <text x="630" y="145">TV LOUNGE</text>
                      <text x="630" y="350">BALCONY</text>
                    </g>

                    {/* User-Designed Architectural Walls */}
                    <g>
                      {walls.map(w => {
                        const isHovered = hoveredWallId === w.id;
                        const midX = (w.x1 + w.x2) / 2;
                        const midY = (w.y1 + w.y2) / 2;

                        return (
                          <g key={w.id} className="group">
                            {/* Wide transparent hit target for deleting when in Wall Designer mode */}
                            {isWallBuilderOpen && (
                              <line
                                x1={w.x1}
                                y1={w.y1}
                                x2={w.x2}
                                y2={w.y2}
                                stroke="transparent"
                                strokeWidth="22"
                                className="cursor-pointer"
                                onPointerEnter={() => setHoveredWallId(w.id)}
                                onPointerLeave={() => setHoveredWallId(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteWall(w.id);
                                }}
                              />
                            )}

                            {/* Solid Wall Bar */}
                            <line
                              x1={w.x1}
                              y1={w.y1}
                              x2={w.x2}
                              y2={w.y2}
                              stroke={
                                isWallBuilderOpen && isHovered
                                  ? "#EF4444"
                                  : isDark ? "#818CF8" : "#1E2360"
                              }
                              strokeWidth={isWallBuilderOpen && isHovered ? "6" : "4.5"}
                              strokeLinecap="round"
                              className="transition-colors pointer-events-none"
                            />

                            {/* Delete Pill Indicator when Hovered in Designer Mode */}
                            {isWallBuilderOpen && isHovered && (
                              <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none select-none">
                                <circle cx="0" cy="0" r="11" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
                                <text x="0" y="3.5" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900">
                                  ✕
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </g>

                    {/* Active Wall Drawing Live Preview */}
                    {isWallBuilderOpen && drawingStart && drawingCurrent && (() => {
                      const wallLenM = (Math.hypot(drawingCurrent.x - drawingStart.x, drawingCurrent.y - drawingStart.y) / 55).toFixed(1);
                      const midX = (drawingStart.x + drawingCurrent.x) / 2;
                      const midY = (drawingStart.y + drawingCurrent.y) / 2;

                      return (
                        <g className="pointer-events-none select-none">
                          <line
                            x1={drawingStart.x}
                            y1={drawingStart.y}
                            x2={drawingCurrent.x}
                            y2={drawingCurrent.y}
                            stroke="#F06292"
                            strokeWidth="5"
                            strokeDasharray="6 4"
                            strokeLinecap="round"
                          />
                          <circle cx={drawingStart.x} cy={drawingStart.y} r="5" fill="#F06292" />
                          <circle cx={drawingCurrent.x} cy={drawingCurrent.y} r="5" fill="#F06292" />
                          <g transform={`translate(${midX}, ${midY - 12})`}>
                            <rect x="-24" y="-8" width="48" height="16" rx="8" fill="#F06292" />
                            <text x="0" y="3.5" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="900">
                              {wallLenM}m
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {/* Concentric Wi-Fi waves from router (only when router is reachable and heatmap is off) */}
                    <g transform={`translate(${routerPos.x}, ${routerPos.y})`}>
                      {routerStatus?.reachable && !showHeatmap && (
                        <>
                          <circle cx="0" cy="0" r="45" fill="none" stroke="#F06292" strokeWidth="1.5" opacity="0.25" />
                          <circle cx="0" cy="0" r="90" fill="none" stroke="#F06292" strokeWidth="1.5" opacity="0.12" />
                        </>
                      )}

                      {/* Router Gateway Icon with draggable hit target */}
                      <g
                        className="cursor-pointer group"
                      >
                        {/* Stationary hit area with pointer capture for dragging the router */}
                        <circle
                          cx="0"
                          cy="0"
                          r="34"
                          fill="transparent"
                          pointerEvents="all"
                          className="cursor-grab active:cursor-grabbing"
                          onPointerDown={handlePointerDownRouter}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDevice({
                              id: 1,
                              ip_address: routerStatus?.router_ip || 'Default Gateway',
                              mac_address: 'gateway:nic',
                              hostname: 'Gateway Router',
                              friendly_name: 'Main Router / Gateway',
                              source: 'gateway_router',
                              first_seen: new Date().toISOString(),
                              last_seen: new Date().toISOString(),
                              last_status: routerStatus?.reachable ? 'online' : 'disconnected'
                            });
                          }}
                        />

                        {/* Dragging Router visual beacon */}
                        {draggingIp === '__router__' && (
                          <g className="pointer-events-none select-none">
                            <circle cx="0" cy="0" r="46" fill="none" stroke="#F06292" strokeWidth="2" strokeDasharray="4 3" />
                            <g transform="translate(0, -32)">
                              <rect x="-50" y="-9" width="100" height="18" rx="9" fill="#F06292" />
                              <text x="0" y="3.5" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
                                📍 RELOCATING ROUTER
                              </text>
                            </g>
                          </g>
                        )}

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

                    {/* Dynamic Dragging Guide Line from Router to Dragged Device */}
                    {draggingIp && draggingIp !== '__router__' && (() => {
                      const pin = mappedDevicePins.find(p => p.device.ip_address === draggingIp);
                      if (!pin) return null;
                      const midX = (routerPos.x + pin.x) / 2;
                      const midY = (routerPos.y + pin.y) / 2;
                      return (
                        <g className="pointer-events-none select-none">
                          <line
                            x1={routerPos.x}
                            y1={routerPos.y}
                            x2={pin.x}
                            y2={pin.y}
                            stroke={pin.sig.color}
                            strokeWidth="2.5"
                            strokeDasharray="5 4"
                            opacity="0.9"
                          />
                          <circle cx={pin.x} cy={pin.y} r="32" fill="none" stroke={pin.sig.color} strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
                          {/* Distance & Signal HUD pill at midpoint */}
                          <g transform={`translate(${midX}, ${midY})`}>
                            <rect
                              x="-50"
                              y="-11"
                              width="100"
                              height="22"
                              rx="11"
                              fill={isDark ? "#0A0D23" : "#FFFFFF"}
                              stroke={pin.sig.color}
                              strokeWidth="2"
                            />
                            <text
                              x="0"
                              y="4"
                              textAnchor="middle"
                              fill={pin.sig.color}
                              fontSize="8.5"
                              fontWeight="900"
                            >
                              {pin.sig.distMeters}m • ~{pin.sig.estimatedSpeedMbps}M
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {/* STRICTLY DYNAMIC CLIENT PINS (Online, Disconnected & Draggable) */}
                    {mappedDevicePins.map(({ device, x, y, type, sig, isCustom, roomName }) => {
                      const isOnline = device.last_status === 'online';
                      const isBeingDragged = draggingIp === device.ip_address;

                      return (
                        <g
                          key={device.id || device.ip_address}
                          transform={`translate(${x}, ${y})`}
                          className={`group ${isBeingDragged ? 'cursor-grabbing opacity-90' : 'cursor-grab'}`}
                        >
                          {/* Stationary invisible hit target with pointer capture for buttery smooth dragging */}
                          <circle
                            cx="0"
                            cy="8"
                            r="44"
                            fill="transparent"
                            pointerEvents="all"
                            className="cursor-grab active:cursor-grabbing"
                            onPointerDown={(e) => handlePointerDownDevice(e, device.ip_address, device)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDevice(device);
                            }}
                          />

                          {/* Visual element with origin-centered scaling on group hover */}
                          <g
                            className="transition-transform duration-150 ease-out group-hover:scale-110 group-active:scale-95 pointer-events-none"
                            style={{ transformOrigin: '0px 8px' }}
                          >
                            {/* Speech Bubble Base */}
                            <path
                              d="M-22,-20 L22,-20 A16,16 0 0,1 38,-4 L38,12 A16,16 0 0,1 22,28 L6,28 L0,36 L-6,28 L-22,28 A16,16 0 0,1 -38,12 L-38,-4 A16,16 0 0,1 -22,-20 Z"
                              fill={isOnline ? (isDark ? "#171C3F" : "#FFFFFF") : (isDark ? "#12152E" : "#F4F5F7")}
                              stroke={isCustom ? "#F06292" : isOnline ? (isDark ? "#818CF8" : "#1E2360") : (isDark ? "#475569" : "#94A3B8")}
                              strokeWidth={isCustom ? "3" : "2.5"}
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
                                  x="-37"
                                  y="-8"
                                  width="74"
                                  height="16"
                                  rx="8"
                                  fill={isDark ? "#0E132D" : "#FFFFFF"}
                                  stroke={sig.color}
                                  strokeWidth="1.5"
                                />
                                <text
                                  x="0"
                                  y="3.5"
                                  textAnchor="middle"
                                  fill={sig.color}
                                  fontSize="7.5"
                                  fontWeight="900"
                                >
                                  {sig.rssi} dBm • ~{sig.estimatedSpeedMbps}M
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
                              {device.ip_address.replace(/^(192\.168\.\d+\.|10\.\d+\.\d+\.|172\.(1[6-9]|2\d|3[01])\.\d+\.)/, '.')} {!isOnline ? '(OFF)' : ''}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* Interactive Speed & Signal Inspector Reticle + Floating HUD */}
                    {showSpeedInspector && hoverProbe.visible && !draggingIp && !isWallBuilderOpen && (() => {
                      const probeSig = getSignalAtCoord(hoverProbe.x, hoverProbe.y, heatmapBand === '5ghz', routerPos.x, routerPos.y, walls);
                      const probeRoom = getRoomNameAtCoord(hoverProbe.x, hoverProbe.y);
                      const tooltipX = hoverProbe.x > 670 ? hoverProbe.x - 175 : hoverProbe.x + 18;
                      const tooltipY = hoverProbe.y > 410 ? hoverProbe.y - 70 : Math.max(30, hoverProbe.y - 35);

                      return (
                        <g className="pointer-events-none select-none">
                          {/* Radial guide line from router to probe */}
                          <line
                            x1={routerPos.x}
                            y1={routerPos.y}
                            x2={hoverProbe.x}
                            y2={hoverProbe.y}
                            stroke={probeSig.color}
                            strokeWidth="1.8"
                            strokeDasharray="4 3"
                            opacity="0.8"
                          />
                          {/* Target Reticle */}
                          <circle cx={hoverProbe.x} cy={hoverProbe.y} r="18" fill="none" stroke={probeSig.color} strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <circle cx={hoverProbe.x} cy={hoverProbe.y} r="3.5" fill={probeSig.color} />
                          <line x1={hoverProbe.x - 10} y1={hoverProbe.y} x2={hoverProbe.x + 10} y2={hoverProbe.y} stroke={probeSig.color} strokeWidth="1.5" />
                          <line x1={hoverProbe.x} y1={hoverProbe.y - 10} x2={hoverProbe.x} y2={hoverProbe.y + 10} stroke={probeSig.color} strokeWidth="1.5" />

                          {/* Floating HUD Tooltip */}
                          <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                            <rect
                              x="0"
                              y="0"
                              width="168"
                              height="68"
                              rx="10"
                              fill={isDark ? "#0A0D23" : "#FFFFFF"}
                              stroke={probeSig.color}
                              strokeWidth="2"
                              filter="drop-shadow(0 4px 6px rgba(0,0,0,0.25))"
                            />
                            {/* Estimated Speed */}
                            <text x="12" y="21" fill={probeSig.color} fontSize="14" fontWeight="900">
                              ⚡ ~{probeSig.estimatedSpeedMbps} Mbps
                            </text>
                            {/* Signal & Distance */}
                            <text x="12" y="38" fill={isDark ? "#E2E8F0" : "#1E2360"} fontSize="9" fontWeight="800">
                              {probeSig.rssi} dBm ({probeSig.quality}) • {probeSig.distMeters}m
                            </text>
                            {/* Walls In Path */}
                            <text x="12" y="54" fill={isDark ? "#94A3B8" : "#64748B"} fontSize="8" fontWeight="800">
                              🧱 {probeSig.wallsCrossed === 0 ? 'Direct Line of Sight (0 walls)' : `${probeSig.wallsCrossed} wall${probeSig.wallsCrossed > 1 ? 's' : ''} in path (-${Math.round(probeSig.wallsCrossed * (heatmapBand === '5ghz' ? 6.5 : 4.0))} dBm)`}
                            </text>
                          </g>
                        </g>
                      );
                    })()}

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

                {/* Interactive Drag & Proximity Hint Banner directly under Floor Plan */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-2 px-1 text-[11px] font-bold">
                  <span className={`flex items-center space-x-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                    <Move className="w-3.5 h-3.5 text-[#F06292]" />
                    <span>
                      {isWallBuilderOpen
                        ? 'Wall Mode: Drag on map to draw partition walls • Click any wall to remove it'
                        : 'Drag router or devices anywhere • Custom walls dynamically block signal & reduce speeds'}
                    </span>
                  </span>
                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isDark ? 'bg-[#171C3F] border-[#38BDF8] text-[#38BDF8]' : 'bg-[#FFF0F4] border-[#F06292] text-[#F06292]'
                    }`}>
                      {walls.length} Wall{walls.length === 1 ? '' : 's'}
                    </span>
                    {Object.keys(customLocations).length > 0 && (
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isDark ? 'bg-[#171C3F] border-[#38BDF8] text-[#38BDF8]' : 'bg-[#FFF0F4] border-[#F06292] text-[#F06292]'
                      }`}>
                        {Object.keys(customLocations).length} Custom Location{Object.keys(customLocations).length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Selected Device Banner with Wi-Fi Diagnostics & Spatial Relocation */}
                {selectedDevice && (() => {
                  const devPin = mappedDevicePins.find(p => p.device.ip_address === selectedDevice.ip_address);
                  const sig = devPin?.sig;
                  const isOnline = selectedDevice.last_status === 'online';

                  return (
                    <div className={`mt-3 border-2 rounded-2xl p-3 sm:p-3.5 flex flex-col gap-3 text-xs font-bold animate-in fade-in ${
                      isOnline
                        ? isDark ? 'bg-[#171C3F] border-[#38BDF8]' : 'bg-[#FFF0F4] border-[#1E2360]'
                        : 'bg-[#FFF0F0] border-[#DC2626]'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                                  &bull; {sig.distMeters}m &bull; {sig.rssi} dBm ({sig.quality}) &bull; ~{sig.estimatedSpeedMbps} Mbps
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

                          {devPin?.isCustom && (
                            <button
                              onClick={() => resetDeviceLocation(selectedDevice.ip_address)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                                isDark ? 'border-red-900 text-red-400 hover:bg-red-950' : 'border-red-300 text-red-600 hover:bg-red-50'
                              }`}
                              title="Reset pin back to default slot"
                            >
                              Reset Pin
                            </button>
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

                  {/* Growth / Telemetry Status Stadium Pill */}
                  <div className={`inline-flex items-center space-x-1.5 border-2 px-3.5 py-1 rounded-full text-xs font-black mb-5 sm:mb-6 shadow-sm ${
                    isDark ? 'bg-[#291730] text-[#F472B6] border-[#F472B6]' : 'bg-[#FFF0F4] text-[#F06292] border-[#1E2360]'
                  }`}>
                    <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{currentWanSample ? 'WAN Interface Data' : 'Live Host Interface Data'}</span>
                  </div>

                  {/* Candy Dual Progress Bar (Proportion of Download vs Upload) */}
                  <div className={`w-full h-5 border-2 rounded-full overflow-hidden flex mb-5 sm:mb-6 p-0.5 ${
                    isDark ? 'bg-[#1A1A3C] border-[#2A3266]' : 'bg-[#FFF0F4] border-[#1E2360]'
                  }`}>
                    <div className={`${isDark ? 'bg-[#38BDF8]' : 'bg-[#1E2360]'} h-full rounded-l-full transition-all duration-300`} style={{ width: `${downloadPercent}%` }}></div>
                    <div className="bg-[#F06292] h-full rounded-r-full transition-all duration-300" style={{ width: `${uploadPercent}%` }}></div>
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
                  <span>{currentWanSample ? 'Router WAN Counters' : 'Host Interface (psutil)'}</span>
                  <span className={`border px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isDark ? 'bg-[#0E2824] text-[#10B981] border-[#10B981]' : 'bg-[#E8F8F0] text-[#1E2360] border-[#1E2360]'
                  }`}>
                    {currentWanSample ? 'WAN VERIFIED' : 'LIVE HOST'}
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
                    {currentWanSample ? 'Router WAN Counters' : 'Host Cumulative Usage'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className={`p-3.5 sm:p-4 rounded-xl border-2 ${
                      isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                    }`}>
                      <span className={`text-[10px] font-black uppercase block ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>
                        {currentWanSample ? 'Observed Download' : 'Host Total Download'}
                      </span>
                      <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>{downloadUsageGb} GB</span>
                    </div>
                    <div className={`p-3.5 sm:p-4 rounded-xl border-2 ${
                      isDark ? 'bg-[#111533] border-[#2A3266]' : 'bg-white border-[#1E2360]'
                    }`}>
                      <span className={`text-[10px] font-black uppercase block ${isDark ? 'text-slate-400' : 'text-[#1E2360]/70'}`}>
                        {currentWanSample ? 'Observed Upload' : 'Host Total Upload'}
                      </span>
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
                    <div className={`uppercase font-black ${isDark ? 'text-white' : 'text-[#1E2360]'}`}>Router Gateway</div>
                    <div className="font-mono text-[#F06292] mt-0.5">{routerStatus?.router_ip || '192.168.1.1'}</div>
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
