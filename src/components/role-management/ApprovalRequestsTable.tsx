import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Shield,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import { UserRole } from '@/lib/types/user';

interface ApprovalRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  currentRole: UserRole;
  requestedRole: UserRole;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high';
  daysLeft: number;
  approvalWorkflow: {
    currentStep: number;
    totalSteps: number;
    currentApprover: string;
  };
}

export const ApprovalRequestsTable: React.FC = () => {
  const { getRoleDisplayName } = useRBAC();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewComments, setReviewComments] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadApprovalRequests();
  }, []);

  const loadApprovalRequests = async () => {
    setLoading(true);
    try {
      // Mock data - in real implementation, this would fetch from API
      const mockRequests: ApprovalRequest[] = [
        {
          id: 'req_001',
          userId: 'user_001',
          userEmail: 'john.doe@company.com',
          userName: 'John Doe',
          currentRole: UserRole.USER,
          requestedRole: UserRole.QA_ANALYST,
          requestedBy: 'manager@company.com',
          requestedAt: '2024-01-15T10:30:00Z',
          reason: 'Promotion to QA Analyst position due to excellent performance',
          status: 'pending',
          priority: 'medium',
          daysLeft: 3,
          approvalWorkflow: {
            currentStep: 1,
            totalSteps: 2,
            currentApprover: 'Director of QA'
          }
        },
        {
          id: 'req_002',
          userId: 'user_002',
          userEmail: 'jane.smith@company.com',
          userName: 'Jane Smith',
          currentRole: UserRole.QA_ANALYST,
          requestedRole: UserRole.MANAGER,
          requestedBy: 'hr@company.com',
          requestedAt: '2024-01-14T14:15:00Z',
          reason: 'Team lead promotion - managing 5 person QA team',
          status: 'pending',
          priority: 'high',
          daysLeft: 1,
          approvalWorkflow: {
            currentStep: 2,
            totalSteps: 3,
            currentApprover: 'VP Engineering'
          }
        },
        {
          id: 'req_003',
          userId: 'user_003',
          userEmail: 'contractor@external.com',
          userName: 'Mike Johnson',
          currentRole: UserRole.GUEST,
          requestedRole: UserRole.USER,
          requestedBy: 'project.manager@company.com',
          requestedAt: '2024-01-16T09:00:00Z',
          reason: 'Temporary access for Q1 consulting project',
          status: 'pending',
          priority: 'low',
          daysLeft: 5,
          approvalWorkflow: {
            currentStep: 1,
            totalSteps: 1,
            currentApprover: 'Project Manager'
          }
        }
      ];

      setRequests(mockRequests);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewRequest = (request: ApprovalRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewComments('');
    setReviewDialogOpen(true);
  };

  const submitReview = async () => {
    if (!selectedRequest || !reviewAction) return;

    setProcessing(true);
    try {
      // Mock API call - in real implementation, this would call the backend
      console.log('Submitting review:', {
        requestId: selectedRequest.id,
        action: reviewAction,
        comments: reviewComments
      });

      // Update the request status
      setRequests(prev => prev.map(req => 
        req.id === selectedRequest.id 
          ? { ...req, status: reviewAction === 'approve' ? 'approved' : 'rejected' }
          : req
      ));

      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewAction(null);
      setReviewComments('');
    } finally {
      setProcessing(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading approval requests...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Pending Approvals</h3>
            <p className="text-muted-foreground">All role assignment requests have been processed.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role Change</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Days Left</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{request.userName}</div>
                      <div className="text-sm text-muted-foreground">{request.userEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{getRoleDisplayName(request.currentRole)}</span>
                        <span>→</span>
                        <span className="font-medium">{getRoleDisplayName(request.requestedRole)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{request.requestedBy}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      Step {request.approvalWorkflow.currentStep} of {request.approvalWorkflow.totalSteps}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {request.approvalWorkflow.currentApprover}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`text-sm font-medium ${
                      request.daysLeft <= 1 ? 'text-red-600' : 
                      request.daysLeft <= 3 ? 'text-orange-600' : 
                      'text-gray-600'
                    }`}>
                      {request.daysLeft} days
                    </div>
                  </TableCell>
                  <TableCell>
                    {request.status === 'pending' && (
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReviewRequest(request, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReviewRequest(request, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRequest(request);
                            setReviewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {reviewAction ? `${reviewAction === 'approve' ? 'Approve' : 'Reject'} Role Assignment` : 'Review Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  Role change request for {selectedRequest.userName} ({selectedRequest.userEmail})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Current Role</Label>
                  <p className="text-sm">{getRoleDisplayName(selectedRequest.currentRole)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Requested Role</Label>
                  <p className="text-sm font-medium">{getRoleDisplayName(selectedRequest.requestedRole)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Requested By</Label>
                  <p className="text-sm">{selectedRequest.requestedBy}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Priority</Label>
                  {getPriorityBadge(selectedRequest.priority)}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Reason for Request</Label>
                <p className="text-sm mt-1 p-3 bg-gray-50 rounded">{selectedRequest.reason}</p>
              </div>

              {reviewAction && (
                <div>
                  <Label htmlFor="reviewComments" className="text-sm font-medium">
                    {reviewAction === 'approve' ? 'Approval Comments' : 'Rejection Reason'} (Optional)
                  </Label>
                  <Textarea
                    id="reviewComments"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder={
                      reviewAction === 'approve' 
                        ? 'Add any comments about the approval...'
                        : 'Please provide a reason for rejection...'
                    }
                    className="mt-1"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setSelectedRequest(null);
                setReviewAction(null);
                setReviewComments('');
              }}
              disabled={processing}
            >
              Cancel
            </Button>
            {reviewAction && (
              <Button
                onClick={submitReview}
                disabled={processing}
                variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {reviewAction === 'approve' ? (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    {reviewAction === 'approve' ? 'Approve Request' : 'Reject Request'}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 