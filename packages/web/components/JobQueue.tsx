'use client';

import { useEffect, useState } from 'react';
import { Job, JobItem, Dictionary } from '@autopwn/shared';

export default function JobQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedBatchJobs, setExpandedBatchJobs] = useState<Set<number>>(new Set());
  const [batchItems, setBatchItems] = useState<Map<number, JobItem[]>>(new Map());
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [selectedDictionaries, setSelectedDictionaries] = useState<Set<number>>(new Set());
  const [showRetryModal, setShowRetryModal] = useState(false);

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

    const fetchDictionaries = async () => {
      try {
        const res = await fetch('/api/dictionaries');
        if (res.ok) {
          const data = await res.json();
          setDictionaries(data);
        }
      } catch (error) {
        console.error('Error fetching dictionaries:', error);
      }
    };

    fetchJobs();
    fetchDictionaries();
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

  const togglePause = async (job: Job) => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/pause`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Failed to toggle pause: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to toggle pause');
    }
  };

  const setPriority = async (job: Job, priority: number) => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Failed to set priority: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to set priority');
    }
  };

  const toggleBatchExpansion = async (jobId: number) => {
    const newExpanded = new Set(expandedBatchJobs);

    if (newExpanded.has(jobId)) {
      // Collapse
      newExpanded.delete(jobId);
    } else {
      // Expand - fetch items if not already loaded
      newExpanded.add(jobId);

      if (!batchItems.has(jobId)) {
        try {
          const res = await fetch(`/api/jobs/${jobId}/items`);
          if (res.ok) {
            const items = await res.json();
            setBatchItems(prev => new Map(prev).set(jobId, items));
          }
        } catch (error) {
          console.error('Failed to fetch batch items:', error);
        }
      }
    }

    setExpandedBatchJobs(newExpanded);
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'processing': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const toggleJobSelection = (jobId: number) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const toggleDictionarySelection = (dictId: number) => {
    const newSelected = new Set(selectedDictionaries);
    if (newSelected.has(dictId)) {
      newSelected.delete(dictId);
    } else {
      newSelected.add(dictId);
    }
    setSelectedDictionaries(newSelected);
  };

  const openRetryModal = () => {
    if (selectedJobs.size === 0) {
      alert('Please select at least one failed job to retry');
      return;
    }
    setShowRetryModal(true);
  };

  const retrySelectedJobs = async () => {
    if (selectedDictionaries.size === 0) {
      alert('Please select at least one dictionary');
      return;
    }

    try {
      const res = await fetch('/api/jobs/retry-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobIds: Array.from(selectedJobs),
          dictionaryIds: Array.from(selectedDictionaries),
        }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Retry batch job created successfully! ${result.message}`);
        setShowRetryModal(false);
        setSelectedJobs(new Set());
        setSelectedDictionaries(new Set());
      } else {
        const error = await res.json();
        alert(`Failed to create retry batch: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to create retry batch');
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
      {showRetryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-labelledby="retry-modal-title" className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 id="retry-modal-title" className="text-lg font-bold text-gray-100">
                Retry Selected Jobs with Custom Dictionaries
              </h3>
              <button
                onClick={() => setShowRetryModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">
                  Selected Jobs ({selectedJobs.size})
                </h4>
                <div className="bg-gray-800 rounded p-3 text-sm text-gray-400">
                  {Array.from(selectedJobs).map(jobId => {
                    const job = jobs.find(j => j.id === jobId);
                    return job ? (
                      <div key={jobId} className="py-1">
                        Job #{job.id}: {job.filename}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">
                  Select Dictionaries
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dictionaries.map(dict => (
                    <label
                      key={dict.id}
                      className="flex items-center gap-3 p-2 bg-gray-800 rounded hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDictionaries.has(dict.id)}
                        onChange={() => toggleDictionarySelection(dict.id)}
                        className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <div className="text-gray-200 font-medium">{dict.name}</div>
                        <div className="text-gray-400 text-xs">
                          {(dict.size / 1024 / 1024).toFixed(1)} MB • {dict.path}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {dictionaries.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    No dictionaries available
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
              <button
                onClick={() => setShowRetryModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={retrySelectedJobs}
                disabled={selectedDictionaries.size === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
              >
                Create Retry Batch ({selectedJobs.size} jobs, {selectedDictionaries.size} dictionaries)
              </button>
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
                {selectedJobs.size > 0 && ` • ${selectedJobs.size} failed job(s) selected`}
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
            {selectedJobs.size > 0 && (
              <button
                onClick={openRetryModal}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
              >
                Retry Selected ({selectedJobs.size})
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="pb-3 text-gray-400 font-medium">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        const failedJobIds = filteredJobs
                          .filter(job => job.status === 'failed')
                          .map(job => job.id);
                        setSelectedJobs(new Set(failedJobIds));
                      } else {
                        setSelectedJobs(new Set());
                      }
                    }}
                    className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                </th>
                <th className="pb-3 text-gray-400 font-medium">ID</th>
                <th className="pb-3 text-gray-400 font-medium">Filename</th>
                <th className="pb-3 text-gray-400 font-medium">Status</th>
                <th className="pb-3 text-gray-400 font-medium">Priority</th>
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
                  <td colSpan={11} className="py-8 text-center text-gray-500">
                    {jobs.length === 0
                      ? 'No jobs yet. Drop .pcap files in the input folder to get started.'
                      : 'No jobs match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <>
                    <tr key={job.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-3">
                        {job.status === 'failed' && (
                          <input
                            type="checkbox"
                            checked={selectedJobs.has(job.id)}
                            onChange={() => toggleJobSelection(job.id)}
                            className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                          />
                        )}
                      </td>
                      <td className="py-3 text-gray-300">
                        {job.batch_mode === 1 && (
                          <button
                            onClick={() => toggleBatchExpansion(job.id)}
                            className="mr-2 text-gray-400 hover:text-gray-200"
                          >
                            {expandedBatchJobs.has(job.id) ? '▼' : '▶'}
                          </button>
                        )}
                        {job.id}
                      </td>
                      <td className="py-3 text-gray-100 font-mono text-sm">
                        {job.batch_mode === 1 ? (
                          <span className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded">
                              BATCH
                            </span>
                            <span>{job.items_total} files</span>
                          </span>
                        ) : (
                          job.filename
                        )}
                        {job.paused === 1 && (
                          <span className="ml-2 text-xs text-yellow-400">(Paused)</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <select
                          value={job.priority}
                          onChange={(e) => setPriority(job, parseInt(e.target.value))}
                          disabled={job.status === 'completed' || job.status === 'processing'}
                          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 disabled:opacity-50"
                        >
                          <option value={0}>Normal</option>
                          <option value={1}>High</option>
                          <option value={2}>Urgent</option>
                          <option value={-1}>Low</option>
                        </select>
                      </td>
                      <td className="py-3 text-gray-400 text-sm">
                        {job.current_dictionary || '-'}
                      </td>
                      <td className="py-3">
                        {job.batch_mode === 1 && job.items_total ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              {job.items_cracked || 0}/{job.items_total} cracked
                            </span>
                          </div>
                        ) : job.progress !== null ? (
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
                          {(job.status === 'pending' || job.status === 'processing') && (
                            <button
                              onClick={() => togglePause(job)}
                              className="text-yellow-400 hover:text-yellow-300 text-sm"
                            >
                              {job.paused === 1 ? 'Resume' : 'Pause'}
                            </button>
                          )}
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
                    {/* Expanded batch items */}
                    {job.batch_mode === 1 && expandedBatchJobs.has(job.id) && (
                      <tr key={`${job.id}-items`} className="bg-gray-800/30">
                        <td colSpan={11} className="py-4 px-6">
                          <div className="ml-8">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">
                              Batch Items ({batchItems.get(job.id)?.length || 0} files)
                            </h4>
                            {batchItems.get(job.id) ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-700">
                                    <th className="pb-2 text-left text-gray-400 font-medium">Filename</th>
                                    <th className="pb-2 text-left text-gray-400 font-medium">ESSID</th>
                                    <th className="pb-2 text-left text-gray-400 font-medium">BSSID</th>
                                    <th className="pb-2 text-left text-gray-400 font-medium">Status</th>
                                    <th className="pb-2 text-left text-gray-400 font-medium">Password</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batchItems.get(job.id)!.map((item) => (
                                    <tr key={item.id} className="border-b border-gray-700/50">
                                      <td className="py-2 text-gray-300 font-mono">{item.filename}</td>
                                      <td className="py-2 text-gray-300">{item.essid || '-'}</td>
                                      <td className="py-2 text-gray-400 font-mono text-xs">
                                        {item.bssid || '-'}
                                      </td>
                                      <td className="py-2">
                                        <span className={getItemStatusColor(item.status)}>
                                          {item.status}
                                        </span>
                                      </td>
                                      <td className="py-2 text-green-400 font-mono">
                                        {item.password || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-gray-500">Loading items...</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
