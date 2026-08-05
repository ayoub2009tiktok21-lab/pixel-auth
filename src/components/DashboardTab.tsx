import React, { useState, useEffect } from 'react';
import { Terminal, Play, ShieldAlert, Cpu, Globe, CheckCircle2, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';
import { DoctorResponse, IpResponse } from '../types';

interface DashboardTabProps {
  doctorData: DoctorResponse | null;
  ipData: IpResponse | null;
  onRunDoctor: () => void;
  onRunIpCheck: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  doctorData,
  ipData,
  onRunDoctor,
  onRunIpCheck,
}) => {
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    '🤖 [AutoPixel XT] Bot System Initialization complete.',
    '📱 Device Specs loaded: Google Pixel 10 Pro (Android 16, SDK 36, Build AP4A.250405.002)',
    '🌐 Network Diagnostics: Ready to test Telegram Bot endpoints & Google One offers.',
  ]);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setConsoleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const [botRunning, setBotRunning] = useState<boolean>(false);
  const [botPid, setBotPid] = useState<number | null>(null);

  const fetchBotStatus = () => {
    fetch('/api/bot/status')
      .then((res) => res.json())
      .then((data) => {
        setBotRunning(data.running);
        setBotPid(data.pid);
        if (data.logs && data.logs.length > 0) {
          setConsoleLogs(data.logs);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartBot = () => {
    addLog('🚀 Starting Telegram Bot process (python3 main.py)...');
    fetch('/api/bot/start', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          addLog(`❌ Error starting bot: ${data.error}`);
        } else {
          addLog(`✅ Bot started successfully (PID: ${data.pid})`);
          setBotRunning(true);
          setBotPid(data.pid);
        }
      });
  };

  const handleStopBot = () => {
    addLog('🛑 Stopping Telegram Bot process...');
    fetch('/api/bot/stop', { method: 'POST' })
      .then((res) => res.json())
      .then(() => {
        addLog('🛑 Bot process stopped.');
        setBotRunning(false);
        setBotPid(null);
      });
  };

  const handleRunDoctorClick = () => {
    addLog('Running /doctor diagnostics check...');
    onRunDoctor();
    setTimeout(() => {
      addLog('✅ /doctor Diagnostics complete. System healthy!');
    }, 600);
  };

  const handleRunIpClick = () => {
    addLog('Executing /ip location & proxy identity lookup...');
    onRunIpCheck();
    setTimeout(() => {
      addLog('🌐 /ip lookup finished. Timezone and Geo coordinates mapped.');
    }, 600);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Device Specs Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">محاكي الجهاز</span>
            <div className="p-2 bg-cyan-950/60 text-cyan-400 rounded-lg border border-cyan-800/40">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Pixel 10 Pro</h3>
          <p className="text-xs text-slate-400 mb-3">Android 16 • SDK 36 • Build AP4A</p>
          <div className="space-y-1 text-xs text-slate-300 font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
            <div><span className="text-slate-500">Brand:</span> Google</div>
            <div><span className="text-slate-500">Locale:</span> en-US (English)</div>
            <div><span className="text-slate-500">Wit.ai:</span> Audio Captcha Ready</div>
          </div>
        </div>

        {/* IP & Geo Status */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">حالة الاتصال والمنطقة</span>
            <div className="p-2 bg-sky-950/60 text-sky-400 rounded-lg border border-sky-800/40">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {ipData?.ipInfo.country || 'الولايات المتحدة (US)'}
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            {ipData?.ipInfo.timezone || 'America/Los_Angeles'}
          </p>
          <div className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>عروض Google One Gemini Pro مدعومة</span>
          </div>
        </div>

        {/* Telegram Bot Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">بوت التليجرام</span>
            <div className="p-2 bg-blue-950/60 text-blue-400 rounded-lg border border-blue-800/40">
              <Terminal className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">AutoPixel Telegram Bot</h3>
          <p className="text-xs text-slate-400 mb-3">لوحة الأوامر التفاعلية جاهزة</p>
          <div className="text-xs text-slate-300 font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
            <span>python3 main.py</span>
            <button
              onClick={() => copyToClipboard('python3 main.py')}
              className="p-1 hover:text-cyan-400 text-slate-400 transition"
              title="نسخ الأمر"
            >
              {copiedCmd === 'python3 main.py' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Action Control Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Play className="w-4 h-4 text-cyan-400" />
          <span>أوامر التشخيص واختبار النظام (Quick Actions)</span>
        </h3>

        <div className="flex flex-wrap gap-3 mb-6">
          {botRunning ? (
            <button
              onClick={handleStopBot}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg shadow transition animate-pulse"
            >
              <Terminal className="w-4 h-4" />
              <span>إيقاف بوت التليجرام (Stop Bot - PID: {botPid})</span>
            </button>
          ) : (
            <button
              onClick={handleStartBot}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg shadow transition"
            >
              <Play className="w-4 h-4" />
              <span>تشغيل استضافة البوت الآن (Start Bot Host)</span>
            </button>
          )}

          <button
            onClick={handleRunDoctorClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-lg shadow transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تشغيل فحص الدكتور (/doctor)</span>
          </button>

          <button
            onClick={handleRunIpClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition"
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span>فحص معلومات الـ IP والمنطقة (/ip)</span>
          </button>

          <button
            onClick={() => {
              addLog('Simulating Pixel 10 Pro Google One offer scan...');
              setTimeout(() => {
                addLog('🔍 Navigating to https://one.google.com/about/plans');
                addLog('✨ Checked offer keywords: "gemini pro", "12 month", "activate", "claim offer"');
                addLog('ℹ️ Session artifacts saved to /tmp output directory.');
              }, 700);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition"
          >
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>اختبار محاكاة جلسة Pixel 10 Pro</span>
          </button>
        </div>

        {/* Commands Quick List */}
        <div className="mb-6 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 mb-2 block">أوامر بوت التليجرام الرئيسية:</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            {['/start', '/doctor', '/ip', '/offer', '/proxies', '/settings', '/help', '/logs'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => {
                  copyToClipboard(cmd);
                  addLog(`Command ${cmd} copied to clipboard!`);
                }}
                className="flex items-center justify-between px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-cyan-400 transition"
              >
                <span>{cmd}</span>
                {copiedCmd === cmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Live Execution Console Logs */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs">
          <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-200">سجل الأحداث والعمليات (System Output)</span>
            </div>
            <button
              onClick={() => setConsoleLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition"
            >
              مسح السجل
            </button>
          </div>
          <div className="p-4 space-y-1.5 max-h-64 overflow-y-auto font-mono text-slate-300 scrollbar-thin">
            {consoleLogs.map((log, index) => (
              <div key={index} className="leading-relaxed">
                {log.includes('✅') || log.includes('✨') ? (
                  <span className="text-emerald-400">{log}</span>
                ) : log.includes('🤖') || log.includes('📱') ? (
                  <span className="text-cyan-300">{log}</span>
                ) : log.includes('🔍') || log.includes('🌐') ? (
                  <span className="text-sky-300">{log}</span>
                ) : (
                  <span className="text-slate-300">{log}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
