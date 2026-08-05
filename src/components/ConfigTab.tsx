import React, { useState, useEffect } from 'react';
import { Settings, Save, Copy, Check, Info, FileCode, Shield } from 'lucide-react';

export const ConfigTab: React.FC = () => {
  const [envContent, setEnvContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saved, setSaved] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/file?path=.env')
      .then((res) => res.json())
      .then((data) => {
        if (data.content) {
          setEnvContent(data.content);
        } else {
          // Fallback to reading .env.example
          fetch('/api/file?path=.env.example')
            .then((res2) => res2.json())
            .then((data2) => {
              if (data2.content) {
                setEnvContent(data2.content);
              }
            });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setLoading(true);
    fetch('/api/file/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: '.env', content: envContent }),
    })
      .then((res) => res.json())
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      })
      .finally(() => setLoading(false));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-950/60 text-cyan-400 rounded-xl border border-cyan-800/40">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إعدادات البيئة ومتغيرات النظام (.env)</h2>
              <p className="text-xs text-slate-400">
                قم بضبط مفتاح بوت التليجرام (`TELEGRAM_BOT_TOKEN`) ومفاتيح التوقيت والبروككي.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'تم النسخ' : 'نسخ الإعدادات'}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition shadow disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saved ? 'تم الحفظ!' : 'حفظ الملف (.env)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recommended Variables Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-cyan-400">
            <Shield className="w-4 h-4" />
            <span>TELEGRAM_BOT_TOKEN</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            مفتاح التوكن الخاص ببوتك في تليجرام المستخرج من BotFather.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sky-400">
            <FileCode className="w-4 h-4" />
            <span>WIT_AI_TOKEN</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            مفتاح Wit.ai اختياري لحل كابتشا الصوت تلقائياً (Audio CAPTCHA Solver).
          </p>
        </div>
      </div>

      {/* Editor textarea */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-mono text-slate-300 font-semibold">.env Configuration File Editor</span>
          <span className="text-slate-500">AutoPixel XT Runtime Config</span>
        </div>
        <textarea
          value={envContent}
          onChange={(e) => setEnvContent(e.target.value)}
          rows={16}
          className="w-full bg-slate-950 p-4 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 leading-relaxed resize-y"
          placeholder="# Paste or type your .env variables here..."
        />
      </div>
    </div>
  );
};
