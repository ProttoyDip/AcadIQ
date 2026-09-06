import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analysisService, CourseOutcomeInput } from "../services/analysisService";
import { reportKeys } from "./useReports";

export function useAnalyzeExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, questionPaperId }: { courseId: number; questionPaperId: number }) =>
      analysisService.analyzeExam(courseId, questionPaperId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useAnalyzeSyllabus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, questionPaperId }: { courseId: number; questionPaperId: number }) =>
      analysisService.analyzeSyllabus(courseId, questionPaperId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useAnalyzeSimilarity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      currentPaperId,
      previousPaperId,
    }: {
      courseId: number;
      currentPaperId: number;
      previousPaperId: number;
    }) => analysisService.analyzeSimilarity(courseId, currentPaperId, previousPaperId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useReviewQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, questionPaperId }: { courseId: number; questionPaperId: number }) =>
      analysisService.reviewQuestions(courseId, questionPaperId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useMapCourseOutcomes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      questionPaperId,
      courseOutcomes,
    }: {
      courseId: number;
      questionPaperId: number;
      courseOutcomes?: CourseOutcomeInput[];
    }) => analysisService.mapCourseOutcomes(courseId, questionPaperId, courseOutcomes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}
