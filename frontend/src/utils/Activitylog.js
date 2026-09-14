
const STORAGE_KEY = 'slc_activity_logs';
const MAX_LOGS = 500; // prevent unbounded localStorage growth

export const ACTIVITY_LOG_UPDATE_EVENT = 'activity-log-updated';

function readRawLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading activity logs from localStorage:', error);
    return [];
  }
}

function writeRawLogs(logs) {
  try {
    // Keep only the most recent MAX_LOGS entries (newest first on write).
    const trimmed = logs.slice(0, MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch (error) {
    console.error('Error writing activity logs to localStorage:', error);
    return false;
  }
}

/**
 * Record a new activity log entry.
 *
 * @param {Object} entry
 * @param {string} [entry.actor_name]   Name of the person who did the action (falls back to "System")
 * @param {string} [entry.actor_role]   Role badge shown next to the action, e.g. "admin", "reporter"
 * @param {string} entry.action         One of: created, approved, declined, claimed, updated, deleted, scheduled, login
 * @param {string} [entry.target_title] The item's title, shown in quotes in the log line
 * @param {string} [entry.details]      Free-text description shown in the log line
 */
export function logActivity(entry) {
  if (!entry || !entry.action) {
    console.warn('logActivity called without an action; entry ignored.', entry);
    return null;
  }

  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    actor_name: entry.actor_name || 'System',
    actor_role: entry.actor_role || '',
    action: entry.action,
    target_title: entry.target_title || '',
    details: entry.details || '',
    created_at: new Date().toISOString(),
  };

  const logs = readRawLogs();
  logs.unshift(logEntry); // newest first
  writeRawLogs(logs);

  // Notify any listeners in THIS tab (e.g. ActivityLogs.jsx) to refresh.
  window.dispatchEvent(new Event(ACTIVITY_LOG_UPDATE_EVENT));

  return logEntry;
}

/**
 * Fetch all stored activity logs (newest first).
 * Kept async-shaped (Promise) so it's a drop-in replacement if you later
 * swap this for a real API call — callers already do `await getActivityLogs()`.
 */
export async function getActivityLogsLocal() {
  return readRawLogs();
}

/**
 * Remove all activity logs. Useful for testing/reset flows.
 */
export function clearActivityLogs() {
  writeRawLogs([]);
  window.dispatchEvent(new Event(ACTIVITY_LOG_UPDATE_EVENT));
}

export function logUserRegistration(newUser) {
  return logActivity({
    actor_name: newUser.name || newUser.email || 'New User',
    actor_role: newUser.role || 'User',
    action: 'registered',
    target_title: newUser.email || newUser.name || 'User Account',
    details: `Registered account as ${newUser.role || 'User'}`,
  });
}