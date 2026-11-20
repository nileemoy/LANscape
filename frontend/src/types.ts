export interface HealthStatus {
  status: string;
  application: string;
  version: string;
  timestamp: string;
}

export interface RouterStatusData {
  router_ip: string;
  reachable: boolean;
  latency_ms: number | null;
  integration_type: string;
  timestamp: string;
  error_message: string | null;
}

export interface LatencyData {
  router: {
    target: string;
    reachable: boolean;
    latency_ms: number | null;
  };
  internet: {
    target: string;
    reachable: boolean;
    latency_ms: number | null;
  };
  timestamp: string;
}

export interface DeviceData {
  id: number;
  ip_address: string;
  mac_address: string | null;
  hostname: string | null;
  friendly_name: string | null;
  source: string;
  first_seen: string;
  last_seen: string;
  last_status: string;
}

export interface HostTrafficData {
  source: string;
  description: string;
  bytes_sent_total: number;
  bytes_recv_total: number;
  upload_mbps: number;
  download_mbps: number;
  timestamp: number;
}

export interface TrafficSampleData {
  id: number;
  interface_name: string;
  bytes_sent_total: number;
  bytes_received_total: number;
  sent_delta_bytes: number;
  received_delta_bytes: number;
  upload_mbps: number;
  download_mbps: number;
  counter_epoch: number;
  source: string;
  sampled_at: string;
}

