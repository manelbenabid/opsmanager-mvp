// frontend/src/pages/AllEmployeesPage.tsx
import React from 'react';
import AppLayout from '../components/AppLayout';
import GenericEmployeeListComponent from '../components/GenericEmployeeListComponent';

const AllEmployeesPage: React.FC = () => {
  return (
    <AppLayout>
      <GenericEmployeeListComponent 
        pageTitle="All Employees"
        pageDescription="Browse and manage all employees in the directory."
        showRoleFilter={true}
        // No filterRoles prop means show all
      />
    </AppLayout>
  );
};

export default AllEmployeesPage;
