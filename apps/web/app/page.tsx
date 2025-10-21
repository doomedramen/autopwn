'use client';

import { useState } from 'react';
import { useAuthSession, useNetworks, useDictionaries, useJobs, useUsers } from '@/lib/mock-auth';
import { NetworksTab } from '@/components/networks-tab';
import { DictionariesTab } from '@/components/dictionaries-tab';
import { JobsTab } from '@/components/jobs-tab';
import { UsersTab } from '@/components/users-tab';
import { AdminTab } from '@/components/admin-tab';
import { StatsCards } from '@/components/stats-cards';
import { Button } from '@workspace/ui/components/button';
import { CreateJobModal } from '@/components/create-job-modal';
import { UploadModal } from '@/components/upload-modal';
import {
  Radar,
  BookOpen,
  Package,
  Users,
  Skull,
  Upload,
  Plus,
  Shield
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { AvatarDropdown } from '@/components/avatar-dropdown';

type TabType = 'networks' | 'dictionaries' | 'jobs' | 'users' | 'admin';

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabType>('networks');
  const { data: authData, isLoading, error } = useAuthSession();

  // Fetch data for tab counts
  const { data: networksData } = useNetworks();
  const { data: dictionariesData } = useDictionaries();
  const { data: jobsData } = useJobs();
  const { data: usersData } = useUsers();

  // Get counts for tabs
  const networksCount = networksData?.data?.length || 0;
  const dictionariesCount = dictionariesData?.data?.length || 0;
  const jobsCount = jobsData?.data?.length || 0;
  const usersCount = usersData?.data?.length || 0;

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

  // Check if user is admin
  const isAdmin = authData?.user?.role === 'admin';

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
      case 'admin':
        return <AdminTab />;
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
      case 'admin':
        return <Shield className="h-4 w-4" />;
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
            <div className="flex items-center space-x-2">
              <UploadModal>
                <Button variant="outline" size="sm" className="font-mono text-xs">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </UploadModal>
              <CreateJobModal>
                <Button variant="outline" size="sm" className="font-mono text-xs">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Jobs
                </Button>
              </CreateJobModal>
              <ThemeToggle />
              <AvatarDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsCards />
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'networks', name: 'Networks', count: networksCount },
              { id: 'dictionaries', name: 'Dictionaries', count: dictionariesCount },
              { id: 'jobs', name: 'Jobs', count: jobsCount },
              { id: 'users', name: 'Users', count: usersCount },
              ...(isAdmin ? [{ id: 'admin', name: 'Admin', count: 0 }] : []),
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
                <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
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
