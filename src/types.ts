export interface DiagnosticItem {
  status: 'pass' | 'warning' | 'fail' | 'info';
  message?: string;
  version?: string;
  notes?: string;
  count?: number;
  keywords?: string[];
  model?: string;
  android?: string;
  build?: string;
  userAgent?: string;
}

export interface DoctorResponse {
  overall: string;
  timestamp: string;
  diagnostics: Record<string, DiagnosticItem>;
}

export interface IpInfo {
  query: string;
  country: string;
  countryCode: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
}

export interface IpResponse {
  ipInfo: IpInfo;
  emulationEnv: {
    EMULATION_TIMEZONE_ID: string;
    EMULATION_GEO_LATITUDE: number;
    EMULATION_GEO_LONGITUDE: number;
    EMULATION_GEO_ACCURACY: number;
  };
  promoEligibility: {
    isEligibleRegion: boolean;
    regionNote: string;
  };
}

export interface ProjectOverview {
  name: string;
  deviceModel: string;
  androidVersion: string;
  buildId: string;
  hasEnv: boolean;
  envExample: string;
  proxiesCount: number;
  files: string[];
}

export interface RegionInfo {
  region: string;
  countries: string[];
  status: 'Supported' | 'Partial' | 'Unsupported';
  notes: string;
}
