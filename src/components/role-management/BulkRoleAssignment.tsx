import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  Download, 
  Users, 
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import { UserRole, type UserProfile } from '@/lib/types/user';

interface BulkAssignmentUser {
  id: string;
  email: string;
  name: string;
  currentRole: UserRole;
  selected: boolean;
}

interface BulkAssignmentPreview {
  user: BulkAssignmentUser;
  newRole: UserRole;
  requiresApproval: boolean;
  reason: string;
}

export const BulkRoleAssignment: React.FC = () => {
  const { getRoleDisplayName, assignableRoles } = useRBAC();
  const [activeTab, setActiveTab] = useState('manual');
  const [users, setUsers] = useState<BulkAssignmentUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<BulkAssignmentUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [currentRoleFilter, setCurrentRoleFilter] = useState('all');
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [notifyUsers, setNotifyUsers] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [csvData, setCsvData] = useState('');
  const [previewData, setPreviewData] = useState<BulkAssignmentPreview[]>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, departmentFilter, currentRoleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Mock data - in real implementation, this would fetch from API
      const mockUsers: BulkAssignmentUser[] = [
        {
          id: 'user_001',
          email: 'john.doe@company.com',
          name: 'John Doe',
          currentRole: UserRole.USER,
          selected: false
        },
        {
          id: 'user_002',
          email: 'jane.smith@company.com',
          name: 'Jane Smith',
          currentRole: UserRole.QA_ANALYST,
          selected: false
        },
        {
          id: 'user_003',
          email: 'mike.johnson@company.com',
          name: 'Mike Johnson',
          currentRole: UserRole.USER,
          selected: false
        },
        {
          id: 'user_004',
          email: 'sarah.wilson@company.com',
          name: 'Sarah Wilson',
          currentRole: UserRole.QA_ANALYST,
          selected: false
        },
        {
          id: 'user_005',
          email: 'david.brown@company.com',
          name: 'David Brown',
          currentRole: UserRole.MANAGER,
          selected: false
        }
      ];
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (currentRoleFilter !== 'all') {
      filtered = filtered.filter(user => user.currentRole === currentRoleFilter);
    }

    setFilteredUsers(filtered);
  };

  const toggleUserSelection = (userId: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId 
        ? { ...user, selected: !user.selected }
        : user
    ));
  };

  const selectAllUsers = () => {
    const allSelected = filteredUsers.every(user => user.selected);
    setUsers(prev => prev.map(user => 
      filteredUsers.find(fu => fu.id === user.id)
        ? { ...user, selected: !allSelected }
        : user
    ));
  };

  const generatePreview = () => {
    if (!selectedRole || !assignmentReason) {
      return;
    }

    const selectedUsers = users.filter(user => user.selected);
    const preview: BulkAssignmentPreview[] = selectedUsers.map(user => ({
      user,
      newRole: selectedRole as UserRole,
      requiresApproval: requireApproval || user.currentRole !== selectedRole,
      reason: assignmentReason
    }));

    setPreviewData(preview);
    setPreviewDialogOpen(true);
  };

  const processCsvData = () => {
    // Parse CSV data and generate preview
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length <= 1) return; // Need header + at least one data line

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIndex = header.indexOf('email');
    const roleIndex = header.indexOf('role');
    const reasonIndex = header.indexOf('reason');

    if (emailIndex === -1 || roleIndex === -1) {
      alert('CSV must contain at least "email" and "role" columns');
      return;
    }

    const preview: BulkAssignmentPreview[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const email = values[emailIndex];
      const role = values[roleIndex] as UserRole;
      const reason = reasonIndex >= 0 ? values[reasonIndex] : assignmentReason;

      const user = users.find(u => u.email === email);
      if (user && Object.values(UserRole).includes(role)) {
        preview.push({
          user,
          newRole: role,
          requiresApproval: requireApproval || user.currentRole !== role,
          reason: reason || 'Bulk assignment from CSV'
        });
      }
    }

    setPreviewData(preview);
    setPreviewDialogOpen(true);
  };

  const executeAssignment = async () => {
    setProcessing(true);
    try {
      // Mock API call - in real implementation, this would call the backend
      console.log('Executing bulk role assignment:', {
        assignments: previewData,
        effectiveDate,
        expirationDate,
        notifyUsers,
        requireApproval
      });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Close dialog and reset
      setPreviewDialogOpen(false);
      setPreviewData([]);
      
      // Reset form
      setUsers(prev => prev.map(user => ({ ...user, selected: false })));
      setSelectedRole('');
      setAssignmentReason('');
      setCsvData('');
      
      alert('Bulk role assignment completed successfully!');
    } finally {
      setProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'email,role,reason\nuser@company.com,qa_analyst,Promotion to QA Analyst\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_role_assignment_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Selection</TabsTrigger>
            <TabsTrigger value="csv">CSV Import</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>User Selection</CardTitle>
                <CardDescription>Select users and configure role assignment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="search">Search Users</Label>
                    <Input
                      id="search"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="roleFilter">Filter by Current Role</Label>
                    <Select value={currentRoleFilter} onValueChange={setCurrentRoleFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {Object.values(UserRole).map(role => (
                          <SelectItem key={role} value={role}>
                            {getRoleDisplayName(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="newRole">New Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map(role => (
                          <SelectItem key={role} value={role}>
                            {getRoleDisplayName(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* User Selection Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={filteredUsers.length > 0 && filteredUsers.every(user => user.selected)}
                            onCheckedChange={selectAllUsers}
                          />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Current Role</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Checkbox
                              checked={user.selected}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getRoleDisplayName(user.currentRole)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.email}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-sm text-muted-foreground">
                  {users.filter(u => u.selected).length} of {filteredUsers.length} users selected
                </div>
              </CardContent>
            </Card>

            {/* Assignment Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Assignment Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="effectiveDate">Effective Date</Label>
                    <Input
                      id="effectiveDate"
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expirationDate">Expiration Date (Optional)</Label>
                    <Input
                      id="expirationDate"
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reason">Assignment Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Provide a reason for the role assignment..."
                    value={assignmentReason}
                    onChange={(e) => setAssignmentReason(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notifyUsers"
                      checked={notifyUsers}
                      onCheckedChange={setNotifyUsers}
                    />
                    <Label htmlFor="notifyUsers">Notify users via email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requireApproval"
                      checked={requireApproval}
                      onCheckedChange={setRequireApproval}
                    />
                    <Label htmlFor="requireApproval">Require approval workflow</Label>
                  </div>
                </div>

                <Button 
                  onClick={generatePreview}
                  disabled={users.filter(u => u.selected).length === 0 || !selectedRole || !assignmentReason}
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Preview Assignment ({users.filter(u => u.selected).length} users)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="csv" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>CSV Import</CardTitle>
                <CardDescription>Import role assignments from a CSV file</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Required columns: email, role, reason (optional)
                  </div>
                </div>

                <div>
                  <Label htmlFor="csvData">CSV Data</Label>
                  <Textarea
                    id="csvData"
                    placeholder="Paste your CSV data here or upload a file..."
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={10}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="csvEffectiveDate">Effective Date</Label>
                    <Input
                      id="csvEffectiveDate"
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="csvExpirationDate">Expiration Date (Optional)</Label>
                    <Input
                      id="csvExpirationDate"
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="csvReason">Default Assignment Reason</Label>
                  <Textarea
                    id="csvReason"
                    placeholder="Default reason if not specified in CSV..."
                    value={assignmentReason}
                    onChange={(e) => setAssignmentReason(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="csvNotifyUsers"
                      checked={notifyUsers}
                      onCheckedChange={setNotifyUsers}
                    />
                    <Label htmlFor="csvNotifyUsers">Notify users via email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="csvRequireApproval"
                      checked={requireApproval}
                      onCheckedChange={setRequireApproval}
                    />
                    <Label htmlFor="csvRequireApproval">Require approval workflow</Label>
                  </div>
                </div>

                <Button 
                  onClick={processCsvData}
                  disabled={!csvData.trim()}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Process CSV Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Role Assignment Preview</DialogTitle>
            <DialogDescription>
              Review the following role assignments before execution
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Total Assignments:</strong> {previewData.length}
              </div>
              <div>
                <strong>Require Approval:</strong> {previewData.filter(p => p.requiresApproval).length}
              </div>
              <div>
                <strong>Immediate:</strong> {previewData.filter(p => !p.requiresApproval).length}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role Change</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.user.name}</div>
                        <div className="text-sm text-muted-foreground">{item.user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{getRoleDisplayName(item.user.currentRole)}</span>
                        <span>→</span>
                        <span className="font-medium">{getRoleDisplayName(item.newRole)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.requiresApproval ? (
                        <Badge variant="outline" className="text-orange-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Required
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Immediate
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{item.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={executeAssignment}
              disabled={processing || previewData.length === 0}
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Execute Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 