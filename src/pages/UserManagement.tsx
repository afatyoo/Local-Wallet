import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usersApi } from '@/lib/api';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Trash2, UserPlus, ShieldCheck, Eye, EyeOff, Key } from 'lucide-react';

export default function UserManagementPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<Array<{
    id: string;
    username: string;
    role: 'admin' | 'user';
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerShowPassword, setRegisterShowPassword] = useState(false);
  const [registerIsLoading, setRegisterIsLoading] = useState(false);

  // Password change modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordChangeUserId, setPasswordChangeUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [passwordShowPassword, setPasswordShowPassword] = useState(false);
  const [passwordIsLoading, setPasswordIsLoading] = useState(false);

  const { toast } = useToast();

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await usersApi.getAll();
      if (response.data) {
        setUsers(response.data);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to fetch users',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Update user role
  const handleUpdateRole = async () => {
    if (!selectedUserId) return;

    try {
      const response = await usersApi.updateRole(selectedUserId, newRole);
      if (response.data?.message) {
        toast({
          title: 'Success',
          description: response.data.message,
        });
        // Update local state
        setUsers(prev =>
          prev.map(u =>
            u.id === selectedUserId ? { ...u, role: newRole } : u
          )
        );
        setSelectedUserId(null);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to update user role',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    setIsDeleting(true);
    try {
      const response = await usersApi.delete(deleteUserId);
      if (response.data?.success) {
        toast({
          title: 'Success',
          description: response.data.message || 'User deleted successfully',
        });
        // Remove from local state
        setUsers(prev => prev.filter(u => u.id !== deleteUserId));
        setDeleteUserId(null);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to delete user',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const { register: registerUser, clearError: clearAuthError } = useAuthStore();

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();

    if (!registerUsername.trim()) {
      toast({
        title: 'Error',
        description: 'Username is required',
        variant: 'destructive',
      });
      return;
    }

    if (registerUsername.trim().length < 3) {
      toast({
        title: 'Error',
        description: 'Username must be at least 3 characters',
        variant: 'destructive',
      });
      return;
    }

    const hasMinLength = registerPassword.length >= 6;
    const hasUppercase = /[A-Z]/.test(registerPassword);
    const hasNumber = /[0-9]/.test(registerPassword);
    const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

    if (!isPasswordValid) {
      toast({
        title: 'Error',
        description: 'Password does not meet requirements',
        variant: 'destructive',
      });
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    setRegisterIsLoading(true);
    const success = await registerUser(registerUsername.trim(), registerPassword);
    setRegisterIsLoading(false);

    if (success) {
      toast({
        title: 'Success',
        description: `User ${registerUsername.trim()} created successfully!`,
      });
      // Reset form and close modal
      setRegisterUsername('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
      setIsRegisterModalOpen(false);
      // Refresh user list
      fetchUsers();
    } else {
      // Error is already displayed by authStore
      setRegisterIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword) {
      toast({
        title: 'Error',
        description: 'Password is required',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      toast({
        title: 'Error',
        description: 'Password must contain an uppercase letter',
        variant: 'destructive',
      });
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      toast({
        title: 'Error',
        description: 'Password must contain a number',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== newConfirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (!passwordChangeUserId) return;

    setPasswordIsLoading(true);
    try {
      const response = await usersApi.updatePassword(passwordChangeUserId, newPassword);
      if (response.data?.message) {
        toast({
          title: 'Success',
          description: response.data.message,
        });
        // Reset and close modal
        setNewPassword('');
        setNewConfirmPassword('');
        setIsPasswordModalOpen(false);
        setPasswordChangeUserId(null);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to update password',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setPasswordIsLoading(false);
    }
  };

  // Initialize
  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Check if current user is admin
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <ShieldCheck className="mr-3 h-5 w-5" /> User Management
          </h1>
          <Button
            variant="outline"
            onClick={() => setIsRegisterModalOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add New User
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        )}

        {/* User table */}
        {!loading && users.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left w-20">Username</TableHead>
                  <TableHead className="text-left w-16">Role</TableHead>
                  <TableHead className="text-left w-28">Created At</TableHead>
                  <TableHead className="text-center w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell className="font-medium">{userItem.username}</TableCell>
                    <TableCell>
                      <Select
                        value={userItem.role}
                        onValueChange={(val) => {
                          setSelectedUserId(userItem.id);
                          setNewRole(val as 'admin' | 'user');
                        }}
                        disabled={selectedUserId && selectedUserId !== userItem.id}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={userItem.role === 'admin' ? 'Admin' : 'User'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(() => {
                        const [year, month, day] = userItem.createdAt.split('-');
                        return `${day}/${month}/${year}`;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      {!selectedUserId || selectedUserId === userItem.id ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUpdateRole}
                            disabled={loading}
                            className="mr-2"
                          >
                            Update Role
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPasswordChangeUserId(userItem.id);
                              setIsPasswordModalOpen(true);
                            }}
                            disabled={loading || userItem.id === user?.id}
                            className="mr-2"
                          >
                            <Key className="w-3 h-3 mr-1" /> Change Password
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeleteUserId(userItem.id);
                            }}
                            disabled={loading || isDeleting || userItem.id === user?.id}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(userItem.id);
                            setNewRole(userItem.role as 'admin' | 'user');
                          }}
                        >
                          Select
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty state */}
        {!loading && users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No users found.</p>
          </div>
        )}

        {/* Register User Modal */}
        {isRegisterModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="glass-card p-6 w-[500px] max-h-[90vh] overflow-y-auto animate-scale-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Add New User</h2>
              </div>
              <form onSubmit={handleRegisterSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="reg-username" className="text-sm font-medium">Username</label>
                    <Input
                      id="reg-username"
                      type="text"
                      placeholder="Enter username"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      autoComplete="username"
                      minLength={3}
                    />
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="reg-password" className="text-sm font-medium">Password</label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        type={registerShowPassword ? 'text' : 'password'}
                        placeholder="Enter password"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setRegisterShowPassword(!registerShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {registerShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="space-y-1 mt-2">
                      {[
                        { key: 'hasMinLength', label: 'At least 6 characters', test: registerPassword.length >= 6 },
                        { key: 'hasUppercase', label: 'Contains uppercase letter', test: /[A-Z]/.test(registerPassword) },
                        { key: 'hasNumber', label: 'Contains number', test: /[0-9]/.test(registerPassword) },
                      ].map((req) => (
                        <div key={req.key} className="flex items-center gap-2 text-xs">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            req.test
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <span className={req.test ? 'text-foreground' : 'text-muted-foreground'}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="reg-confirmPassword" className="text-sm font-medium">Confirm Password</label>
                    <Input
                      id="reg-confirmPassword"
                      type={registerShowPassword ? 'text' : 'password'}
                      placeholder="Repeat password"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8 pt-4 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsRegisterModalOpen(false);
                      setRegisterUsername('');
                      setRegisterPassword('');
                      setRegisterConfirmPassword('');
                      clearAuthError();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerIsLoading}
                  >
                    {registerIsLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Creating...
                      </>
                    ) : (
                      'Create User'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="glass-card p-6 w-[450px] max-h-[90vh] overflow-y-auto animate-scale-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Key className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Change Password</h2>
                  <p className="text-sm text-muted-foreground">
                    Set new password for user
                  </p>
                </div>
              </div>
              <form onSubmit={handlePasswordChange}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="new-password" className="text-sm font-medium">New Password</label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={passwordShowPassword ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordShowPassword(!passwordShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {passwordShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="space-y-1 mt-2">
                      {[
                        { key: 'hasMinLength', label: 'At least 6 characters', test: newPassword.length >= 6 },
                        { key: 'hasUppercase', label: 'Contains uppercase letter', test: /[A-Z]/.test(newPassword) },
                        { key: 'hasNumber', label: 'Contains number', test: /[0-9]/.test(newPassword) },
                      ].map((req) => (
                        <div key={req.key} className="flex items-center gap-2 text-xs">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            req.test
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <span className={req.test ? 'text-foreground' : 'text-muted-foreground'}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm-new-password" className="text-sm font-medium">Confirm New Password</label>
                    <Input
                      id="confirm-new-password"
                      type={passwordShowPassword ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={newConfirmPassword}
                      onChange={(e) => setNewConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8 pt-4 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setNewPassword('');
                      setNewConfirmPassword('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={passwordIsLoading}
                  >
                    {passwordIsLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteUserId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="glass-card p-6 w-96 animate-scale-in">
              <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
              <p className="mb-6 text-muted-foreground">
                Are you sure you want to delete this user? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteUserId(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete User'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
