import React, { useEffect, useRef, useState } from "react";

const PhotoUpload = ({ name, value = [], onChange }) => {
  const ref = useRef(null);
  const [previews, setPreviews] = useState([]);

  // Sync previews when external `value` changes (e.g. form reset or pre-populated state)
  useEffect(() => {
    if (!value || value.length === 0) {
      setPreviews([]);
      if (ref.current) ref.current.value = "";
    } else {
      // Create preview URLs for File objects or keep existing URL strings
      const newPreviews = value.map((file) =>
        file instanceof File ? URL.createObjectURL(file) : file
      );
      setPreviews(newPreviews);

      // Clean up object URLs on unmount/update to avoid memory leaks
      return () => {
        newPreviews.forEach((url) => {
          if (typeof url === "string" && url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
        });
      };
    }
  }, [value]);

  const handleFile = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;

    // Limit total uploaded photos to max 3
    const currentFiles = value || [];
    const availableSlots = 3 - currentFiles.length;

    if (availableSlots <= 0) return;

    const filesToAdd = selectedFiles.slice(0, availableSlots);
    const updatedFiles = [...currentFiles, ...filesToAdd];

    onChange({
      target: {
        name,
        value: updatedFiles,
      },
    });

    // Reset input so the same file can be selected again if needed
    if (ref.current) ref.current.value = "";
  };

  const handleRemove = (indexToRemove) => {
    const updatedFiles = (value || []).filter((_, index) => index !== indexToRemove);

    onChange({
      target: {
        name,
        value: updatedFiles,
      },
    });

    if (ref.current) ref.current.value = "";
  };

  const currentCount = value ? value.length : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="block text-m font-semibold uppercase text-slate-700">
          Photos (optional)
        </label>
        <span className="text-xs font-bold text-slate-400">
          {currentCount} / 3
        </span>
      </div>

      {/* Grid container for uploaded photo thumbnails */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {previews.map((src, index) => (
          <div
            key={index}
            className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 group"
          >
            <img
              src={src}
              alt={`preview-${index}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-500 transition-all shadow-md"
              title="Remove photo"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Upload Button - hides when 3 items are uploaded */}
        {currentCount < 3 && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className={`w-full h-28 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-[#2D366D]/40 hover:text-[#2D366D] transition-all text-xs font-black uppercase tracking-widest font-sans ${
              currentCount === 0 ? "col-span-3" : "col-span-1"
            }`}
          >
            <span className="text-lg">📷</span>
            <span>{currentCount === 0 ? "Upload Photos (1-3)" : "Add More"}</span>
          </button>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        name={name}
        accept="image/*"
        multiple // Enables multi-file selection
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};

export default PhotoUpload;