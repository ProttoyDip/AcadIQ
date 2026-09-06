import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";

function initials(name?: string) {
  if (!name) return "FA";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your AcadIQ profile and preferences." />

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Profile</CardTitle>
          <CardDescription>Your faculty account details.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-body">{initials(user?.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-body font-semibold text-foreground">{user?.name}</p>
              <Badge variant="secondary" className="mt-1">
                {user?.role === "ADMIN" ? "Administrator" : "Faculty"}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Full name</Label>
              <Input value={user?.name ?? ""} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
          </div>

          <div>
            <Button variant="outline" disabled>
              Edit profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Notifications</CardTitle>
          <CardDescription>Choose when AcadIQ should notify you about new analyses.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-small text-muted-foreground">Notification preferences are coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
