import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { DoctorResponse, DiagnosticItem } from '../types';

interface DoctorTabProps {
  doctorData: DoctorResponse | null;
  onRefresh: () => void;
}

export const DoctorTab: React.FC<DoctorTabProps> = ({ doctorData, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-950/60 text-cyan-400 rounded-xl border border-cyan-800/40">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">تقرير فحص الدكتور التشخيصي (/doctor)</h2>
            <p className="text-xs text-slate-400">
              يتحقق من بيئة العمل، ملفات التهيئة، محاكي Pixel 10 Pro، والبروكسيات قبل التشغيل.
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition shadow"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة الفحص الان</span>
        </button>
      </div>

      {doctorData?.diagnostics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(doctorData.diagnostics).map(([key, itemValue]) => {
            const item = itemValue as DiagnosticItem;
            return (
              <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-sm capitalize">{key}</span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                    item.status === 'pass'
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                      : 'bg-amber-950/60 border-amber-800 text-amber-400'
                  }`}>
                    {(item.status || 'PASS').toUpperCase()}
                  </span>
                </div>

                {item.version && <p className="text-xs text-cyan-400 font-mono">التقنية: {item.version}</p>}
                {item.message && <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>}
                {item.model && <p className="text-xs text-slate-300 font-mono">الجهاز: {item.model} ({item.android})</p>}
                {item.keywords && (
                  <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                    {item.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
