import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Clock,
  PlusCircle,
  CheckCircle,
  XCircle,
  Trash2,
  Pencil,
  HandHeart,
  CalendarClock,
  Activity,
  ChevronLeft,
  ChevronRight,
  User,
  UserPlus,
  UserX,
  UserCheck,
  Archive,
  Filter,
} from 'lucide-react';
import { getActivityLogsLocal, ACTIVITY_LOG_UPDATE_EVENT } from '../utils/activityLog';

const getActivityLogs = getActivityLogsLocal;

const ACTION_META = {
  created: {
    label: 'Created',
    icon: PlusCircle,
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200/80',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  declined: {
    label: 'Declined',
    icon: XCircle,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  claimed: {
    label: 'Claimed',
    icon: HandHeart,
    badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200/80',
  },
  updated: {
    label: 'Updated',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  edited: {
    label: 'Edited',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  updated_lost: {
    label: 'Lost Item Updated',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  edited_lost: {
    label: 'Lost Item Edited',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  lost_updated: {
    label: 'Lost Item Updated',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  lost_edited: {
    label: 'Lost Item Edited',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  updated_found: {
    label: 'Found Item Updated',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  edited_found: {
    label: 'Found Item Edited',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  found_updated: {
    label: 'Found Item Updated',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  found_edited: {
    label: 'Found Item Edited',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  item_updated: {
    label: 'Item Updated',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  item_edited: {
    label: 'Item Edited',
    icon: Pencil,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  user_updated: {
    label: 'User Updated',
    icon: UserCheck,
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  user_edited: {
    label: 'User Edited',
    icon: UserCheck,
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  lost_archived: {
    label: 'Lost Archived',
    icon: Archive,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  found_archived: {
    label: 'Found Archived',
    icon: Archive,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  deleted: {
    label: 'Deleted',
    icon: Trash2,
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200/80',
  },
  scheduled: {
    label: 'Scheduled',
    icon: CalendarClock,
    badgeStyle: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
  },
  user_added: {
    label: 'User Added',
    icon: UserPlus,
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  created_user: {
    label: 'User Added',
    icon: UserPlus,
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  user_archived: {
    label: 'User Archived',
    icon: UserX,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  archived_user: {
    label: 'User Archived',
    icon: UserX,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
};

const actionMeta = (action) =>
  ACTION_META[(action || '').toLowerCase()] || {
    label: action || 'Activity',
    icon: Activity,
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  };

function formatRelativeTime(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatExactTime(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const listContainerRef = useRef(null);

  useEffect(() => {
    fetchLogs({ showLoading: true });

    const interval = setInterval(() => {
      fetchLogs({ showLoading: false });
    }, 5000);

    const handleUpdate = () => fetchLogs({ showLoading: false });
    window.addEventListener(ACTIVITY_LOG_UPDATE_EVENT, handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener(ACTIVITY_LOG_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  async function fetchLogs({ showLoading = false } = {}) {
    try {
      if (showLoading) setLoading(true);
      const data = await getActivityLogs();
      const list = Array.isArray(data) ? data : data?.results || [];
      setLogs(list);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  const goToPage = (page) => {
    setCurrentPage(page);
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const filteredLogs = useMemo(() => {
    return [...logs]
      .filter((log) => {
        const actionUpper = (log.action || '').toUpperCase();
        const detailsLower = (log.details || '').toLowerCase();
        const targetLower = (log.target_title || '').toLowerCase();

        // ALWAYS EXCLUDE LOGIN ACTIVITIES
        if (
          actionUpper === 'LOGIN' ||
          actionUpper === 'LOG_IN' ||
          actionUpper === 'USER_LOGIN' ||
          detailsLower.includes('logged in')
        ) {
          return false;
        }

        if (filter === 'ALL') return true;

        // General Edit/Update detection
        const isEditKeyword =
          actionUpper.includes('EDIT') ||
          actionUpper.includes('UPDATE') ||
          detailsLower.includes('updated') ||
          detailsLower.includes('edited') ||
          detailsLower.includes('modified');

        // Explicit User Edit detection (preventing false positives)
        const isUserSpecificEdit =
          actionUpper === 'USER_UPDATED' ||
          actionUpper === 'USER_EDITED' ||
          actionUpper === 'UPDATE_USER' ||
          actionUpper === 'EDIT_USER' ||
          actionUpper === 'USER_UPDATE' ||
          actionUpper === 'USER_EDIT' ||
          detailsLower.includes('user account') ||
          detailsLower.includes('user profile') ||
          detailsLower.includes('user role') ||
          detailsLower.includes('updated user') ||
          detailsLower.includes('edited user');

        if (filter === 'CLAIMED') return actionUpper === 'CLAIMED';
        if (filter === 'ARCHIVED') return actionUpper.includes('ARCHIV');

        if (filter === 'LOST_ADDED') {
          return (
            actionUpper === 'CREATED_LOST' ||
            actionUpper === 'LOST_CREATED' ||
            actionUpper === 'ADD_LOST' ||
            actionUpper === 'LOST' ||
            (actionUpper === 'CREATED' &&
              (detailsLower.includes('lost') || targetLower.includes('lost'))) ||
            detailsLower.includes('added lost') ||
            detailsLower.includes('created lost')
          );
        }

        if (filter === 'FOUND_ADDED') {
          return (
            actionUpper === 'CREATED_FOUND' ||
            actionUpper === 'FOUND_CREATED' ||
            actionUpper === 'ADD_FOUND' ||
            actionUpper === 'FOUND' ||
            (actionUpper === 'CREATED' &&
              (detailsLower.includes('found') || targetLower.includes('found'))) ||
            detailsLower.includes('added found') ||
            detailsLower.includes('created found')
          );
        }

        if (filter === 'LOST_ARCHIVED') {
          return (
            actionUpper === 'LOST_ARCHIVED' ||
            actionUpper === 'ARCHIVED_LOST' ||
            actionUpper === 'ARCHIVE_LOST' ||
            (actionUpper.includes('ARCHIV') &&
              (detailsLower.includes('lost') || targetLower.includes('lost'))) ||
            detailsLower.includes('archived lost')
          );
        }

        if (filter === 'FOUND_ARCHIVED') {
          return (
            actionUpper === 'FOUND_ARCHIVED' ||
            actionUpper === 'ARCHIVED_FOUND' ||
            actionUpper === 'ARCHIVE_FOUND' ||
            (actionUpper.includes('ARCHIV') &&
              (detailsLower.includes('found') || targetLower.includes('found'))) ||
            detailsLower.includes('archived found')
          );
        }

        // --- ITEM EDIT / UPDATE FILTER ---
        if (filter === 'ITEM_EDITED') {
          return isEditKeyword && !isUserSpecificEdit;
        }

        // --- USER EDIT / UPDATE FILTER ---
        if (filter === 'USER_EDITED') {
          return isUserSpecificEdit;
        }

        if (filter === 'USER_ADDED') {
          return (
            actionUpper === 'USER_ADDED' ||
            actionUpper === 'CREATED_USER' ||
            actionUpper === 'ADD_USER' ||
            (actionUpper === 'CREATED' &&
              (detailsLower.includes('user') || targetLower.includes('user'))) ||
            detailsLower.includes('added user') ||
            detailsLower.includes('created user')
          );
        }

        if (filter === 'USER_ARCHIVED') {
          return (
            actionUpper === 'USER_ARCHIVED' ||
            actionUpper === 'ARCHIVED_USER' ||
            actionUpper === 'ARCHIVE_USER' ||
            (actionUpper.includes('ARCHIV') &&
              (detailsLower.includes('user') || targetLower.includes('user'))) ||
            detailsLower.includes('archived user')
          );
        }

        return actionUpper === filter;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        return timeB - timeA;
      });
  }, [logs, filter]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getVisiblePages = () => {
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let startPage = currentPage < maxVisiblePages ? 1 : currentPage - 2;
    let endPage = startPage + maxVisiblePages - 1;
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = totalPages - maxVisiblePages + 1;
    }
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center p-6 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0B6B8A] border-t-transparent" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Loading audit trails...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[18px] border border-[#D8E2EF] shadow-[0_8px_24px_rgba(45,54,109,0.08)] overflow-hidden flex flex-col h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="bg-white px-6 sm:px-8 py-6 border-b border-[#D8E2EF] shrink-0">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-10 rounded-full bg-[#0B6B8A]" />
            <div>
              <h3 className="text-[22px] sm:text-xl font-black uppercase tracking-[0.18em] text-[#071E3D]">
                Activity Logs
              </h3>
              <p className="text-lg sm:text-base text-[#7B8AA6] italic mt-1">
                Real-time system audit logs for lost, found, and claimed property
              </p>
            </div>
          </div>

          {/* Filter Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-[280px]">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0B6B8A]" size={18} />
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-11 pr-8 py-3 border border-[#CBD8E8] rounded-full text-base font-bold outline-none bg-white text-[#071E3D] cursor-pointer appearance-none focus:ring-2 focus:ring-[#0B6B8A]/20 focus:border-[#0B6B8A]"
              >
                <option value="ALL">All Activities</option>
                <option value="LOST_ADDED">Added Lost Items</option>
                <option value="FOUND_ADDED">Added Found Items</option>
                <option value="ITEM_EDITED">Edited / Updated Items</option>
                <option value="LOST_ARCHIVED">Archived Lost Items</option>
                <option value="FOUND_ARCHIVED">Archived Found Items</option>
                <option value="CLAIMED">Claimed Only</option>
                <option value="ARCHIVED">All Archives</option>
                <option value="USER_ADDED">Added Users</option>
                <option value="USER_EDITED">Edited / Updated Users</option>
                <option value="USER_ARCHIVED">Archived Users</option>
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#0B6B8A] text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div ref={listContainerRef} className="overflow-auto bg-white flex-1">
        <table className="w-full min-w-[1000px] table-fixed border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-[16%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[13px] font-black uppercase text-white">
                Date & Time
              </th>
              <th className="w-[12%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[13px] font-black uppercase text-white">
                Action
              </th>
              <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[13px] font-black uppercase text-white">
                Performed By
              </th>
              <th className="w-[20%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[13px] font-black uppercase text-white">
                Target Item / User
              </th>
              <th className="w-[34%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[13px] font-black uppercase text-white">
                Details
              </th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {paginatedLogs.length > 0 ? (
              paginatedLogs.map((log, index) => {
                const meta = actionMeta(log.action);
                const Icon = meta.icon;

                return (
                  <tr
                    key={log.id || index}
                    className={`h-[70px] ${
                      index % 2 === 0 ? 'bg-white' : 'bg-[#F6FAFF]'
                    } hover:bg-[#EAF4FF]`}
                  >
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[14px]">
                      <span className="block font-semibold text-slate-800">
                        {formatExactTime(log.created_at)}
                      </span>
                      <span className="block text-xs text-slate-400 font-medium">
                        {formatRelativeTime(log.created_at)}
                      </span>
                    </td>

                    <td className="border border-gray-300 p-4 text-center align-middle">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-[11px] font-black uppercase border ${meta.badgeStyle}`}
                      >
                        <Icon size={12} />
                        {meta.label}
                      </span>
                    </td>

                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[14px]">
                      <span className="block font-bold text-slate-800">
                        {log.actor_name || 'System'}
                      </span>
                      {log.actor_role && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <User size={11} /> {log.actor_role}
                        </span>
                      )}
                    </td>

                    <td className="border border-gray-300 p-4 text-center align-middle text-[#0B6B8A] font-bold text-[14px]">
                      {log.target_title ? `"${log.target_title}"` : '-'}
                    </td>

                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-600 text-[14px]">
                      {log.details || `${meta.label.toLowerCase()} an entry`}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="bg-white py-24 text-center text-[#7B8AA6] font-bold uppercase">
                  No {filter !== 'ALL' ? filter.replace('_', ' ').toLowerCase() : ''} activity logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination */}
      {filteredLogs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-6 py-4 border-t border-[#D8E2EF] shrink-0">
          <p className="text-sm font-medium text-[#7B8AA6]">
            Showing <span className="font-bold text-[#071E3D]">{startIndex + 1}</span>-
            <span className="font-bold text-[#071E3D]">
              {Math.min(startIndex + ITEMS_PER_PAGE, filteredLogs.length)}
            </span>{' '}
            of <span className="font-bold text-[#071E3D]">{filteredLogs.length}</span> entries
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center p-2 rounded-lg border border-[#CBD8E8] text-slate-600 hover:bg-[#F6FAFF] disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>

            {getVisiblePages().map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page)}
                className={`h-8 min-w-8 rounded-lg text-xs font-bold transition ${
                  currentPage === page
                    ? 'bg-[#0B6B8A] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-[#F6FAFF]'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center p-2 rounded-lg border border-[#CBD8E8] text-slate-600 hover:bg-[#F6FAFF] disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;