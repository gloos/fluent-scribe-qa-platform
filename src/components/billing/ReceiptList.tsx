import React, { useState, useEffect } from 'react';
import { ReceiptService } from '@/lib/services/receipt-service';
import type { ReceiptListItem } from '@/lib/types/receipt';

interface ReceiptListProps {
  customerId: string;
  className?: string;
}

const ReceiptList: React.FC<ReceiptListProps> = ({ customerId, className = '' }) => {
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('delivered');

  const receiptService = ReceiptService.getInstance();

  useEffect(() => {
    loadReceipts();
  }, [customerId, selectedStatus]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const receiptsData = await receiptService.getCustomerReceipts(customerId, {
        status: selectedStatus,
        limit: 50
      });
      
      setReceipts(receiptsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return (amount / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'delivered':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'generated':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const handleDownload = async (receipt: ReceiptListItem) => {
    if (!receipt.pdf_url || !receipt.can_download) {
      return;
    }

    try {
      // In a real implementation, this would fetch the PDF and trigger download
      window.open(receipt.pdf_url, '_blank');
    } catch (err) {
      setError('Failed to download receipt');
    }
  };

  const handleResend = async (receiptId: string) => {
    try {
      setError(null);
      await receiptService.resendReceipt(receiptId);
      // Optionally show a success message
      alert('Receipt has been resent to your email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend receipt');
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Payment Receipts</h2>
        
        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="delivered">Delivered</option>
          <option value="generated">Generated</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Receipts List */}
      {receipts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">📧</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No receipts found</h3>
          <p className="text-gray-500">
            {selectedStatus === 'delivered' 
              ? 'Your payment receipts will appear here once payments are processed.'
              : `No receipts with status "${selectedStatus}" found.`
            }
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {receipt.receipt_number}
                        </div>
                        {receipt.invoice_number && (
                          <div className="text-sm text-gray-500">
                            Invoice: {receipt.invoice_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(receipt.payment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(receipt.amount_paid, receipt.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadgeClass(receipt.status)}>
                        {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {receipt.can_download && (
                          <button
                            onClick={() => handleDownload(receipt)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Download Receipt"
                          >
                            Download
                          </button>
                        )}
                        {receipt.status === 'delivered' && (
                          <button
                            onClick={() => handleResend(receipt.id)}
                            className="text-green-600 hover:text-green-900 transition-colors"
                            title="Resend Receipt"
                          >
                            Resend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receipt Count */}
      {receipts.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ReceiptList; 