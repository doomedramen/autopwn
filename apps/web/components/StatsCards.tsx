'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface Stats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  cracked: number;
}

export default function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <div className="text-muted-foreground">Loading stats...</div>;

  const cards = [
    { label: 'Total Jobs', value: stats.total, color: 'bg-blue-500' },
    { label: 'Processing', value: stats.processing, color: 'bg-yellow-500' },
    { label: 'Completed', value: stats.completed, color: 'bg-green-500' },
    { label: 'Failed', value: stats.failed, color: 'bg-red-500' },
    { label: 'Cracked', value: stats.cracked, color: 'bg-purple-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-3 sm:p-4">
            <div className={`w-3 h-3 rounded-full ${card.color} mb-2`}></div>
            <div className="text-xl sm:text-2xl font-bold">{card.value}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">{card.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
