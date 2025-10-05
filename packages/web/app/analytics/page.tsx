'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  jobsOverTime: { date: string; count: number }[];
  cracksOverTime: { date: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
  dictionaryEffectiveness: { name: string; cracks: number }[];
  avgCompletionTime: number;
  successRate: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#eab308',
  processing: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const res = await fetch('/api/analytics');
      const analyticsData = await res.json();
      setData(analyticsData);
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return <div className="text-gray-400">Loading analytics...</div>;
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-green-400">Analytics Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h3 className="text-sm text-gray-400 mb-2">Success Rate</h3>
          <div className="text-2xl sm:text-3xl font-bold text-green-400">
            {data.successRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h3 className="text-sm text-gray-400 mb-2">Avg Completion Time</h3>
          <div className="text-2xl sm:text-3xl font-bold text-blue-400">
            {formatTime(data.avgCompletionTime)}
          </div>
        </div>
      </div>

      {/* Jobs Over Time */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-100 mb-4">Jobs Created (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data.jobsOverTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Jobs" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cracks Over Time */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-100 mb-4">Successful Cracks (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data.cracksOverTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="count" stroke="#22c55e" name="Cracks" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Status Distribution and Dictionary Effectiveness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Status Distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-100 mb-4">Job Status Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.statusDistribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.status}: ${entry.count}`}
              >
                {data.statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Dictionary Effectiveness */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-100 mb-4">Top Dictionaries</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.dictionaryEffectiveness}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="cracks" fill="#a855f7" name="Cracks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
