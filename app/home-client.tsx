'use client';

import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useState } from 'react';
import Dashboard from './dashboard/page';
import User from './user/page';
import KualitasPerencanaan from './perencanaan/page';
import Kepemimpinan from './kapabilitas/kepemimpinan/page';
import Kebijakan from './kapabilitas/kebijakan/page';
import SDM from './kapabilitas/SDM/page';
import Kemitraan from './kapabilitas/kemitraan/page';
import ProseBisnis from './kapabilitas/probis/page';
import AktivitasPenanganan from './hasil/aktivitas/page';
import Outcomes from './hasil/outcomes/page';
import TindakLanjut from './tindak-lanjut/page';
import Panduan from './panduan/page';
import { PAGE_CONFIG } from '@/components/config/page-config';

const HomeClient = ({ session }: any) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const pageMeta = PAGE_CONFIG[currentPage] || {
    title: 'Dashboard',
    subTitle: '',
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'sub-perencanaan':
        return <KualitasPerencanaan />;
      case 'sub-kapabilitas-1':
        return <Kepemimpinan />;
      case 'sub-kapabilitas-2':
        return <Kebijakan />;
      case 'sub-kapabilitas-3':
        return <SDM />;
      case 'sub-kapabilitas-4':
        return <Kemitraan />;
      case 'sub-kapabilitas-5':
        return <ProseBisnis />;
      case 'sub-hasil-1':
        return <AktivitasPenanganan />;
      case 'sub-hasil-2':
        return <Outcomes />;
      case 'tindak-lanjut':
        return <TindakLanjut session={session} />;
      case 'panduan':
        return <Panduan session={session} />;
      case 'user':
        return <User />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-all duration-500">
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          session={session}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Header
            session={session}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={pageMeta.title}
            subTitle={pageMeta.subTitle}
          />

          <main className="flex-1 min-h-0 overflow-hidden bg-transparent">
            <div className="flex h-full min-h-0 flex-col p-4">{renderPage()}</div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default HomeClient;
