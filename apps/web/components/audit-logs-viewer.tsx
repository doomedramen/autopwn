"use client";

import { useState } from "react";
import { useAuditLogs, useCleanupAuditLogs } from "@/lib/api-hooks";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  FileText,
  Filter,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface AuditLogsViewerProps {
  className?: string;
}

export function AuditLogsViewer({ className }: AuditLogsViewerProps) {
  const [filters, setFilters] = useState<{
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    success?: boolean;
    page: number;
    limit: number;
  }>({
    page: 1,
    limit: 50,
  });

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(90);

  const { data: auditData, isLoading, refetch } = useAuditLogs(filters);
  const cleanupLogs = useCleanupAuditLogs();

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
  };

  const handleExportCSV = async () => {
    try {
      const exportUrl = `/api/v1/audit/export?${new URLSearchParams(filters as any).toString()}`;
      const link = document.createElement("a");
      link.href = exportUrl;
      link.download = `audit-logs-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Audit logs exported to CSV");
    } catch (error: any) {
      toast.error(error?.message || "Failed to export audit logs");
    }
  };

  const handleExportJSON = async () => {
    try {
      const exportUrl = `/api/v1/audit/export/json?${new URLSearchParams(filters as any).toString()}`;
      const link = document.createElement("a");
      link.href = exportUrl;
      link.download = `audit-logs-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Audit logs exported to JSON");
    } catch (error: any) {
      toast.error(error?.message || "Failed to export audit logs");
    }
  };

  const handleCleanup = async () => {
    try {
      await cleanupLogs.mutateAsync({ olderThanDays: cleanupDays });
      toast.success(`Deleted audit logs older than ${cleanupDays} days`);
      setIsCleanupOpen(false);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cleanup audit logs");
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const pagination = auditData?.pagination || {
    page: 1,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-lg font-semibold uppercase">Audit Logs</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="font-mono"
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            className="font-mono"
          >
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
          <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="font-mono">
                <Trash2 className="h-4 w-4 mr-2" />
                Cleanup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-mono uppercase">
                  Cleanup Old Audit Logs
                </DialogTitle>
                <DialogDescription className="font-mono text-sm">
                  Delete audit logs older than specified number of days. This
                  action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="cleanupDays" className="font-mono text-sm">
                    Delete logs older than (days)
                  </Label>
                  <Input
                    id="cleanupDays"
                    type="number"
                    value={cleanupDays}
                    onChange={(e) => setCleanupDays(Number(e.target.value))}
                    className="font-mono"
                    min="1"
                    max="365"
                  />
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground font-mono">
                      Warning: This will permanently delete all audit logs older
                      than {cleanupDays} days.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCleanupOpen(false)}
                  className="font-mono"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCleanup}
                  disabled={cleanupLogs.isPending}
                  className="font-mono"
                >
                  {cleanupLogs.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Logs"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5" />
          <h3 className="text-base font-semibold font-mono uppercase">
            Filters
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="grid gap-2">
            <Label htmlFor="userId" className="font-mono text-sm">
              User ID
            </Label>
            <Input
              id="userId"
              type="text"
              value={filters.userId || ""}
              onChange={(e) =>
                handleFilterChange("userId", e.target.value || undefined)
              }
              className="font-mono"
              placeholder="User ID"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="action" className="font-mono text-sm">
              Action
            </Label>
            <Input
              id="action"
              type="text"
              value={filters.action || ""}
              onChange={(e) =>
                handleFilterChange("action", e.target.value || undefined)
              }
              className="font-mono"
              placeholder="e.g., user.created"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="entityType" className="font-mono text-sm">
              Entity Type
            </Label>
            <Input
              id="entityType"
              type="text"
              value={filters.entityType || ""}
              onChange={(e) =>
                handleFilterChange("entityType", e.target.value || undefined)
              }
              className="font-mono"
              placeholder="e.g., user, config"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="startDate" className="font-mono text-sm">
              Start Date
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={filters.startDate || ""}
              onChange={(e) =>
                handleFilterChange("startDate", e.target.value || undefined)
              }
              className="font-mono"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endDate" className="font-mono text-sm">
              End Date
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={filters.endDate || ""}
              onChange={(e) =>
                handleFilterChange("endDate", e.target.value || undefined)
              }
              className="font-mono"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="success" className="font-mono text-sm">
              Status
            </Label>
            <Select
              value={
                filters.success === undefined
                  ? "all"
                  : filters.success
                    ? "success"
                    : "failure"
              }
              onValueChange={(value) =>
                handleFilterChange(
                  "success",
                  value === "all" ? undefined : value === "success",
                )
              }
            >
              <SelectTrigger className="font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-mono">
                  All
                </SelectItem>
                <SelectItem value="success" className="font-mono">
                  Success
                </SelectItem>
                <SelectItem value="failure" className="font-mono">
                  Failure
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card rounded-lg shadow p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Timestamp</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Action</th>
                    <th className="text-left p-3">Entity</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData?.data?.map((log: any) => (
                    <tr
                      key={log.id}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="p-3 text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">{log.userId || "System"}</td>
                      <td className="p-3">{log.action}</td>
                      <td className="p-3">
                        {log.entityType
                          ? `${log.entityType}:${log.entityId || ""}`
                          : "-"}
                      </td>
                      <td className="p-3">{getStatusIcon(log.success)}</td>
                      <td className="p-3 text-xs">{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(!auditData?.data || auditData.data.length === 0) && (
              <div className="text-center text-muted-foreground py-8 font-mono">
                No audit logs found matching the current filters
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground font-mono">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrev}
                    className="font-mono"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNext}
                    className="font-mono"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Log Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase">
              Audit Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4 font-mono text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">ID</Label>
                  <div className="mt-1">{selectedLog.id}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Timestamp
                  </Label>
                  <div className="mt-1">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    User ID
                  </Label>
                  <div className="mt-1">{selectedLog.userId || "System"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Action
                  </Label>
                  <div className="mt-1">{selectedLog.action}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Entity Type
                  </Label>
                  <div className="mt-1">{selectedLog.entityType || "-"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Entity ID
                  </Label>
                  <div className="mt-1">{selectedLog.entityId || "-"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Status
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    {getStatusIcon(selectedLog.success)}
                    {selectedLog.success ? "Success" : "Failure"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    IP Address
                  </Label>
                  <div className="mt-1">{selectedLog.ipAddress}</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">
                  User Agent
                </Label>
                <div className="mt-1 text-xs break-all">
                  {selectedLog.userAgent}
                </div>
              </div>

              {selectedLog.oldValue && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Old Value
                  </Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    New Value
                  </Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.changes && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Changes
                  </Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.errorMessage && (
                <div>
                  <Label className="text-xs text-muted-foreground text-destructive">
                    Error Message
                  </Label>
                  <div className="mt-1 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Metadata
                  </Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
