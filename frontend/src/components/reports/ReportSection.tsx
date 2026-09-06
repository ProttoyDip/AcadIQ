import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface ReportSectionProps {
  icon: LucideIcon;
  title: string;
  explanation: string;
  children: ReactNode;
}

export default function ReportSection({ icon: Icon, title, explanation, children }: ReportSectionProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50">
          <Icon className="h-4.5 w-4.5 text-primary-700" />
        </div>
        <div>
          <CardTitle className="text-body font-semibold">{title}</CardTitle>
          <p className="mt-0.5 text-small text-muted-foreground">{explanation}</p>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
