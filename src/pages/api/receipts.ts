import type { NextApiRequest, NextApiResponse } from 'next';
import { ReceiptService } from '@/lib/services/receipt-service';
import type { 
  GenerateReceiptRequest,
  DeliverReceiptRequest,
  GetReceiptsRequest,
  ReceiptApiResponse 
} from '@/lib/types/receipt';

const receiptService = ReceiptService.getInstance();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReceiptApiResponse>
) {
  try {
    switch (req.method) {
      case 'GET':
        await handleGetReceipts(req, res);
        break;
      
      case 'POST':
        await handleGenerateReceipt(req, res);
        break;
      
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({
          success: false,
          error: {
            code: 'method_not_allowed',
            message: 'Method not allowed',
            type: 'validation_error'
          }
        });
    }
  } catch (error) {
    console.error('Receipt API error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'internal_server_error',
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'api_error'
      }
    });
  }
}

async function handleGetReceipts(
  req: NextApiRequest,
  res: NextApiResponse<ReceiptApiResponse>
) {
  const {
    customer_id,
    invoice_id,
    status,
    start_date,
    end_date,
    limit = '20',
    offset = '0'
  } = req.query;

  // Validate required parameters
  if (!customer_id && !invoice_id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'missing_parameter',
        message: 'Either customer_id or invoice_id is required',
        type: 'validation_error'
      }
    });
  }

  try {
    if (invoice_id && typeof invoice_id === 'string') {
      // Get specific receipt by invoice ID
      const receipt = await receiptService.getReceiptByInvoiceId(invoice_id);
      return res.status(200).json({
        success: true,
        data: receipt
      });
    }

    if (customer_id && typeof customer_id === 'string') {
      // Get receipts for customer
      const receipts = await receiptService.getCustomerReceipts(customer_id, {
        status: typeof status === 'string' ? status : undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      });

      return res.status(200).json({
        success: true,
        data: receipts
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        code: 'invalid_parameters',
        message: 'Invalid parameters provided',
        type: 'validation_error'
      }
    });

  } catch (error) {
    console.error('Error getting receipts:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'get_receipts_failed',
        message: error instanceof Error ? error.message : 'Failed to get receipts',
        type: 'api_error'
      }
    });
  }
}

async function handleGenerateReceipt(
  req: NextApiRequest,
  res: NextApiResponse<ReceiptApiResponse>
) {
  const { invoice_id, options }: GenerateReceiptRequest = req.body;

  // Validate required parameters
  if (!invoice_id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'missing_invoice_id',
        message: 'invoice_id is required',
        type: 'validation_error'
      }
    });
  }

  try {
    const result = await receiptService.generateReceipt(invoice_id, options);

    if (result.success) {
      return res.status(201).json({
        success: true,
        data: {
          receipt: result.receipt,
          pdf_url: result.pdf_url
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error generating receipt:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'receipt_generation_failed',
        message: error instanceof Error ? error.message : 'Failed to generate receipt',
        type: 'api_error'
      }
    });
  }
} 