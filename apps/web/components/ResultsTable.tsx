'use client';

import { useEffect, useState } from 'react';
import { Result } from '@autopwn/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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
      result.pcap_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      ['ID', 'ESSID', 'Password', 'Source PCAP', 'Cracked At'].join(','),
      ...filteredResults.map(r => [
        r.id,
        r.essid || '',
        r.password || '',
        r.pcap_filename || '',
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
    <>
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Password Details</DialogTitle>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p className="font-mono">{selectedResult.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">ESSID</p>
                <p className="font-semibold text-green-600 dark:text-green-400">{selectedResult.essid}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Password</p>
                <p className="font-mono text-lg text-purple-600 dark:text-purple-400">{selectedResult.password}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Source PCAP File</p>
                <p className="font-mono text-sm text-blue-600 dark:text-blue-400">{selectedResult.pcap_filename || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cracked At</p>
                <p>{new Date(selectedResult.cracked_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Job ID</p>
                <p>{selectedResult.job_id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Cracked Passwords</CardTitle>
            {filteredResults.length > 0 && (
              <Button onClick={exportResults} variant="outline">
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Input
              type="search"
              placeholder="Search by ESSID, password, PCAP file, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={filterEssid} onValueChange={setFilterEssid}>
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="Filter by network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                {uniqueEssids.map(essid => (
                  <SelectItem key={essid} value={essid}>{essid}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          {filteredResults.length !== results.length && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredResults.length} of {results.length} results
            </p>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pb-3">ID</TableHead>
                  <TableHead className="pb-3">ESSID</TableHead>
                  <TableHead className="pb-3">Password</TableHead>
                  <TableHead className="pb-3">Source PCAP</TableHead>
                  <TableHead className="pb-3">Cracked At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {results.length === 0 ? 'No passwords cracked yet.' : 'No results match your search.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedResults.map((result) => (
                    <TableRow
                      key={result.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedResult(result)}
                    >
                      <TableCell className="py-3">{result.id}</TableCell>
                      <TableCell className="py-3">
                        <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                          {result.essid}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 font-mono text-purple-600 dark:text-purple-400">
                        {result.password}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                          {result.pcap_filename || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {new Date(result.cracked_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
