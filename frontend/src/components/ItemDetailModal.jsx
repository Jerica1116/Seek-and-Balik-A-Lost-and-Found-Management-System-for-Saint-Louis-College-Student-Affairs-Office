import React from 'react';

const ItemDetailModal = ({ item, onClaim, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-md sm:max-w-lg max-h-[92vh] rounded-xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,.18)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0B648D] to-[#155F87] text-white px-4 sm:px-6 py-3 sm:py-4 border-b-4 flex justify-between items-start gap-4">
          <div>
            <h2 className="text-[15px] font-bold">
              Item Details
            </h2>
            <p className="text-blue-100 text-[13px] mt-1">
              View complete information about the selected item
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex-shrink-0 rounded-full bg-white/15 hover:bg-white/25 transition flex items-center justify-center text-white font-bold text-[15px]"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-4 sm:p-6 font-sans">

          {/* Details Section */}
          <div className="w-full">
            <p className="text-[13px] font-semibold text-slate-500">
              Item Name
            </p>
            <h1 className="text-[15px] font-bold uppercase text-[#184C73] tracking-wide mb-4 break-words">
              {item.title || item.name || "Unnamed Item"}
            </h1>
            <hr className="mb-4 border-slate-300 shadow-sm" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[13px] font-semibold text-slate-500">Type</p>
                <p className="text-[13px] font-semibold break-words text-slate-800 mt-0.5">
                  {(item.type || "—").toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-500">Category</p>
                <p className="text-[13px] font-semibold break-words text-slate-800 mt-0.5">
                  {(item.category || item.cat || "—").toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-500">Date</p>
                <p className="text-[13px] font-semibold break-words text-slate-800 mt-0.5">
                  {item.created_date || item.date || "—"}
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-500">Location</p>
                <p className="text-[13px] font-semibold break-words text-slate-800 mt-0.5">
                  {(item.location || item.area || "—").toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ItemDetailModal;