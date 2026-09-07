import React, { useState } from "react";
import { Camera, Eye, FileText, CheckCircle2, AlertCircle, Maximize2, X } from "lucide-react";

export interface RmaEvidencePanelProps {
  items: any[];
  photos: string[];
  reason: string;
  reasonDetails?: string;
  resolution: string;
  orderContext?: any;
}

export const RmaEvidencePanel: React.FC<RmaEvidencePanelProps> = ({
  items,
  photos,
  reason,
  reasonDetails,
  resolution,
  orderContext
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Photo Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-stone-900 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white bg-black/60 p-2 rounded-full hover:bg-black transition cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImage}
              alt="Return Evidence Zoom"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Overview Reason Box */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 uppercase tracking-wide">
            <FileText className="w-4 h-4 text-[#B85C38]" />
            <span>Customer Selected Reason: {reason}</span>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-stone-200 text-stone-800 rounded-full">
            Resolution: {resolution.replace("_", " ").toUpperCase()}
          </span>
        </div>
        {reasonDetails && (
          <p className="text-xs text-stone-600 bg-white p-3 rounded-lg border border-stone-200 italic">
            "{reasonDetails}"
          </p>
        )}
      </div>

      {/* Customer Uploaded Evidence Photos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-stone-500" />
            Uploaded Photos ({photos?.length || 0})
          </h4>
        </div>

        {photos && photos.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photos.map((img, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedImage(img)}
                className="group relative aspect-square bg-stone-100 rounded-xl border border-stone-200 overflow-hidden cursor-pointer hover:border-[#B85C38] transition"
              >
                <img src={img} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-center text-xs text-stone-400">
            No inspection photos provided by customer.
          </div>
        )}
      </div>

      {/* Returned / Exchanged Items List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
          Items Requested for Return / Exchange ({items?.length || 0})
        </h4>

        <div className="space-y-2">
          {items && items.length > 0 ? (
            items.map((it: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-white border border-stone-200 rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                    {it.image ? (
                      <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-stone-400 text-[10px]">SKU</span>
                    )}
                  </div>
                  <div>
                    <h5 className="font-semibold text-stone-900">{it.name}</h5>
                    <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                      <span>Size: {it.original_size || it.size || "M"}</span>
                      <span>•</span>
                      <span>Color: {it.color || "Standard"}</span>
                      <span>•</span>
                      <span>Qty: {it.quantity || 1}</span>
                    </div>
                    {it.action === "exchange" && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#B85C38] font-bold">
                        Requested Exchange Size: {it.requested_size || "L"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-stone-900">₹{(Number(it.price_paid || 0) * Number(it.quantity || 1)).toLocaleString("en-IN")}</div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                      it.action === "exchange"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {it.action || "Return"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-500 italic">No item snapshot available.</p>
          )}
        </div>
      </div>
    </div>
  );
};
