"use client";

import { useEffect, useState } from "react";
import { Job, JobItem, Dictionary } from "@autopwn/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function JobQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedBatchJobs, setExpandedBatchJobs] = useState<Set<number>>(
    new Set()
  );
  const [batchItems, setBatchItems] = useState<Map<number, JobItem[]>>(
    new Map()
  );
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [selectedDictionaries, setSelectedDictionaries] = useState<Set<number>>(
    new Set()
  );
  const [showRetryModal, setShowRetryModal] = useState(false);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) {
          console.error("Failed to fetch jobs:", res.status);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setJobs(data);
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
      }
    };

    const fetchDictionaries = async () => {
      try {
        const res = await fetch("/api/dictionaries");
        if (res.ok) {
          const data = await res.json();
          setDictionaries(data);
        }
      } catch (error) {
        console.error("Error fetching dictionaries:", error);
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
    if (statusFilter !== "all") {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.filename.toLowerCase().includes(search) ||
          job.id.toString().includes(search)
      );
    }

    setFilteredJobs(filtered);
  }, [jobs, searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
    } as const;
    return variants[status as keyof typeof variants] || variants.pending;
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
        method: "POST",
      });

      if (res.ok) {
        // Job will be picked up by worker automatically
        alert("Job has been reset to pending status");
      } else {
        const error = await res.json();
        alert(`Failed to retry job: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to retry job");
    }
  };

  const togglePause = async (job: Job) => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/pause`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Failed to toggle pause: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to toggle pause");
    }
  };

  const setPriority = async (job: Job, priority: number) => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Failed to set priority: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to set priority");
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
            setBatchItems((prev) => new Map(prev).set(jobId, items));
          }
        } catch (error) {
          console.error("Failed to fetch batch items:", error);
        }
      }
    }

    setExpandedBatchJobs(newExpanded);
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
      alert("Please select at least one failed job to retry");
      return;
    }
    setShowRetryModal(true);
  };

  const retrySelectedJobs = async () => {
    if (selectedDictionaries.size === 0) {
      alert("Please select at least one dictionary");
      return;
    }

    try {
      const res = await fetch("/api/jobs/retry-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      alert("Failed to create retry batch");
    }
  };

  return (
    <>
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Job #{selectedJob?.id}: {selectedJob?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            <div className="bg-muted rounded p-4 font-mono text-sm whitespace-pre-wrap">
              {selectedJob?.logs || "No logs available"}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRetryModal} onOpenChange={setShowRetryModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Retry Selected Jobs with Custom Dictionaries
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">
                Selected Jobs ({selectedJobs.size})
              </h4>
              <div className="bg-muted rounded p-3 text-sm">
                {Array.from(selectedJobs).map((jobId) => {
                  const job = jobs.find((j) => j.id === jobId);
                  return job ? (
                    <div key={jobId} className="py-1">
                      Job #{job.id}: {job.filename}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">
                Select Dictionaries
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dictionaries.map((dict) => (
                  <div
                    key={dict.id}
                    className="flex items-center gap-3 p-2 bg-muted rounded hover:bg-muted/80 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedDictionaries.has(dict.id)}
                      onCheckedChange={() => toggleDictionarySelection(dict.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{dict.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(dict.size / 1024 / 1024).toFixed(1)} MB • {dict.path}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {dictionaries.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No dictionaries available
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowRetryModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={retrySelectedJobs}
              disabled={selectedDictionaries.size === 0}
            >
              Create Retry Batch ({selectedJobs.size} jobs,{" "}
              {selectedDictionaries.size} dictionaries)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Job Queue</CardTitle>
              {jobs.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Showing {filteredJobs.length} of {jobs.length} jobs
                  {selectedJobs.size > 0 &&
                    ` • ${selectedJobs.size} failed job(s) selected`}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Input
                type="text"
                placeholder="Search by filename or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-auto"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              {selectedJobs.size > 0 && (
                <Button
                  onClick={openRetryModal}
                  className="w-full sm:w-auto whitespace-nowrap"
                >
                  Retry Selected ({selectedJobs.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pb-3">
                    <Checkbox
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const failedJobIds = filteredJobs
                            .filter((job) => job.status === "failed")
                            .map((job) => job.id);
                          setSelectedJobs(new Set(failedJobIds));
                        } else {
                          setSelectedJobs(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="pb-3">ID</TableHead>
                  <TableHead className="pb-3">Filename</TableHead>
                  <TableHead className="pb-3">Status</TableHead>
                  <TableHead className="pb-3">Priority</TableHead>
                  <TableHead className="pb-3">Dictionary</TableHead>
                  <TableHead className="pb-3">Progress</TableHead>
                  <TableHead className="pb-3">Speed</TableHead>
                  <TableHead className="pb-3">ETA</TableHead>
                  <TableHead className="pb-3">Hashes</TableHead>
                  <TableHead className="pb-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {jobs.length === 0
                        ? "No jobs yet. Drop .pcap files in the input folder to get started."
                        : "No jobs match your search criteria."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <>
                      <TableRow key={job.id} className="hover:bg-muted/50">
                        <TableCell className="py-3">
                          {job.status === "failed" && (
                            <Checkbox
                              checked={selectedJobs.has(job.id)}
                              onCheckedChange={() => toggleJobSelection(job.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {job.batch_mode === 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBatchExpansion(job.id)}
                              className="mr-2 h-auto p-0"
                            >
                              {expandedBatchJobs.has(job.id) ? "▼" : "▶"}
                            </Button>
                          )}
                          {job.id}
                        </TableCell>
                        <TableCell className="py-3 font-mono text-sm">
                          {job.batch_mode === 1 ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">BATCH</Badge>
                              <span>{job.items_total} files</span>
                            </div>
                          ) : (
                            job.filename
                          )}
                          {job.paused === 1 && (
                            <Badge variant="outline" className="ml-2">
                              Paused
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant={getStatusBadge(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <Select
                            value={job.priority.toString()}
                            onValueChange={(value) =>
                              setPriority(job, parseInt(value))
                            }
                            disabled={
                              job.status === "completed" ||
                              job.status === "processing"
                            }
                          >
                            <SelectTrigger className="w-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Normal</SelectItem>
                              <SelectItem value="1">High</SelectItem>
                              <SelectItem value="2">Urgent</SelectItem>
                              <SelectItem value="-1">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {job.current_dictionary || "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          {job.batch_mode === 1 && job.items_total ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs">
                                {job.items_cracked || 0}/{job.items_total}{" "}
                                cracked
                              </span>
                            </div>
                          ) : job.progress !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${job.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs">
                                {job.progress.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 font-mono text-sm">
                          {job.speed || "-"}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {job.eta || "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          {job.hash_count || "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => viewLogs(job)}
                              className="h-auto p-0"
                            >
                              Logs
                            </Button>
                            {(job.status === "pending" ||
                              job.status === "processing") && (
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => togglePause(job)}
                                className="h-auto p-0"
                              >
                                {job.paused === 1 ? "Resume" : "Pause"}
                              </Button>
                            )}
                            {job.status === "failed" && (
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => retryJob(job)}
                                className="h-auto p-0"
                              >
                                Retry
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded batch items */}
                      {job.batch_mode === 1 &&
                        expandedBatchJobs.has(job.id) && (
                          <TableRow
                            key={`${job.id}-items`}
                            className="bg-muted/30"
                          >
                            <TableCell colSpan={11} className="py-4 px-6">
                              <div className="ml-8">
                                <h4 className="text-sm font-semibold mb-3">
                                  Batch Items (
                                  {batchItems.get(job.id)?.length || 0} files)
                                </h4>
                                {batchItems.get(job.id) ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="pb-2">
                                          Filename
                                        </TableHead>
                                        <TableHead className="pb-2">
                                          ESSID
                                        </TableHead>
                                        <TableHead className="pb-2">
                                          BSSID
                                        </TableHead>
                                        <TableHead className="pb-2">
                                          Status
                                        </TableHead>
                                        <TableHead className="pb-2">
                                          Password
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {batchItems.get(job.id)!.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="py-2 font-mono">
                                            {item.filename}
                                          </TableCell>
                                          <TableCell className="py-2">
                                            {item.essid || "-"}
                                          </TableCell>
                                          <TableCell className="py-2 font-mono text-xs">
                                            {item.bssid || "-"}
                                          </TableCell>
                                          <TableCell className="py-2">
                                            <Badge
                                              variant={getStatusBadge(
                                                item.status
                                              )}
                                            >
                                              {item.status}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="py-2 font-mono">
                                            {item.password || "-"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <p className="text-muted-foreground">
                                    Loading items...
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
