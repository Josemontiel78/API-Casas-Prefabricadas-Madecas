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
import UserManager from '@/components/UserManager';
import QuotationTracking from '@/components/QuotationTracking';
import ContractAlertsView from '@/components/ContractAlertsView';
import SmartView from '@/components/SmartView';
import { ViewState, UserRole } from '@/types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [role, setRole] = useState<UserRole>('vendedor');
  const [loading, setLoading] = useState(true);
  const [isSmartMode, setIsSmartMode] = useState<boolean>(() => {
    return localStorage.getItem('crm_mode') === 'smart';
  });

  const handleToggleSmartMode = (smart: boolean) => {
    setIsSmartMode(smart);
    localStorage.setItem('crm_mode', smart ? 'smart' : 'original');
    setCurrentView('dashboard');
  };

  useEffect(() => {
    const handleViewChange = (e: any) => {
      if (e.detail) {
        setCurrentView(e.detail as ViewState);
      }
    };

    window.addEventListener('app-view-change', handleViewChange);
    setLoading(false);
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
    if (isSmartMode && currentView === 'dashboard') {
      return (
        <SmartView
          onNavigate={(view) => setCurrentView(view)}
          onOpenAlerts={() => window.dispatchEvent(new CustomEvent('open-contract-alerts-modal'))}
          onSwitchToOriginal={() => handleToggleSmartMode(false)}
        />
      );
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'tracking': return <QuotationTracking />;
      case 'alerts': return <ContractAlertsView onNavigate={(view) => setCurrentView(view)} />;
      case 'hub': return <CommercialHub />;
      case 'map': return <ProjectMapOverview />;
      case 'clients': return <ClientManager />;
      case 'users': return <UserManager initialTab="users" />;
      case 'audit': return <UserManager initialTab="audit" />;
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
      isSmartMode={isSmartMode}
      onToggleSmartMode={handleToggleSmartMode}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
