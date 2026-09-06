import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courseService, CreateCoursePayload } from "../services/courseService";

export const courseKeys = {
  all: ["courses"] as const,
  detail: (id: number) => ["courses", id] as const,
};

export function useCourses() {
  return useQuery({ queryKey: courseKeys.all, queryFn: courseService.list });
}

export function useCourse(id: number | null) {
  return useQuery({
    queryKey: courseKeys.detail(id ?? 0),
    queryFn: () => courseService.getById(id as number),
    enabled: id !== null,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCoursePayload) => courseService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKeys.all }),
  });
}
