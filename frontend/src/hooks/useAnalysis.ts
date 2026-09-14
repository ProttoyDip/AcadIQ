import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analysisService, CourseOutcomeInput } from "../services/analysisService";
import { reportKeys } from "./useReports";
import { ReliabilityMode } from "../types";

type PaperArgs = { courseId: number; questionPaperId: number; reliability?: ReliabilityMode };

export function useAnalyzeExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, questionPaperId, reliability }: PaperArgs) =>
      analysisService.analyzeExam(courseId, questionPaperId, reliability),
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
      reliability,
    }: {
      courseId: number;
      currentPaperId: number;
      previousPaperId: number;
      reliability?: ReliabilityMode;
    }) => analysisService.analyzeSimilarity(courseId, currentPaperId, previousPaperId, reliability),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useReviewQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, questionPaperId, reliability }: PaperArgs) =>
      analysisService.reviewQuestions(courseId, questionPaperId, reliability),
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
      reliability,
    }: PaperArgs & { courseOutcomes?: CourseOutcomeInput[] }) => analysisService.mapCourseOutcomes(courseId, questionPaperId, courseOutcomes, reliability),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useAnalyzeFull() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, questionPaperId }: { courseId: number; questionPaperId: number }) =>
      analysisService.analyzeFull(courseId, questionPaperId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  });
}
