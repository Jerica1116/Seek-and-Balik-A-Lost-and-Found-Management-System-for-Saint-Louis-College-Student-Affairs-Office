import React, { useState } from "react";
import { FaDatabase, FaDownload, FaUpload, FaHistory, FaCheckCircle } from "react-icons/fa";

const BackupRestore = () => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleCreateBackup = () => {
    setIsBackingUp(true);
    setStatusMessage("");

    setTimeout(() => {
      setIsBackingUp(false);
      setStatusMessage("Backup file created and downloaded successfully!");
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Backup & Restore</h1>
        <p className="text-sm text-slate-500">
          Safeguard system records, generate database dumps, and restore application state.
        </p>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-semibold text-emerald-700">
          <FaCheckCircle className="h-5 w-5 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Create Backup Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-[#0B6FA4] mb-3">
            <FaDownload size={22} />
            <h2 className="text-lg font-bold text-slate-800">Export Backup</h2>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 mb-6">
            Generate and download an encrypted snapshot of lost item logs, user accounts, and verification data.
          </p>
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0B6FA4] px-5 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-[#095882] disabled:opacity-50"
          >
            <FaDatabase /> {isBackingUp ? "Generating..." : "Download System Backup"}
          </button>
        </div>

        {/* Restore Data Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-600 mb-3">
            <FaUpload size={22} />
            <h2 className="text-lg font-bold text-slate-800">Restore System</h2>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 mb-6">
            Upload a valid JSON/SQL backup file to roll back or sync system records to a previous point in time.
          </p>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-emerald-700">
            <FaUpload /> Select Backup File
            <input type="file" accept=".json,.sql" className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;