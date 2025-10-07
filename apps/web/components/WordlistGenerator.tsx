'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function WordlistGenerator() {
  const [baseWords, setBaseWords] = useState('');
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSpecialChars, setIncludeSpecialChars] = useState(true);
  const [includeCaps, setIncludeCaps] = useState(true);
  const [includeLeet, setIncludeLeet] = useState(false);
  const [minLength, setMinLength] = useState(8);
  const [maxLength, setMaxLength] = useState(63);
  const [customPattern, setCustomPattern] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ filename: string; count: number } | null>(null);

  const generateWordlist = async () => {
    if (!baseWords.trim()) {
      toast.error('Please enter at least one base word');
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
          includeLeet,
          minLength,
          maxLength,
          customPattern,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(`Failed to generate wordlist: ${error.error}`);
        return;
      }

      const data = await res.json();
      setResult(data);
      toast.success(`Wordlist generated successfully! ${data.count.toLocaleString()} entries created.`);
    } catch (error) {
      toast.error('Failed to generate wordlist');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Wordlist Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="base-words-textarea">Base Words (one per line)</Label>
          <Textarea
            id="base-words-textarea"
            value={baseWords}
            onChange={(e) => setBaseWords(e.target.value)}
            placeholder="password&#10;wifi&#10;network&#10;company"
            rows={6}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Enter common words, company names, locations, etc.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min-length-input">Min Length</Label>
            <Input
              id="min-length-input"
              type="number"
              value={minLength}
              onChange={(e) => setMinLength(parseInt(e.target.value))}
              min={1}
              max={63}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-length-input">Max Length</Label>
            <Input
              id="max-length-input"
              type="number"
              value={maxLength}
              onChange={(e) => setMaxLength(parseInt(e.target.value))}
              min={1}
              max={63}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-numbers-checkbox"
              checked={includeNumbers}
              onCheckedChange={(checked) => setIncludeNumbers(checked as boolean)}
            />
            <Label htmlFor="include-numbers-checkbox" className="text-sm font-normal">
              Append numbers (0-9, 00-99, 123, 2024, etc.)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-special-chars-checkbox"
              checked={includeSpecialChars}
              onCheckedChange={(checked) => setIncludeSpecialChars(checked as boolean)}
            />
            <Label htmlFor="include-special-chars-checkbox" className="text-sm font-normal">
              Append special characters (!@#$%*, etc.)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-caps-checkbox"
              checked={includeCaps}
              onCheckedChange={(checked) => setIncludeCaps(checked as boolean)}
            />
            <Label htmlFor="include-caps-checkbox" className="text-sm font-normal">
              Capitalize variations (Password, PASSWORD, pAssWord)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-leet-checkbox"
              checked={includeLeet}
              onCheckedChange={(checked) => setIncludeLeet(checked as boolean)}
            />
            <Label htmlFor="include-leet-checkbox" className="text-sm font-normal">
              L33t variations (p4ssw0rd, h4ck3r, etc.)
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-pattern-input">Custom Pattern (optional)</Label>
          <Input
            id="custom-pattern-input"
            value={customPattern}
            onChange={(e) => setCustomPattern(e.target.value)}
            placeholder="e.g., {word}{year} or {word}@{number}"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use {'{word}'} for base word, {'{number}'} for digits, {'{year}'} for years
          </p>
        </div>

        <Button
          id="generate-wordlist-button"
          onClick={generateWordlist}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Wordlist'}
        </Button>

        {result && (
          <div id="wordlist-result" className="bg-green-500/10 border border-green-500/20 rounded p-4 text-green-600 dark:text-green-400">
            <p className="font-medium">Wordlist generated successfully!</p>
            <p className="text-sm mt-1">File: {result.filename}</p>
            <p className="text-sm">Total entries: {result.count.toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
