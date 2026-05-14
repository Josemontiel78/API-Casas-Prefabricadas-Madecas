
import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ClientManager from '@/components/ClientManager';
import ProjectManager from '@/components/ProjectManager';
import BudgetManager from '@/components/BudgetManager';
import ContractManager from '@/components/ContractManager';
import Dashboard from '@/components/Dashboard';
import AIAssistant from '@/components/AIAssistant';
import CommercialHub from '@/components/CommercialHub';
import ProjectMapOverview from '@/components/ProjectMapOverview';
import VendorSettings from '@/components/VendorSettings';
import CubicacionManager from '@/components/CubicacionManager';
import DesignGallery from '@/components/DesignGallery';
import Login from '@/components/Login';
import { ViewState, UserRole } from '@/types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [role, setRole] = useState<UserRole>('vendedor');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleViewChange = (e: any) => {
      if (e.detail) {
        setCurrentView(e.detail as ViewState);
      }
    };

    window.addEventListener('app-view-change', handleViewChange);
    setLoading(false); // No longer waiting for auth
    return () => {
      window.removeEventListener('app-view-change', handleViewChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'hub': return <CommercialHub />;
      case 'map': return <ProjectMapOverview />;
      case 'clients': return <ClientManager />;
      case 'projects': return <ProjectManager />;
      case 'budgets': return <BudgetManager />;
      case 'contracts': return <ContractManager />;
      case 'ai-assistant': return <AIAssistant />;
      case 'cubicacion': return <CubicacionManager />;
      case 'designs': return <DesignGallery />;
      case 'settings': return <VendorSettings />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      setView={setCurrentView}
      role={role}
      setRole={setRole}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
