import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardTab } from './components/DashboardTab';
import { ConfigTab } from './components/ConfigTab';
import { ProxyTab } from './components/ProxyTab';
import { FilesTab } from './components/FilesTab';
import { RegionTab } from './components/RegionTab';
import { DoctorTab } from './components/DoctorTab';
import { DoctorResponse, IpResponse, ProjectOverview } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [doctorData, setDoctorData] = useState<DoctorResponse | null>(null);
  const [ipData, setIpData] = useState<IpResponse | null>(null);

  const fetchOverview = () => {
    fetch('/api/project/overview')
      .then((res) => res.json())
      .then((data) => setOverview(data))
      .catch(() => {});
  };

  const fetchDoctor = () => {
    fetch('/api/doctor')
      .then((res) => res.json())
      .then((data) => setDoctorData(data))
      .catch(() => {});
  };

  const fetchIp = () => {
    fetch('/api/ip')
      .then((res) => res.json())
      .then((data) => setIpData(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchOverview();
    fetchDoctor();
    fetchIp();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased" dir="rtl">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        proxiesCount={overview?.proxiesCount || 0}
        hasEnv={overview?.hasEnv || false}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardTab
            doctorData={doctorData}
            ipData={ipData}
            onRunDoctor={fetchDoctor}
            onRunIpCheck={fetchIp}
          />
        )}

        {activeTab === 'config' && <ConfigTab />}

        {activeTab === 'proxies' && <ProxyTab />}

        {activeTab === 'files' && <FilesTab filesList={overview?.files || []} />}

        {activeTab === 'regions' && <RegionTab />}

        {activeTab === 'doctor' && <DoctorTab doctorData={doctorData} onRefresh={fetchDoctor} />}
      </main>
    </div>
  );
}
