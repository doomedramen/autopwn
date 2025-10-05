'use client';

import { useState } from 'react';

export default function WordlistGenerator() {
  const [baseWords, setBaseWords] = useState('');
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSpecialChars, setIncludeSpecialChars] = useState(true);
  const [includeCaps, setIncludeCaps] = useState(true);
  const [minLength, setMinLength] = useState(8);
  const [maxLength, setMaxLength] = useState(63);
  const [customPattern, setCustomPattern] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ filename: string; count: number } | null>(null);

  const generateWordlist = async () => {
    if (!baseWords.trim()) {
      alert('Please enter at least one base word');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch('/api/wordlist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseWords: baseWords.split('\n').filter(w => w.trim()),
          includeNumbers,
          includeSpecialChars,
          includeCaps,
          minLength,
          maxLength,
          customPattern,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Failed to generate wordlist: ${error.error}`);
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch (error) {
      alert('Failed to generate wordlist');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-100 mb-4">Custom Wordlist Generator</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Base Words (one per line)
          </label>
          <textarea
            value={baseWords}
            onChange={(e) => setBaseWords(e.target.value)}
            placeholder="password&#10;wifi&#10;network&#10;company"
            rows={6}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter common words, company names, locations, etc.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Min Length
            </label>
            <input
              type="number"
              value={minLength}
              onChange={(e) => setMinLength(parseInt(e.target.value))}
              min={1}
              max={63}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Length
            </label>
            <input
              type="number"
              value={maxLength}
              onChange={(e) => setMaxLength(parseInt(e.target.value))}
              min={1}
              max={63}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              className="w-4 h-4 bg-gray-800 border-gray-700 rounded"
            />
            Append numbers (0-9, 00-99, 123, 2024, etc.)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={includeSpecialChars}
              onChange={(e) => setIncludeSpecialChars(e.target.checked)}
              className="w-4 h-4 bg-gray-800 border-gray-700 rounded"
            />
            Append special characters (!@#$%*, etc.)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={includeCaps}
              onChange={(e) => setIncludeCaps(e.target.checked)}
              className="w-4 h-4 bg-gray-800 border-gray-700 rounded"
            />
            Capitalize variations (Password, PASSWORD, pAssWord)
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Custom Pattern (optional)
          </label>
          <input
            type="text"
            value={customPattern}
            onChange={(e) => setCustomPattern(e.target.value)}
            placeholder="e.g., {word}{year} or {word}@{number}"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {'{word}'} for base word, {'{number}'} for digits, {'{year}'} for years
          </p>
        </div>

        <button
          onClick={generateWordlist}
          disabled={isGenerating}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium transition-colors"
        >
          {isGenerating ? 'Generating...' : 'Generate Wordlist'}
        </button>

        {result && (
          <div className="bg-green-900/20 border border-green-700 rounded p-4 text-green-300">
            <p className="font-medium">Wordlist generated successfully!</p>
            <p className="text-sm mt-1">File: {result.filename}</p>
            <p className="text-sm">Total entries: {result.count.toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
