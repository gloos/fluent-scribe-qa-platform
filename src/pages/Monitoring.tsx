import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';

const Monitoring: React.FC = () => {
  return (
    <AppLayout>
      <MonitoringDashboard />
    </AppLayout>
  );
};

export default Monitoring; 