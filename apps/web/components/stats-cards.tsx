'use client';

import { useNetworks, useDictionaries, useJobs, useUsers } from '@/lib/api-hooks';
import { Radar, BookOpen, Package, Users } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  isLoading?: boolean;
}

function StatCard({ title, value, subtitle, icon, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
            <div className="h-8 bg-muted rounded w-16 animate-pulse"></div>
            <div className="h-3 bg-muted rounded w-24 animate-pulse"></div>
          </div>
          <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground font-mono uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl font-bold font-mono">
            {value}
          </p>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatsCards() {
  const { data: networksData, isLoading: networksLoading } = useNetworks();
  const { data: dictionariesData, isLoading: dictionariesLoading } = useDictionaries();
  const { data: jobsData, isLoading: jobsLoading } = useJobs();
  const { data: usersData, isLoading: usersLoading } = useUsers();

  // Calculate stats
  const networks = networksData?.data || [];
  const networksWithHandshakes = networks.filter(n => n.key).length;
  const dictionaries = dictionariesData?.data || [];
  const totalWords = dictionaries.reduce((sum, dict) => sum + (dict.wordCount || 0), 0);
  const jobs = jobsData?.data || [];
  const activeJobs = jobs.filter(job => job.status === 'running').length;
  const completedJobs = jobs.filter(job => job.status === 'completed').length;
  const totalJobs = jobs.length;
  const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  // Format word count
  const formatWordCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}m`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const isLoading = networksLoading || dictionariesLoading || jobsLoading || usersLoading;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Networks"
        value={networks.length}
        subtitle={`${networksWithHandshakes} with handshakes`}
        icon={<Radar className="h-6 w-6" />}
        isLoading={networksLoading}
      />
      <StatCard
        title="Dictionaries"
        value={dictionaries.length}
        subtitle={`${formatWordCount(totalWords)} words`}
        icon={<BookOpen className="h-6 w-6" />}
        isLoading={dictionariesLoading}
      />
      <StatCard
        title="Active Jobs"
        value={activeJobs}
        subtitle={`${completedJobs} completed`}
        icon={<Package className="h-6 w-6" />}
        isLoading={jobsLoading}
      />
      <StatCard
        title="Success Rate"
        value={`${successRate}%`}
        subtitle={`${completedJobs} of ${totalJobs} jobs`}
        icon={<Users className="h-6 w-6" />}
        isLoading={jobsLoading}
      />
    </div>
  );
}