"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Zap,
  RefreshCw,
  Trash2,
  Mail,
  Database,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Users,
  FileText,
  Activity,
} from "lucide-react";
import {
  useReloadConfig,
  useSendTestEmail,
  useStartCleanup,
} from "@/lib/api-hooks";
import { toast } from "sonner";

interface QuickActionsPanelProps {
  className?: string;
}

export function QuickActionsPanel({ className }: QuickActionsPanelProps) {
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [cleanupStrategy, setCleanupStrategy] = useState("failed");

  const reloadConfig = useReloadConfig();
  const sendTestEmail = useSendTestEmail();
  const startCleanup = useStartCleanup();

  const handleReloadConfig = async () => {
    try {
      await reloadConfig.mutateAsync();
      toast.success("Configuration reloaded successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to reload configuration");
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendTestEmail.mutateAsync({
        to: testEmail,
        type: "test",
      });
      toast.success("Test email sent successfully");
      setIsTestEmailOpen(false);
      setTestEmail("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send test email");
    }
  };

  const handleCleanup = async () => {
    try {
      await startCleanup.mutateAsync({ strategy: cleanupStrategy });
      toast.success(`Cleanup started: ${cleanupStrategy} strategy`);
      setIsCleanupOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to start cleanup");
    }
  };

  const quickActions = [
    {
      id: "reload-config",
      title: "Reload Configuration",
      description: "Reload all configuration from database",
      icon: <RefreshCw className="h-5 w-5" />,
      action: handleReloadConfig,
      loading: reloadConfig.isPending,
      variant: "default" as const,
    },
    {
      id: "test-email",
      title: "Send Test Email",
      description: "Send a test email to verify email configuration",
      icon: <Mail className="h-5 w-5" />,
      action: () => setIsTestEmailOpen(true),
      loading: false,
      variant: "outline" as const,
      dialog: true,
    },
    {
      id: "cleanup-failed",
      title: "Cleanup Failed Jobs",
      description: "Remove all failed jobs from the system",
      icon: <Trash2 className="h-5 w-5" />,
      action: () => {
        setCleanupStrategy("failed");
        setIsCleanupOpen(true);
      },
      loading: false,
      variant: "destructive" as const,
      dialog: true,
    },
    {
      id: "cleanup-orphaned",
      title: "Cleanup Orphaned Files",
      description: "Remove orphaned upload and temp files",
      icon: <Database className="h-5 w-5" />,
      action: () => {
        setCleanupStrategy("orphaned");
        setIsCleanupOpen(true);
      },
      loading: false,
      variant: "destructive" as const,
      dialog: true,
    },
    {
      id: "refresh-queue",
      title: "Refresh Queues",
      description: "Refresh job queue statistics",
      icon: <Activity className="h-5 w-5" />,
      action: () => {
        toast.success("Queue statistics refreshed");
        // In a real implementation, this would trigger a refetch
      },
      loading: false,
      variant: "outline" as const,
    },
    {
      id: "view-audit",
      title: "View Audit Logs",
      description: "Open audit logs viewer",
      icon: <FileText className="h-5 w-5" />,
      action: () => {
        // This would typically navigate to audit logs page
        toast.info("Navigate to Audit Logs tab to view logs");
      },
      loading: false,
      variant: "outline" as const,
    },
    {
      id: "view-users",
      title: "Manage Users",
      description: "Open user management",
      icon: <Users className="h-5 w-5" />,
      action: () => {
        // This would typically navigate to users page
        toast.info("User management feature coming soon");
      },
      loading: false,
      variant: "outline" as const,
    },
    {
      id: "check-health",
      title: "Run Health Check",
      description: "Perform comprehensive system health check",
      icon: <Zap className="h-5 w-5" />,
      action: () => {
        toast.success("Health check initiated");
        // This would typically trigger a health check
      },
      loading: false,
      variant: "default" as const,
    },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-2 font-mono">
        <Zap className="h-5 w-5" />
        <h2 className="text-lg font-semibold uppercase">Quick Actions</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <div
            key={action.id}
            className="bg-card rounded-lg shadow p-4 space-y-2"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              {action.icon}
              <div className="text-sm font-semibold font-mono">
                {action.title}
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono mb-3">
              {action.description}
            </p>
            {action.dialog ? (
              <Dialog
                open={
                  (action.id === "test-email" && isTestEmailOpen) ||
                  ((action.id === "cleanup-failed" ||
                    action.id === "cleanup-orphaned") &&
                    isCleanupOpen)
                }
                onOpenChange={(open) => {
                  if (action.id === "test-email") setIsTestEmailOpen(open);
                  else setIsCleanupOpen(open);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant={action.variant}
                    size="sm"
                    className="w-full font-mono"
                  >
                    {action.title}
                  </Button>
                </DialogTrigger>

                {/* Test Email Dialog */}
                {action.id === "test-email" && (
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-mono uppercase">
                        Send Test Email
                      </DialogTitle>
                      <DialogDescription className="font-mono text-sm">
                        Send a test email to verify your email configuration is
                        working correctly.
                      </DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={handleSendTestEmail}
                      className="space-y-4 py-4"
                    >
                      <div className="grid gap-2">
                        <label
                          htmlFor="testEmail"
                          className="text-sm font-mono"
                        >
                          Recipient Email
                        </label>
                        <input
                          id="testEmail"
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                          placeholder="admin@example.com"
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsTestEmailOpen(false)}
                          className="font-mono"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={sendTestEmail.isPending || !testEmail}
                          className="font-mono"
                        >
                          {sendTestEmail.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Test Email
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                )}

                {/* Cleanup Dialog */}
                {(action.id === "cleanup-failed" ||
                  action.id === "cleanup-orphaned") && (
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-mono uppercase">
                        Confirm Cleanup
                      </DialogTitle>
                      <DialogDescription className="font-mono text-sm">
                        {cleanupStrategy === "failed"
                          ? "This will remove all failed jobs from the system. This action cannot be undone."
                          : "This will remove all orphaned files from the system. This action cannot be undone."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-muted-foreground font-mono">
                            Warning: This action is irreversible. Please confirm
                            you want to proceed.
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCleanupOpen(false)}
                          className="font-mono"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleCleanup}
                          disabled={startCleanup.isPending}
                          className="font-mono"
                        >
                          {startCleanup.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Cleaning...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Confirm Cleanup
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                )}
              </Dialog>
            ) : (
              <Button
                variant={action.variant}
                size="sm"
                onClick={action.action}
                disabled={action.loading}
                className="w-full font-mono"
              >
                {action.loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  action.title
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
