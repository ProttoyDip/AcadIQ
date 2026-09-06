import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadService } from "../services/uploadService";
import { courseKeys } from "./useCourses";

export function useUploadSyllabus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, file }: { courseId: number; file: File }) =>
      uploadService.uploadSyllabus(courseId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
    },
  });
}

export function useUploadQuestionPaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      year,
      semester,
      file,
    }: {
      courseId: number;
      year: number;
      semester: string;
      file: File;
    }) => uploadService.uploadQuestionPaper(courseId, year, semester, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
    },
  });
}
