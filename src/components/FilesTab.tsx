import React, { useState, useEffect } from 'react';
import { FileText, Copy, Check, Save } from 'lucide-react';

interface FilesTabProps {
  filesList: string[];
}

export const FilesTab: React.FC<FilesTabProps> = ({ filesList }) => {
  const [selectedFile, setSelectedFile] = useState<string>('README.md');
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedFile) return;
    setLoading(true);
    fetch(`/api/file?path=${encodeURIComponent(selectedFile)}`)
      .then((res) => res.json())
      .then((data) => {
        setFileContent(data.content || '');
      })
      .finally(() => setLoading(false));
  }, [selectedFile]);

  const handleSave = () => {
    setLoading(true);
    fetch('/api/file/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: selectedFile, content: fileContent }),
    })
      .then((res) => res.json())
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .finally(() => setLoading(false));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-950/60 text-indigo-400 rounded-xl border border-indigo-800/40">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">متصفح ومحرر ملفات المشروع (Project Files)</h2>
              <p className="text-xs text-slate-400">
                عرض وقراءة ملفات مشروع AutoPixel XT المستردة بالكامل من المستودع.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'تم النسخ' : 'نسخ المحتوى'}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition shadow disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saved ? 'تم الحفظ!' : 'حفظ الملف'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File List Selector Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wider">
            ملفات مستودع AUTOPIXEL-XT:
          </span>
          <div className="space-y-1">
            {filesList.map((file) => (
              <button
                key={file}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-right px-3 py-2 text-xs font-mono rounded-lg transition-all flex items-center justify-between ${
                  selectedFile === file
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{file}</span>
                <span className="text-[10px] text-slate-500">
                  {file.endsWith('.md') || file.endsWith('.txt') ? 'Doc' : file.endsWith('.py') ? 'Python' : 'Config'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* File Content Area */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-200 font-semibold">{selectedFile}</span>
            <span className="text-slate-500">{loading ? 'جاري التحميل...' : 'جاهز'}</span>
          </div>
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            rows={20}
            className="w-full bg-slate-950 p-4 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-y scrollbar-thin"
          />
        </div>
      </div>
    </div>
  );
};
