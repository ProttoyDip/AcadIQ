import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { copilotService, CopilotChatPayload } from "../services/copilotService";

export const copilotKeys = {
  sessions: (courseId?: number) => ["copilot", "sessions", courseId ?? "all"] as const,
  session: (id: number) => ["copilot", "session", id] as const,
};

export function useCopilotSessions(courseId?: number) {
  return useQuery({ queryKey: copilotKeys.sessions(courseId), queryFn: () => copilotService.listSessions(courseId) });
}

export function useCopilotSession(id: number | null) {
  return useQuery({
    queryKey: copilotKeys.session(id ?? 0),
    queryFn: () => copilotService.getSession(id as number),
    enabled: id !== null,
  });
}

export function useCopilotChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CopilotChatPayload) => copilotService.chat(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: copilotKeys.session(data.sessionId) });
      queryClient.invalidateQueries({ queryKey: copilotKeys.sessions(data.courseId) });
    },
  });
}
