'use client';

import { useEffect, useState } from 'react';
import { Job } from '@autopwn/shared';

export default function JobQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/jobs');
        if (!res.ok) {
          console.error('Failed to fetch jobs:', res.status);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setJobs(data);
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  // Filter jobs based on search and status
  useEffect(() => {
    let filtered = jobs;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(job =>
        job.filename.toLowerCase().includes(search) ||
        job.id.toString().includes(search)
      );
    }

    setFilteredJobs(filtered);
  }, [jobs, searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-gray-400';
      case 'processing': return 'text-yellow-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-gray-700 text-gray-300',
      processing: 'bg-yellow-900 text-yellow-300',
      completed: 'bg-green-900 text-green-300',
      failed: 'bg-red-900 text-red-300',
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const viewLogs = async (job: Job) => {
    // Fetch fresh job data with logs
    const res = await fetch(`/api/jobs/${job.id}`);
    if (res.ok) {
      const fullJob = await res.json();
      setSelectedJob(fullJob);
      setShowLogs(true);
    }
  };

  const retryJob = async (job: Job) => {
    if (!confirm(`Retry job #${job.id}: ${job.filename}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/jobs/${job.id}/retry`, {
        method: 'POST',
      });

      if (res.ok) {
        // Job will be picked up by worker automatically
        alert('Job has been reset to pending status');
      } else {
        const error = await res.json();
        alert(`Failed to retry job: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to retry job');
    }
  };

  return (
    <>
      {showLogs && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-gray-100">
                Job #{selectedJob.id}: {selectedJob.filename}
              </h3>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <div className="bg-gray-950 rounded p-4 font-mono text-sm text-gray-300 whitespace-pre-wrap">
                {selectedJob.logs || 'No logs available'}
              </div>
            </div>
          </div>
        </div>
      )}
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Job Queue</h2>
          {jobs.length > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Showing {filteredJobs.length} of {jobs.length} jobs
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by filename or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="pb-3 text-gray-400 font-medium">ID</th>
              <th className="pb-3 text-gray-400 font-medium">Filename</th>
              <th className="pb-3 text-gray-400 font-medium">Status</th>
              <th className="pb-3 text-gray-400 font-medium">Dictionary</th>
              <th className="pb-3 text-gray-400 font-medium">Progress</th>
              <th className="pb-3 text-gray-400 font-medium">Speed</th>
              <th className="pb-3 text-gray-400 font-medium">ETA</th>
              <th className="pb-3 text-gray-400 font-medium">Hashes</th>
              <th className="pb-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-500">
                  {jobs.length === 0
                    ? 'No jobs yet. Drop .pcap files in the input folder to get started.'
                    : 'No jobs match your search criteria.'}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 text-gray-300">{job.id}</td>
                  <td className="py-3 text-gray-100 font-mono text-sm">{job.filename}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-400 text-sm">
                    {job.current_dictionary || '-'}
                  </td>
                  <td className="py-3">
                    {job.progress !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-400">{job.progress.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="py-3 text-gray-400 text-sm font-mono">
                    {job.speed || '-'}
                  </td>
                  <td className="py-3 text-gray-400 text-sm">
                    {job.eta || '-'}
                  </td>
                  <td className="py-3 text-gray-300">
                    {job.hash_count || '-'}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => viewLogs(job)}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Logs
                      </button>
                      {job.status === 'failed' && (
                        <button
                          onClick={() => retryJob(job)}
                          className="text-green-400 hover:text-green-300 text-sm"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
