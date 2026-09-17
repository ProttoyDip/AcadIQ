import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Mail, Send } from "lucide-react";
import { scheduleService } from "../../services/scheduleService";
import { apiErrorMessage } from "../../services/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "am" : "pm"}` }));
const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ZONES: string[] = (() => {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  const common = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Karachi", "Asia/Kathmandu", "Asia/Colombo", "Asia/Singapore", "Asia/Dubai", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];
  return [...new Set([BROWSER_TZ, ...common, ...supported])];
})();

/** Daily briefing email: today's classes, unlogged classes, make-up debt, this week's assessments. */
export default function DigestSettingsCard() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const prefs = useQuery({ queryKey: ["digest", "prefs"], queryFn: scheduleService.digestPrefs });
  const preview = useQuery({ queryKey: ["digest", "preview"], queryFn: scheduleService.digestPreview, enabled: previewOpen });
  const update = useMutation({
    mutationFn: (payload: { digestEnabled?: boolean; digestHour?: number; timezone?: string | null }) => scheduleService.updateDigestPrefs(payload),
    onSuccess: () => {
      setMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["digest"] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, "Could not save")),
  });
  const send = useMutation({
    mutationFn: scheduleService.digestSendNow,
    onSuccess: (r) => setMessage(`Sent to ${r.to}: “${r.subject}”`),
    onError: (e) => setMessage(apiErrorMessage(e, "Could not send")),
  });
  const p = prefs.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body font-semibold"><Mail className="h-4 w-4 text-primary" /> Daily briefing email</CardTitle>
        <CardDescription>Every morning: today's classes with planned topics, classes you haven't logged, make-up debt and this week's assessments.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {p && !p.mailerConfigured && (
          <p className="rounded-lg border border-warning-border bg-warning-bg/40 p-2 text-xs text-warning">Email is not configured on this server (SMTP_USER / SMTP_PASS). You can still preview the briefing.</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_9rem_minmax(0,14rem)_minmax(0,1fr)] sm:items-end">
          <label className="flex items-center gap-2 text-small text-foreground">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={p?.digestEnabled ?? false} disabled={!p || update.isPending} onChange={(e) => update.mutate({ digestEnabled: e.target.checked })} />
            Send me the briefing
          </label>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">At</Label>
            <Select value={String(p?.digestHour ?? 7)} onValueChange={(v) => update.mutate({ digestHour: Number(v) })} disabled={!p}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Time zone</Label>
            <Select value={p?.timezone ?? "__server__"} onValueChange={(v) => update.mutate({ timezone: v === "__server__" ? null : v })} disabled={!p}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__server__">Server time{p?.serverTimezone ? ` (${p.serverTimezone})` : ""}</SelectItem>
                {ZONES.map((z) => <SelectItem key={z} value={z}>{z}{z === BROWSER_TZ ? " · this device" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4" /> Preview</Button>
            <Button size="sm" variant="outline" onClick={() => send.mutate()} disabled={send.isPending || !p?.mailerConfigured}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test now
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Goes to {p?.email ?? "your account email"}{p?.digestLastSent ? ` · last sent ${p.digestLastSent}` : ""}. {p?.timezone ? `Your time in ${p.timezone}.` : "Uses the server's clock until you pick a time zone."}
        </p>
        {message && <p className="text-xs text-foreground">{message}</p>}
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview.data?.subject ?? "Briefing preview"}</DialogTitle>
            <DialogDescription>Exactly what the email will contain for today.</DialogDescription>
          </DialogHeader>
          {preview.isLoading && <p className="text-xs text-muted-foreground">Building…</p>}
          {preview.data && <iframe title="Digest preview" srcDoc={preview.data.html} className="h-[60vh] w-full rounded-lg border border-border bg-white" sandbox="" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
