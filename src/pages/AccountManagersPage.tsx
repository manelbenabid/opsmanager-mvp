// frontend/src/pages/AccountManagersPage.tsx
import React from 'react';
import AppLayout from '../components/AppLayout';
import GenericEmployeeListComponent from '../components/GenericEmployeeListComponent';

const AccountManagersPage: React.FC = () => {
  return (
    <AppLayout>
      <GenericEmployeeListComponent 
        pageTitle="Account Managers"
        pageDescription="View all Account Managers."
        filterRoles={['Account Manager']} // Ensure this role string matches your data
        showRoleFilter={false}
      />
    </AppLayout>
  );
};

export default AccountManagersPage;
