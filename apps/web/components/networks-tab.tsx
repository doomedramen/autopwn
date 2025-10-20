'use client';

import { useState } from 'react';
import { useNetworks } from '@/lib/mock-api-hooks';
import { formatDate, getStatusColor, getEncryptionColor } from '@/lib/utils';
import { Button } from '@workspace/ui/components/button';
import {
  Wifi,
  WifiOff,
  Shield,
  ShieldOff,
  Lock,
  Unlock,
  Signal,
  Upload,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Radar,
  Activity
} from 'lucide-react';

interface NetworksTabProps {
  className?: string;
}

export function NetworksTab({ className }: NetworksTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: networksData, isLoading, error, refetch } = useNetworks({
    ssid: searchTerm || undefined,
    sortBy: 'captureDate',
    sortOrder: 'desc',
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4" />;
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <div className={className}>
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <h3 className="text-destructive font-medium mb-2">
            Error Loading Networks
          </h3>
          <p className="text-muted-foreground mb-4">
            Failed to load networks. Please try again.
          </p>
          <Button onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-start font-mono">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="scan networks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-background font-mono text-sm"
            />
          </div>
          <Button variant="outline" disabled className="font-mono text-sm">
            <Upload className="h-4 w-4 mr-2" />
            upload pcap
          </Button>
        </div>
      </div>

      {/* Networks List */}
      <div className="bg-card rounded-lg shadow font-mono">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : networksData?.data.length === 0 ? (
          <div className="text-center py-12 font-mono px-6">
            <Radar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              no networks found
            </h3>
            <p className="text-muted-foreground mb-4">
              upload pcap files to start scanning networks
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden m-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      SSID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      BSSID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Encryption
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Capture Date
                    </th>
                  </tr>
                </thead>
            <tbody className="bg-card divide-y">
              {networksData?.data.map((network) => (
                <tr key={network.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {network.ssid || '<Hidden>'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-muted-foreground">
                    {network.bssid}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEncryptionColor(network.encryption)}`}>
                      {network.encryption}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center gap-1 ${getStatusColor(network.status)}`}>
                      {getStatusIcon(network.status)}
                      <span className="font-mono text-xs uppercase">{network.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(network.captureDate)}
                  </td>
                </tr>
              ))}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}