
import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ClientManager from '@/components/ClientManager';
import ProjectManager from '@/components/ProjectManager';
import BudgetManager from '@/components/BudgetManager';
import ContractManager from '@/components/ContractManager';
import Dashboard from '@/components/Dashboard';
import AIAssistant from '@/components/AIAssistant';
import { seedDatabase } from '@/services/db';
import { ViewState, UserRole } from '@/types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [role, setRole] = useState<UserRole>('vendedor');

  useEffect(() => {
    seedDatabase();
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <ClientManager />;
      case 'projects': return <ProjectManager />;
      case 'budgets': return <BudgetManager />;
      case 'contracts': return <ContractManager />;
      case 'ai-assistant': return <AIAssistant />;
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
