import { useQuery, useQueryClient } from "@tanstack/react-query";
import { reportService } from "../services/reportService";

export const reportKeys = {
  all: ["reports"] as const,
  detail: (id: number) => ["reports", id] as const,
};

export function useReports() {
  return useQuery({ queryKey: reportKeys.all, queryFn: reportService.list });
}

export function useReport(id: number | null) {
  return useQuery({
    queryKey: reportKeys.detail(id ?? 0),
    queryFn: () => reportService.getById(id as number),
    enabled: id !== null,
  });
}

export function useInvalidateReports() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: reportKeys.all });
}
