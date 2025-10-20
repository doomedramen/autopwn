'use client';

import { useState } from 'react';
import { useAuthSession } from '@/lib/mock-api-hooks';
import { NetworksTab } from '@/components/networks-tab';
import { DictionariesTab } from '@/components/dictionaries-tab';
import { JobsTab } from '@/components/jobs-tab';
import { UsersTab } from '@/components/users-tab';
import {
  Radar,
  BookOpen,
  Package,
  Users,
  Skull
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { AvatarDropdown } from '@/components/avatar-dropdown';

type TabType = 'networks' | 'dictionaries' | 'jobs' | 'users';

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabType>('networks');
  const { data: authData, isLoading, error } = useAuthSession();

  if (error && !isLoading) {
    // Redirect to login if not authenticated
    window.location.href = '/login';
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-mono">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">authenticating...</p>
        </div>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'networks':
        return <NetworksTab />;
      case 'dictionaries':
        return <DictionariesTab />;
      case 'jobs':
        return <JobsTab />;
      case 'users':
        return <UsersTab />;
      default:
        return <NetworksTab />;
    }
  };

  const getTabIcon = (tabId: string) => {
    switch (tabId) {
      case 'networks':
        return <Radar className="h-4 w-4" />;
      case 'dictionaries':
        return <BookOpen className="h-4 w-4" />;
      case 'jobs':
        return <Package className="h-4 w-4" />;
      case 'users':
        return <Users className="h-4 w-4" />;
      default:
        return <Radar className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with default shadcn colors */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skull className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-mono font-bold uppercase tracking-wider">
                  AutoPWN
                </h1>
                <p className="text-xs text-muted-foreground font-mono">
                  Network Security Platform
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <AvatarDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'networks', name: 'Networks' },
              { id: 'dictionaries', name: 'Dictionaries' },
              { id: 'jobs', name: 'Jobs' },
              { id: 'users', name: 'Users' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm font-mono uppercase tracking-wider flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                {getTabIcon(tab.id)}
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {renderActiveTab()}
        </div>
      </main>
    </div>
  );
}
