'use client';

import { useEffect, useState } from 'react';
import { Result } from '@autopwn/shared';

export default function ResultsTable() {
  const [results, setResults] = useState<Result[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEssid, setFilterEssid] = useState<string>('all');
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;

  useEffect(() => {
    const fetchResults = async () => {
      const res = await fetch('/api/results');
      const data = await res.json();
      setResults(data);
    };

    fetchResults();
    const interval = setInterval(fetchResults, 3000);
    return () => clearInterval(interval);
  }, []);

  // Get unique ESSIDs for filter dropdown
  const uniqueEssids = Array.from(new Set(results.map(r => r.essid).filter(Boolean)));

  // Filter results
  const filteredResults = results.filter(result => {
    const matchesSearch = searchTerm === '' ||
      result.essid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.password?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.id.toString().includes(searchTerm);

    const matchesFilter = filterEssid === 'all' || result.essid === filterEssid;

    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterEssid]);

  const exportResults = () => {
    const csv = [
      ['ID', 'ESSID', 'Password', 'Cracked At'].join(','),
      ...filteredResults.map(r => [
        r.id,
        r.essid || '',
        r.password || '',
        new Date(r.cracked_at).toISOString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autopwn-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-100">Cracked Passwords</h2>
        {filteredResults.length > 0 && (
          <button
            onClick={exportResults}
            className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
            aria-label="Export results to CSV"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <input
          type="search"
          placeholder="Search by ESSID, password, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
          aria-label="Search results"
        />
        <select
          value={filterEssid}
          onChange={(e) => setFilterEssid(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-blue-500 text-sm"
          aria-label="filter by ESSID"
        >
          <option value="all">All Networks</option>
          {uniqueEssids.map(essid => (
            <option key={essid} value={essid}>{essid}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {filteredResults.length !== results.length && (
        <p className="text-sm text-gray-400 mb-3">
          Showing {filteredResults.length} of {results.length} results
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="pb-3 text-gray-400 font-medium">ID</th>
              <th className="pb-3 text-gray-400 font-medium">ESSID</th>
              <th className="pb-3 text-gray-400 font-medium">Password</th>
              <th className="pb-3 text-gray-400 font-medium">Cracked At</th>
            </tr>
          </thead>
          <tbody>
            {paginatedResults.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  {results.length === 0 ? 'No passwords cracked yet.' : 'No results match your search.'}
                </td>
              </tr>
            ) : (
              paginatedResults.map((result) => (
                <tr
                  key={result.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => setSelectedResult(result)}
                >
                  <td className="py-3 text-gray-300">{result.id}</td>
                  <td className="py-3 text-green-400 font-semibold">{result.essid}</td>
                  <td className="py-3 text-purple-400 font-mono">{result.password}</td>
                  <td className="py-3 text-gray-400 text-sm">
                    {new Date(result.cracked_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
          <p className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded text-sm transition-colors"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded text-sm transition-colors"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedResult(null)}>
          <div
            role="dialog"
            aria-labelledby="result-detail-title"
            className="bg-gray-900 border border-gray-800 rounded-lg max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="result-detail-title" className="text-lg font-bold text-gray-100">
                Password Details
              </h3>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">ID</label>
                <p className="text-gray-100 font-mono">{selectedResult.id}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">ESSID</label>
                <p className="text-green-400 font-semibold">{selectedResult.essid}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Password</label>
                <p className="text-purple-400 font-mono text-lg">{selectedResult.password}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Cracked At</label>
                <p className="text-gray-100">{new Date(selectedResult.cracked_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Job ID</label>
                <p className="text-gray-100">{selectedResult.job_id}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
