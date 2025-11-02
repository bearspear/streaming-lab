export interface NetworkSource {
  id: number;
  name: string;
  protocol: 'ftp' | 'smb' | 'upnp' | 'local';
  host: string;
  port?: number;
  username?: string;
  password?: string;
  base_path?: string;
  domain?: string;
  enabled: boolean;
  created_at: string;
}

export interface NetworkFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface BrowseResult {
  path: string;
  files: NetworkFile[];
}

export interface UPnPDevice {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  modelName?: string;
  modelNumber?: string;
  location: string;
  services?: any[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
}
