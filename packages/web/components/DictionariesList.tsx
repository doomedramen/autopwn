'use client';

import { useEffect, useState } from 'react';
import { Dictionary } from '@autopwn/shared';

export default function DictionariesList() {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);

  useEffect(() => {
    const fetchDictionaries = async () => {
      const res = await fetch('/api/dictionaries');
      const data = await res.json();
      setDictionaries(data);
    };

    fetchDictionaries();
    const interval = setInterval(fetchDictionaries, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-100">Dictionaries</h2>
      <div className="space-y-2">
        {dictionaries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No dictionaries found. Add wordlists to the dictionaries folder.
          </p>
        ) : (
          dictionaries.map((dict) => (
            <div
              key={dict.id}
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded hover:bg-gray-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-gray-100 font-mono text-sm">{dict.name}</span>
              </div>
              <span className="text-gray-400 text-sm">{formatFileSize(dict.size)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
