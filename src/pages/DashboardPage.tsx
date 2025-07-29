import React from 'react';
import { useAuth } from '../contexts/AuthContext'; 
import AppLayout from '../components/AppLayout';

// IMPORTANT: Replace this with the ACTUAL SRC URL from the iframe code
// provided by Power BI (File -> Embed report -> Website or portal)
const POWER_BI_IFRAME_SRC_URL = "https://app.powerbi.com/reportEmbed?reportId=e6d12cc2-316a-4331-917b-0ace2bfa29a2&autoAuth=true&ctid=b1348f50-030e-4ea1-8d44-493ee19f88d8&filterPaneEnabled=false&navContentPaneEnabled=false"; // Example, replace with your actual URL
//https://app.powerbi.com/reportEmbed?reportId=e6d12cc2-316a-4331-917b-0ace2bfa29a2&autoAuth=true&ctid=b1348f50-030e-4ea1-8d44-493ee19f88d8&config=eyJjbHVzdGVyVXJsIjoiaHR0cHM6Ly9XQUJJLVVTLU5PUlRILUNFTlRSQUwtQi1yZWRpcmVjdC5hbmFseXNpcy53aW5kb3dzLm5ldC8ifQ%3D%3D&filterPaneEnabled=false&navContentPaneEnabled=false
const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const isUrlConfigured = typeof POWER_BI_IFRAME_SRC_URL === 'string' &&
                         POWER_BI_IFRAME_SRC_URL.trim() !== '' &&
                         !POWER_BI_IFRAME_SRC_URL.includes("YOUR_POWER_BI_IFRAME_SRC_URL_HERE") && 
                         POWER_BI_IFRAME_SRC_URL.startsWith("https://app.powerbi.com");

  return (
    // <AppLayout>
    //   <div className="p-0 m-0 w-full h-[calc(100vh-64px)]"> {/* Adjust 64px based on your AppLayout's actual header height */}
    //     {isUrlConfigured ? (
    //       <iframe title="test-dashboard-updated v.2" width="1140" height="541.25" src="https://app.powerbi.com/reportEmbed?reportId=e6d12cc2-316a-4331-917b-0ace2bfa29a2&autoAuth=true&ctid=b1348f50-030e-4ea1-8d44-493ee19f88d8&filterPaneEnabled=false&navContentPaneEnabled=false" frameBorder="0" allowFullScreen={true}></iframe>
    //     ) : (
    //       <div className="flex flex-col items-center justify-center h-full text-center p-8">
    //         <h1 className="text-2xl font-semibold mb-4">Power BI Dashboard</h1>
    //         <p className="text-red-600 font-semibold text-lg mb-2">Configuration Needed!</p>
    //         <p className="text-gray-700 mb-1">
    //           The Power BI report embedding URL has not been set up correctly in the application code.
    //         </p>
    //         <p className="text-sm text-gray-500">
    //           Please update the <code className="bg-gray-200 p-1 rounded">POWER_BI_IFRAME_SRC_URL</code> constant in <code className="bg-gray-200 p-1 rounded">DashboardPage.tsx</code> with the actual iframe source URL from the Power BI service.
    //         </p>
    //       </div>
    //     )}
    //   </div>
    // </AppLayout>
    <AppLayout>
      <div className="w-full overflow-hidden">
        {isUrlConfigured ? (
          <div className=" min-h-[900px] h-[calc(100dvh-40px)] text-center overflow-hidden">
          <iframe
            title="test-dashboard-updated v.2"
            src="https://app.powerbi.com/reportEmbed?reportId=e6d12cc2-316a-4331-917b-0ace2bfa29a2&autoAuth=true&ctid=b1348f50-030e-4ea1-8d44-493ee19f88d8&filterPaneEnabled=false&navContentPaneEnabled=false&actionBarEnabled=false"
            className="w-full h-full border-0"
            allowFullScreen
          ></iframe>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h1 className="text-2xl font-semibold mb-4">Power BI Dashboard</h1>
            <p className="text-red-600 font-semibold text-lg mb-2">Configuration Needed!</p>
            <p className="text-gray-700 mb-1">
              The Power BI report embedding URL has not been set up correctly in the application code.
            </p>
            <p className="text-sm text-gray-500">
              Please update the <code className="bg-gray-200 p-1 rounded">POWER_BI_IFRAME_SRC_URL</code> constant in <code className="bg-gray-200 p-1 rounded">DashboardPage.tsx</code> with the actual iframe source URL from the Power BI service.
            </p>
          </div>
        )}
      </div>
</AppLayout>

  );
};

export default DashboardPage;
