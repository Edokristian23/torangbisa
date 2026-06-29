'use client';

import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useState } from 'react';
import Dashboard from './self-assessment-blu-blud/dashboard/page';
import User from './self-assessment-blu-blud/user/page';
import KualitasPerencanaan from './self-assessment-blu-blud/perencanaan/page';
import Kepemimpinan from './self-assessment-blu-blud/kapabilitas/kepemimpinan/page';
import Kebijakan from './self-assessment-blu-blud/kapabilitas/kebijakan/page';
import SDM from './self-assessment-blu-blud/kapabilitas/SDM/page';
import Kemitraan from './self-assessment-blu-blud/kapabilitas/kemitraan/page';
import ProseBisnis from './self-assessment-blu-blud/kapabilitas/probis/page';
import AktivitasPenanganan from './self-assessment-blu-blud/hasil/aktivitas/page';
import Outcomes from './self-assessment-blu-blud/hasil/outcomes/page';
import TindakLanjut from './self-assessment-blu-blud/tindak-lanjut/page';
import Panduan from './self-assessment-blu-blud/panduan/page';
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
        return <Panduan />;
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
