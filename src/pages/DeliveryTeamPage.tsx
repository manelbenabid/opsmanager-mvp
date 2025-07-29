// frontend/src/pages/DeliveryTeamPage.tsx
import React from 'react';
import AppLayout from '../components/AppLayout';
import GenericEmployeeListComponent from '../components/GenericEmployeeListComponent';

const DeliveryTeamPage: React.FC = () => {
  return (
    <AppLayout>
      <GenericEmployeeListComponent 
        pageTitle="Delivery Team"
        pageDescription="Members of the Delivery Team, including Technical Team and Leads."
        filterRoles={['Technical Team', 'Lead']} // Ensure these role strings match your data
        showRoleFilter={false}
      />
    </AppLayout>
  );
};

export default DeliveryTeamPage;
