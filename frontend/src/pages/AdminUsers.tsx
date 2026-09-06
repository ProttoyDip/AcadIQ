import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Trash2, Users } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { TableSkeleton } from "../components/ui/loading-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatDate } from "../lib/format";
import { adminService, ManagedUser } from "../services/adminService";
import { apiErrorMessage } from "../services/api";
import { useAuthStore } from "../store/authStore";

const usersKey = ["admin", "users"] as const;

export default function AdminUsers() {
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: usersKey, queryFn: adminService.listUsers });
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: ManagedUser["role"] }) =>
      adminService.updateRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
  const deleteUser = useMutation({
    mutationFn: adminService.deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
  const mutationError = updateRole.error ?? deleteUser.error;

  function confirmDelete(user: ManagedUser) {
    if (window.confirm(`Delete ${user.name}'s account? This cannot be undone.`)) deleteUser.mutate(user.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="User management" description="Review accounts and assign administrative access." />
      {mutationError && (
        <div role="alert" className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
          {apiErrorMessage(mutationError, "Could not update the user")}
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          {users.isLoading ? (
            <div className="p-5"><TableSkeleton rows={5} /></div>
          ) : users.isError ? (
            <div role="alert" className="p-6 text-small text-error">{apiErrorMessage(users.error, "Could not load users")}</div>
          ) : !users.data?.length ? (
            <EmptyState icon={Users} title="No users found" description="Registered users will appear here." className="border-0" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead><TableHead>Department</TableHead><TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead><TableHead className="w-16"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.map((user) => {
                  const isCurrentUser = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.facultyProfile?.department ?? "—"}</TableCell>
                      <TableCell>
                        {isCurrentUser ? (
                          <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />ADMIN</Badge>
                        ) : (
                          <Select value={user.role} disabled={updateRole.isPending}
                            onValueChange={(role: ManagedUser["role"]) => updateRole.mutate({ userId: user.id, role })}>
                            <SelectTrigger className="h-8 w-32" aria-label={`Role for ${user.name}`}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="FACULTY">Faculty</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-error"
                          disabled={isCurrentUser || deleteUser.isPending} aria-label={`Delete ${user.name}`}
                          title={isCurrentUser ? "You cannot delete your own account" : `Delete ${user.name}`}
                          onClick={() => confirmDelete(user)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
