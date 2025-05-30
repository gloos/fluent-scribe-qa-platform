import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

export const AuthLogo: React.FC = () => {
  return (
    <div className="text-center mb-8">
      <Link to="/" className="inline-flex items-center space-x-2">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <FileText className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-gray-900">LinguaQA</span>
      </Link>
    </div>
  );
}; 