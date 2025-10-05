'use client';

import { useEffect, useState } from 'react';
import { Result } from '@autopwn/shared';

export default function ResultsTable() {
  const [results, setResults] = useState<Result[]>([]);

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-100">Cracked Passwords</h2>
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
            {results.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  No passwords cracked yet.
                </td>
              </tr>
            ) : (
              results.map((result) => (
                <tr key={result.id} className="border-b border-gray-800 hover:bg-gray-800/50">
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
    </div>
  );
}
