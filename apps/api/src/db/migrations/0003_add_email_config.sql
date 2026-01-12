-- Migration: Add email configuration to config table
-- Date: 2025-12-31

-- Email SMTP configuration
INSERT INTO config (id, value, description, category, type, default_value, min_value, max_value, is_read_only, requires_restart, updated_at, updated_by) VALUES
  ('email-host', '"smtp.gmail.com"', 'SMTP server hostname', 'general', 'string', '"smtp.gmail.com"', NULL, NULL, false, false, NOW(), NULL),
  ('email-port', '587', 'SMTP server port', 'general', 'number', '587', '1', '65535', false, false, NOW(), NULL),
  ('email-secure', 'false', 'Use SSL/TLS for SMTP connection', 'general', 'boolean', 'false', NULL, NULL, false, false, NOW(), NULL),
  ('email-user', '""', 'SMTP authentication username', 'general', 'string', '""', NULL, NULL, false, false, NOW(), NULL),
  ('email-password', '""', 'SMTP authentication password', 'general', 'string', '""', NULL, NULL, false, false, NOW(), NULL),
  ('email-from', '"noreply@crackhouse.local"', 'From email address for system emails', 'general', 'string', '"noreply@crackhouse.local"', NULL, NULL, false, false, NOW(), NULL),
  ('email-enabled', 'false', 'Enable email notifications', 'general', 'boolean', 'false', NULL, NULL, false, false, NOW(), NULL);

-- Email notification preferences
INSERT INTO config (id, value, description, category, type, default_value, min_value, max_value, is_read_only, requires_restart, updated_at, updated_by) VALUES
  ('email-notify-job-complete', 'true', 'Send email when job completes', 'general', 'boolean', 'true', NULL, NULL, false, false, NOW(), NULL),
  ('email-notify-job-failed', 'true', 'Send email when job fails', 'general', 'boolean', 'true', NULL, NULL, false, false, NOW(), NULL),
  ('email-notify-health-degraded', 'true', 'Send email when system health is degraded', 'general', 'boolean', 'true', NULL, NULL, false, false, NOW(), NULL),
  ('email-notify-health-critical', 'true', 'Send email when system health is critical', 'general', 'boolean', 'true', NULL, NULL, false, false, NOW(), NULL),
  ('email-notify-security-events', 'true', 'Send email for security events', 'security', 'boolean', 'true', NULL, NULL, false, false, NOW(), NULL);

-- Email queue configuration
INSERT INTO config (id, value, description, category, type, default_value, min_value, max_value, is_read_only, requires_restart, updated_at, updated_by) VALUES
  ('email-retry-attempts', '3', 'Number of retry attempts for failed emails', 'general', 'number', '3', '1', '10', false, false, NOW(), NULL),
  ('email-retry-delay', '5000', 'Delay between retry attempts (milliseconds)', 'general', 'number', '5000', '1000', '60000', false, false, NOW(), NULL);
