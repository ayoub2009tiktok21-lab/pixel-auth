import React from 'react';
import { Smartphone, ShieldCheck, Terminal, Settings, Globe, FileText, Activity, MapPin } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  proxiesCount: number;
  hasEnv: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, proxiesCount, hasEnv }) => {
  const tabs = [
    { id: 'dashboard', label: 'لوحة التحكم (Dashboard)', icon: Terminal },
    { id: 'config', label: 'الإعدادات (.env)', icon: Settings },
    { id: 'proxies', label: 'البروكسبات (Proxies)', icon: Globe },
    { id: 'files', label: 'ملفات المشروع (Files)', icon: FileText },
    { id: 'regions', label: 'المناطق المدعومة (Regions)', icon: MapPin },
    { id: 'doctor', label: 'الفحص التشخيصي (Doctor)', icon: Activity },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  AUTOPIXEL XT
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/60 rounded-full">
                  Pixel 10 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400">Google One & Gemini AI Offer Assistant</p>
            </div>
          </div>

          {/* Badges */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Android 16 (SDK 36)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>البروككيات: {proxiesCount}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              hasEnv ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400' : 'bg-amber-950/40 border-amber-800/60 text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${hasEnv ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{hasEnv ? 'ملف .env نشط' : 'بدون .env (افتراضي)'}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 space-x-reverse overflow-x-auto pb-2 scrollbar-none border-t border-slate-800/60 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
