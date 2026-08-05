import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { RegionInfo } from '../types';

export const RegionTab: React.FC = () => {
  const [regions, setRegions] = useState<RegionInfo[]>([]);

  useEffect(() => {
    fetch('/api/regions')
      .then((res) => res.json())
      .then((data) => setRegions(data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-800/40">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">مصفوفة المناطق المدعومة لعروض Google AI Pro</h2>
            <p className="text-xs text-slate-400">
              قائمة الدول والمناطق المؤهلة للحصول على عرض 12 شهر من Gemini Advanced / Google One لمقتني Pixel 10 Pro.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {regions.map((item, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>{item.region}</span>
              </h3>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                item.status === 'Supported'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-amber-950/60 border-amber-800 text-amber-400'
              }`}>
                {item.status === 'Supported' ? 'مدعوم بالكامل' : 'مدعوم جزئياً'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {item.countries.map((country, cIdx) => (
                <span
                  key={cIdx}
                  className="px-2.5 py-1 bg-slate-800/80 border border-slate-700/60 rounded-md text-xs font-medium text-slate-300"
                >
                  {country}
                </span>
              ))}
            </div>

            <p className="text-xs text-slate-400 border-t border-slate-800/80 pt-2.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{item.notes}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
