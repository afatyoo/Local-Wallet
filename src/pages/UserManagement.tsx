import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usersApi } from '@/lib/api';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Trash2, UserPlus, ShieldCheck } from 'lucide-react';

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
  const { toast } = useToast();

  // Fetch all users
  const fetchUsers = async () => {
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
  };

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

  // Initialize
  useEffect(() => {
    fetchUsers();
  }, []);

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
            onClick={() => setSelectedUserId(null)}
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add New User (via Register)
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
                  <TableHead className="text-left w-20">Created At</TableHead>
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
                      {new Date(userItem.createdAt).toLocaleDateString('id-ID')}
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

        {/* Delete confirmation modal */}
        {deleteUserId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
              <p className="mb-6">
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