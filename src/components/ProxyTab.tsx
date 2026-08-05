import React, { useState, useEffect } from 'react';
import { Globe, Save, Check, RefreshCw, AlertCircle } from 'lucide-react';

export const ProxyTab: React.FC = () => {
  const [proxyText, setProxyText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/file?path=proxies.txt')
      .then((res) => res.json())
      .then((data) => {
        if (data.content !== undefined) {
          setProxyText(data.content);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setLoading(true);
    fetch('/api/file/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: 'proxies.txt', content: proxyText }),
    })
      .then((res) => res.json())
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      })
      .finally(() => setLoading(false));
  };

  const parsedProxies = proxyText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  return (
    <div className="space-y-6">
      {/* Proxy Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-950/60 text-sky-400 rounded-xl border border-sky-800/40">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إدارة قائمة البروكسيات (proxies.txt)</h2>
              <p className="text-xs text-slate-400">
                يدعم AutoPixel تدوير البروكسيات (Proxy Pool Rotation) والاتصال المباشر (Direct Mode).
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition shadow disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saved ? 'تم الحفظ!' : 'حفظ البروكسيات'}</span>
          </button>
        </div>
      </div>

      {/* Format Info */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
        <span className="font-semibold text-sky-400 block">الصيغ المدعومة للبروكسيات (Supported Proxy Formats):</span>
        <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono">
          <li>ip:port</li>
          <li>ip:port:username:password</li>
          <li>http://user:pass@host:port</li>
          <li>socks5://user:pass@host:port</li>
        </ul>
      </div>

      {/* Editor & Active count */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-mono text-slate-300 font-semibold">proxies.txt List</span>
          <span className="text-cyan-400 font-medium">عدد البروكسيات النشطة: {parsedProxies.length}</span>
        </div>
        <textarea
          value={proxyText}
          onChange={(e) => setProxyText(e.target.value)}
          rows={14}
          className="w-full bg-slate-950 p-4 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 leading-relaxed resize-y"
          placeholder="# Add proxy list (one proxy per line)...&#10;192.168.1.1:8080&#10;user:pass@proxy.example.com:8080"
        />
      </div>
    </div>
  );
};
