import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService, DashboardStats, UserWithStats, LibraryStats, MediaResponse } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/services/network.service';
import { NetworkSource, NetworkFile, BrowseResult, UPnPDevice } from '../../core/models/network.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private networkService = inject(NetworkService);
  private router = inject(Router);

  activeTab: 'dashboard' | 'users' | 'library' | 'media' | 'network' = 'dashboard';
  loading = false;
  error: string | null = null;

  // Dashboard data
  dashboardStats: DashboardStats | null = null;

  // Users data
  users: UserWithStats[] = [];

  // Library data
  libraryStats: LibraryStats | null = null;

  // Media data
  mediaList: any[] = [];
  mediaPagination: any = null;
  mediaType: string = 'all';
  mediaSearch: string = '';
  mediaPage: number = 1;

  // Network sources data
  networkSources: NetworkSource[] = [];
  showAddSourceForm = false;
  showBrowser = false;
  selectedSource: NetworkSource | null = null;
  browserPath: string = '/';
  browserFiles: NetworkFile[] = [];
  upnpDevices: UPnPDevice[] = [];
  newSource: Partial<NetworkSource> = {
    name: '',
    protocol: 'ftp',
    host: '',
    port: undefined,
    username: '',
    password: '',
    base_path: '/',
    enabled: true
  };

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading = true;
    this.error = null;

    this.adminService.getDashboardStats().subscribe({
      next: (data) => {
        this.dashboardStats = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load dashboard statistics';
        this.loading = false;
        console.error('Dashboard error:', err);
      }
    });
  }

  loadUsers() {
    this.loading = true;
    this.error = null;

    this.adminService.getUsers().subscribe({
      next: (data) => {
        this.users = data.users;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load users';
        this.loading = false;
        console.error('Users error:', err);
      }
    });
  }

  loadLibrary() {
    this.loading = true;
    this.error = null;

    this.adminService.getLibraryStats().subscribe({
      next: (data) => {
        this.libraryStats = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load library statistics';
        this.loading = false;
        console.error('Library error:', err);
      }
    });
  }

  loadMedia(page: number = 1) {
    this.loading = true;
    this.error = null;
    this.mediaPage = page;

    this.adminService.getAllMedia(page, 50, this.mediaType, this.mediaSearch).subscribe({
      next: (data) => {
        this.mediaList = data.media;
        this.mediaPagination = data.pagination;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load media items';
        this.loading = false;
        console.error('Media error:', err);
      }
    });
  }

  switchTab(tab: 'dashboard' | 'users' | 'library' | 'media' | 'network') {
    this.activeTab = tab;
    this.error = null;

    if (tab === 'dashboard') {
      this.loadDashboard();
    } else if (tab === 'users') {
      this.loadUsers();
    } else if (tab === 'library') {
      this.loadLibrary();
    } else if (tab === 'media') {
      this.loadMedia();
    } else if (tab === 'network') {
      this.loadNetworkSources();
    }
  }

  deleteUser(userId: number, username: string) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    this.adminService.deleteUser(userId).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to delete user';
        console.error('Delete user error:', err);
      }
    });
  }

  toggleAdminStatus(userId: number, username: string, currentStatus: boolean) {
    const action = currentStatus ? 'remove admin rights from' : 'promote to admin';
    if (!confirm(`Are you sure you want to ${action} user "${username}"?`)) {
      return;
    }

    this.adminService.toggleAdminStatus(userId).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update admin status';
        console.error('Toggle admin error:', err);
      }
    });
  }

  deleteMedia(mediaId: number, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}" from the database?`)) {
      return;
    }

    const deleteFile = confirm('Do you also want to delete the physical file?');

    this.adminService.deleteMediaItem(mediaId, deleteFile).subscribe({
      next: () => {
        this.loadMedia(this.mediaPage);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to delete media item';
        console.error('Delete media error:', err);
      }
    });
  }

  onMediaFilterChange() {
    this.loadMedia(1);
  }

  navigateToLibrary() {
    this.router.navigate(['/library']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getPageNumbers(): number[] {
    if (!this.mediaPagination) return [];
    const totalPages = this.mediaPagination.totalPages;
    const currentPage = this.mediaPagination.page;
    const pages: number[] = [];

    // Show up to 5 page numbers
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  // Network Sources Methods
  loadNetworkSources() {
    this.loading = true;
    this.error = null;

    this.networkService.getNetworkSources().subscribe({
      next: (data) => {
        this.networkSources = data.sources;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load network sources';
        this.loading = false;
        console.error('Network sources error:', err);
      }
    });
  }

  toggleAddSourceForm() {
    this.showAddSourceForm = !this.showAddSourceForm;
    if (!this.showAddSourceForm) {
      this.resetNewSourceForm();
    }
  }

  resetNewSourceForm() {
    this.newSource = {
      name: '',
      protocol: 'ftp',
      host: '',
      port: undefined,
      username: '',
      password: '',
      base_path: '/',
      enabled: true
    };
  }

  addNetworkSource() {
    this.loading = true;
    this.error = null;

    this.networkService.createNetworkSource(this.newSource).subscribe({
      next: () => {
        this.showAddSourceForm = false;
        this.resetNewSourceForm();
        this.loadNetworkSources();
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to create network source';
        this.loading = false;
        console.error('Create network source error:', err);
      }
    });
  }

  deleteNetworkSource(source: NetworkSource) {
    if (!confirm(`Are you sure you want to delete network source "${source.name}"?`)) {
      return;
    }

    this.networkService.deleteNetworkSource(source.id).subscribe({
      next: () => {
        this.loadNetworkSources();
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to delete network source';
        console.error('Delete network source error:', err);
      }
    });
  }

  toggleSourceEnabled(source: NetworkSource) {
    this.networkService.updateNetworkSource(source.id, { enabled: !source.enabled }).subscribe({
      next: () => {
        this.loadNetworkSources();
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update network source';
        console.error('Update network source error:', err);
      }
    });
  }

  testSourceConnection(source: NetworkSource) {
    this.loading = true;
    this.error = null;

    this.networkService.testConnection(source.id).subscribe({
      next: (result) => {
        this.loading = false;
        if (result.success) {
          alert(`Connection successful to ${source.name}!`);
        } else {
          alert(`Connection failed to ${source.name}: ${result.message}`);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Failed to test connection';
        console.error('Test connection error:', err);
      }
    });
  }

  browseSource(source: NetworkSource) {
    this.selectedSource = source;
    this.browserPath = '/';
    this.showBrowser = true;
    this.loadBrowserDirectory();
  }

  loadBrowserDirectory(path: string = this.browserPath) {
    if (!this.selectedSource) return;

    this.loading = true;
    this.error = null;
    this.browserPath = path;

    this.networkService.browseDirectory(this.selectedSource.id, path).subscribe({
      next: (result) => {
        this.browserFiles = result.files;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to browse directory';
        this.loading = false;
        console.error('Browse directory error:', err);
      }
    });
  }

  navigateToDirectory(file: NetworkFile) {
    if (file.isDirectory) {
      this.loadBrowserDirectory(file.path);
    }
  }

  navigateToParentDirectory() {
    const pathParts = this.browserPath.split('/').filter(p => p);
    pathParts.pop();
    const newPath = '/' + pathParts.join('/');
    this.loadBrowserDirectory(newPath);
  }

  closeBrowser() {
    this.showBrowser = false;
    this.selectedSource = null;
    this.browserPath = '/';
    this.browserFiles = [];
  }

  discoverUPnPDevices() {
    this.loading = true;
    this.error = null;

    this.networkService.discoverUPnP(5000).subscribe({
      next: (result) => {
        this.upnpDevices = result.devices;
        this.loading = false;
        if (result.count === 0) {
          alert('No UPnP devices found on the network.');
        } else {
          alert(`Found ${result.count} UPnP device(s)!`);
        }
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to discover UPnP devices';
        this.loading = false;
        console.error('UPnP discovery error:', err);
      }
    });
  }

  getProtocolName(protocol: string): string {
    const names: { [key: string]: string } = {
      ftp: 'FTP',
      smb: 'SMB/CIFS',
      upnp: 'UPnP/DLNA',
      local: 'Local'
    };
    return names[protocol] || protocol.toUpperCase();
  }

  getDefaultPort(protocol: string): number | undefined {
    const ports: { [key: string]: number } = {
      ftp: 21,
      smb: 445
    };
    return ports[protocol];
  }
}
