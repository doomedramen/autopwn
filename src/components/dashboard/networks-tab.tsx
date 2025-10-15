'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemTitle,
  ItemDescription,
} from '@/components/ui/item';
import {
  Wifi,
  Upload,
  Inbox,
  Key,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { EmptyState, CardGridSkeleton } from '@/components/loading';
import { useNetworkPasswords } from '@/hooks/useNetworkPasswords';
import type { NetworkInfo } from '@/types';

interface NetworksTabProps {
  networks: NetworkInfo[];
  isInitialLoad: boolean;
  onUploadClick: () => void;
}

// Component to display cracked passwords for a network
function NetworkPasswords({ networkId }: { networkId: string }) {
  const { passwords, isLoading, error } = useNetworkPasswords(networkId);

  if (isLoading) {
    return (
      <div className="mt-2 pt-2 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-3 animate-spin" />
          Loading passwords...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-2 pt-2 border-t">
        <div className="text-sm text-destructive">
          Failed to load passwords: {error}
        </div>
      </div>
    );
  }

  if (passwords.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 pt-2 border-t">
      <div className="space-y-1">
        {passwords.map(password => (
          <div key={password.id} className="flex items-center gap-2 text-sm">
            <Key className="size-3 text-green-600" />
            <span className="font-mono text-green-600 font-medium">
              {password.plainPassword}
            </span>
            <span className="text-muted-foreground">
              cracked by{' '}
              <span className="font-medium">{password.job.name}</span>
            </span>
            <span className="text-muted-foreground">
              {new Date(password.crackedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NetworkItem({ network }: { network: NetworkInfo }) {
  const [showPasswords, setShowPasswords] = useState(false);

  return (
    <Item variant="outline">
      <ItemMedia variant="icon" className="!self-center !translate-y-0">
        <Wifi className="size-4" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{network.essid || 'Unknown Network'}</ItemTitle>
        <ItemDescription>
          {network.bssid} • {network.encryption}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <div className="flex items-center gap-2">
          {network.hasHandshake ? (
            <Badge variant="default">Handshake Available</Badge>
          ) : (
            <Badge variant="outline">No Handshake</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPasswords(!showPasswords)}
            className="h-6 px-2"
          >
            <Key className="size-3 mr-1" />
            Passwords
            {showPasswords ? (
              <ChevronUp className="size-3 ml-1" />
            ) : (
              <ChevronDown className="size-3 ml-1" />
            )}
          </Button>
        </div>
      </ItemActions>
      {showPasswords && <NetworkPasswords networkId={network.id} />}
    </Item>
  );
}

export function NetworksTab({
  networks,
  isInitialLoad,
  onUploadClick,
}: NetworksTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Discovered Networks</CardTitle>
        <CardDescription>
          All WiFi networks discovered from uploaded PCAP files
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isInitialLoad ? (
          <CardGridSkeleton count={6} />
        ) : networks.length > 0 ? (
          <ItemGroup className="gap-3">
            {networks.map(network => (
              <NetworkItem key={network.id} network={network} />
            ))}
          </ItemGroup>
        ) : (
          <EmptyState
            title="No networks found"
            description="Upload PCAP files to discover WiFi networks and extract handshakes for password cracking."
            icon={<Inbox className="h-12 w-12" />}
            action={
              <Button onClick={onUploadClick}>
                <Upload className="h-4 w-4 mr-2" />
                Upload PCAP Files
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
