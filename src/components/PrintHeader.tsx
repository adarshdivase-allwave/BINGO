
import React from 'react';
import { BrandingSettings, ClientDetails } from '../types';

interface PrintHeaderProps {
  branding: BrandingSettings;
  client: ClientDetails;
}

const PrintHeader: React.FC<PrintHeaderProps> = ({ branding, client }) => {
  return (
    <div className="hidden print:block mb-8 print-only-header w-full">
      {/* Logo Row */}
      <div className="flex justify-between items-start pb-6 border-b-2 border-slate-300 w-full">
        {/* Left Side: Primary Logo (Company + 25 Years) */}
        <div className="flex-shrink-0">
          {branding.logoUrl ? (
            <img 
                src={branding.logoUrl} 
                alt="Company Logo" 
                style={{ maxHeight: '90px', maxWidth: '400px', objectFit: 'contain', objectPosition: 'left' }} 
            />
          ) : (
             <div className="h-16 w-32 bg-gray-200 flex items-center justify-center text-xs text-gray-500">No Left Logo</div>
          )}
        </div>

        {/* Right Side: Secondary Logos (Partners/Certifications) */}
        <div className="flex-shrink-0">
           {branding.secondaryLogoUrl ? (
                <img 
                    src={branding.secondaryLogoUrl} 
                    alt="Partner Logos" 
                    style={{ maxHeight: '90px', maxWidth: '300px', objectFit: 'contain', objectPosition: 'right' }} 
                />
            ) : (
               // Empty placeholder to maintain layout if needed, or nothing
               null
            )}
        </div>
      </div>

      {/* Project Details Row */}
      <div className="mt-6 flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-bold mb-2 text-slate-900">{client.projectName || 'Project Proposal'}</h2>
            <table className="text-sm text-slate-700">
                <tbody>
                    <tr>
                        <td className="font-bold pr-4 py-1">Client:</td>
                        <td>{client.clientName}</td>
                    </tr>
                     <tr>
                        <td className="font-bold pr-4 py-1">Date:</td>
                        <td>{client.date}</td>
                    </tr>
                    <tr>
                        <td className="font-bold pr-4 py-1">Prepared By:</td>
                        <td>{client.preparedBy}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div className="text-right text-xs text-slate-600 max-w-xs">
            <h3 className="font-bold text-sm mb-1">{branding.companyInfo.name}</h3>
            <p>{branding.companyInfo.address}</p>
            <p className="mt-1"><strong>P:</strong> {branding.companyInfo.phone}</p>
            <p><strong>E:</strong> {branding.companyInfo.email}</p>
            <p><strong>W:</strong> {branding.companyInfo.website}</p>
        </div>
      </div>
    </div>
  );
};

export default PrintHeader;
