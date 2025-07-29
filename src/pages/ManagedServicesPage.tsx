// frontend/src/pages/ManagedServicesPage.tsx
import React from 'react';
import AppLayout from '../components/AppLayout';
import GenericEmployeeListComponent from '../components/GenericEmployeeListComponent';

const ManagedServicesPage: React.FC = () => {
  return (
    <AppLayout>
      <GenericEmployeeListComponent 
        pageTitle="Managed Services Team"
        pageDescription="Members of the Managed Services Team."
        filterRoles={['Managed Services']} // Ensure this role string matches your data
        showRoleFilter={false}
      />
    </AppLayout>
  );
};

export default ManagedServicesPage;
