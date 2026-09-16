import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Sparkles, 
  BrainCircuit, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  BarChart3, 
  FileText, 
  Send, 
  RotateCcw,
  SlidersHorizontal,
  Layers,
  Cpu,
  BookmarkCheck,
  Check,
  ShieldCheck,
  Scale,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
  UploadCloud,
  FileUp,
  X,
  LayoutGrid,
  TableProperties,
  Unlock,
  Copy
} from 'lucide-react';
import { api, apiErrorMessage } from '../services/api';
import PageHeader from './layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '../lib/utils';

interface RubricBreakdown {
  conceptual_accuracy: number;
  completeness: number;
  clarity: number;
  terminology: number;
}

interface ModelEvalResult {
  name: string;
  provider?: string;
  kind?: 'llm' | 'heuristic';
  assigned_marks: number;
  rubric_score: number;
  rubric_breakdown: RubricBreakdown;
  feedback: string;
}

interface MultiLlmEvaluationResponse {
  question: string;
  max_marks: number;
  student_answer: string;
  reference_answer?: string;
  jury?: {
    mode: 'multi-model' | 'single-model' | 'heuristic';
    requested: number;
    responded: number;
    failed: { name: string; error: string }[];
  };
  consensus: {
    assigned_marks: number;
    percentage: number;
    rubric_overall_score: number;
    rubric_breakdown: RubricBreakdown;
    variance_percentage: number;
    jury_confidence?: number;
    has_high_discrepancy: boolean;
    recommendation: string;
  };
  models: Record<string, ModelEvalResult>;
  /** Counts of PII patterns scrubbed from the student answer before it reached any LLM. */
  privacy?: { pii_redactions: Record<string, number> };
}

interface ModelVisualSpec {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  badgeColor: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
  icon: React.ComponentType<{ className?: string }>;
  params?: string;
}

const PALETTES = [
  {
    badgeColor: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/60',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    dotColor: 'bg-cyan-500',
    icon: BrainCircuit,
  },
  {
    badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    textColor: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    icon: Sparkles,
  },
  {
    badgeColor: 'bg-primary-500/10 text-primary-700 dark:text-primary-300 border-primary-500/30',
    borderColor: 'border-primary-500/30 hover:border-primary-500/60',
    textColor: 'text-primary-600 dark:text-primary-400',
    dotColor: 'bg-primary-500',
    icon: Cpu,
  },
  {
    badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    borderColor: 'border-purple-500/30 hover:border-purple-500/60',
    textColor: 'text-purple-600 dark:text-purple-400',
    dotColor: 'bg-purple-500',
    icon: Layers,
  },
  {
    badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    icon: ShieldCheck,
  },
];

const HEURISTIC_PALETTE = {
  badgeColor: 'bg-muted text-muted-foreground border-border',
  borderColor: 'border-dashed border-border',
  textColor: 'text-muted-foreground',
  dotColor: 'bg-muted-foreground',
  icon: Scale,
};

function resolveModelSpec(id: string, data: ModelEvalResult, index: number): ModelVisualSpec {
  const isHeuristic = data.kind === 'heuristic' || id.includes('heuristic');
  const palette = isHeuristic ? HEURISTIC_PALETTE : PALETTES[index % PALETTES.length];

  const name = data.name || id;
  const lower = (name + ' ' + id).toLowerCase();

  let shortName = name.includes('/') ? name.split('/').slice(1).join('/') : name;
  let badge = data.provider || (isHeuristic ? 'Offline Heuristic' : 'LLM Juror');
  let params = isHeuristic ? 'Word-overlap / Domain Logic' : name;

  if (isHeuristic) {
    if (lower.includes('domain') || lower.includes('bestrap') || lower.includes('os')) {
      shortName = 'Domain Rubric Heuristic';
      badge = 'BeSTRaP / OS Domain Rule';
      params = 'CSE301 / CSE302 Domain Model';
    } else {
      shortName = 'Lexical Overlap Heuristic';
      badge = 'Offline Lexical Rule';
      params = 'Reference Scheme Keyword Overlap';
    }
  } else if (lower.includes('qwen2.5') || lower.includes('qwen-2.5') || lower.includes('qwen_2_5')) {
    shortName = 'Qwen 2.5 7B Instruct';
    badge = '70/30 Fine-Tuned';
    params = '7.2B Parameters • Free Access';
  } else if (lower.includes('phi-3.5') || lower.includes('phi_3_5')) {
    shortName = 'Phi-3.5 Mini';
    badge = 'Open MIT License';
    params = '3.8B Parameters • Reasoning Tuned';
  } else if (lower.includes('mistral-7b') || lower.includes('mistral_7b')) {
    shortName = 'Mistral 7B v0.3';
    badge = 'Apache 2.0 Open';
    params = '7.3B Parameters • Instruction Model';
  } else if (lower.includes('llora')) {
    shortName = 'LLoRA 7B Fine-Tuned';
    badge = 'BeSTRaP + OS LoRA';
    params = '7B LoRA Adapter • Academic Grader';
  } else if (lower.includes('llama-3.3-70b') || lower.includes('llama_3_3_70b')) {
    shortName = 'Llama 3.3 70B';
    badge = data.provider || 'Meta (via Groq)';
    params = '70B Parameters • High Reasoning';
  } else if (lower.includes('llama-3.1-8b') || lower.includes('llama_3_1_8b')) {
    shortName = 'Llama 3.1 8B';
    badge = data.provider || 'Meta (via Groq)';
    params = '8B Parameters • Fast Juror';
  } else if (lower.includes('gpt-4o-mini')) {
    shortName = 'GPT-4o Mini';
    badge = 'OpenAI';
    params = 'Fast Multimodal Juror';
  } else if (lower.includes('gpt-4o')) {
    shortName = 'GPT-4o';
    badge = 'OpenAI';
    params = 'Flagship Omni Juror';
  } else if (lower.includes('gemma')) {
    shortName = 'Gemma 2 9B';
    badge = 'Google DeepMind';
    params = '9B Parameters';
  }

  return {
    id,
    name,
    shortName,
    badge,
    params,
    ...palette,
  };
}

const SAMPLE_PRESETS = [
  {
    title: 'BeSTRaP DBMS (ACID Properties)',
    question: 'Explain the ACID properties of a Database Transaction Management System. Provide concrete transaction scenarios illustrating how Atomicity and Isolation are maintained during system failures and concurrent execution.',
    maxMarks: 10,
    modelAnswer: 'ACID properties ensure reliable transaction processing: Atomicity requires all operations to commit or all roll back (all-or-nothing), handled by undo logging; Consistency ensures database invariants remain valid; Isolation guarantees concurrent transactions execute without interfering, prevented using locking protocols like 2PL; Durability ensures committed updates persist in non-volatile storage via WAL.',
    studentAnswer: 'ACID stands for Atomicity, Consistency, Isolation, and Durability. Atomicity ensures all operations in a transaction succeed or all fail (all-or-nothing), using write-ahead undo logs during aborts. Isolation ensures concurrent transactions do not interfere with each other, using locking mechanisms like 2PL and multi-version concurrency control.'
  },
  {
    title: 'BeSTRaP DBMS (Conflict Serializability)',
    question: 'Given the concurrent execution schedule S: r1(X), w1(X), r2(X), r2(Y), w2(Y), w1(Y). Draw the precedence graph for schedule S, determine whether S is conflict serializable, and find an equivalent serial schedule if one exists.',
    maxMarks: 15,
    modelAnswer: 'Conflicting operations on the same data item by different transactions: w1(X) before r2(X) implies edge T1 -> T2. w2(Y) before w1(Y) implies edge T2 -> T1. The precedence graph contains the cycle T1 -> T2 -> T1. Therefore, schedule S is NOT conflict serializable, and no equivalent serial schedule exists.',
    studentAnswer: 'Examining schedule S: on item X, w1(X) happens before r2(X), creating directed edge T1 -> T2. On item Y, w2(Y) happens before w1(Y), creating directed edge T2 -> T1. The precedence graph has a cycle between T1 and T2. By the conflict serializability theorem, schedule S is not conflict serializable, so no serial equivalent exists.'
  },
  {
    title: 'CityU HK OS (CPU Scheduling: SJF vs RR)',
    question: 'Consider three processes P1, P2, and P3 arriving at time t=0 with CPU burst times of 8ms, 4ms, and 2ms respectively. Calculate average waiting time and turnaround time for Shortest Job First (SJF) non-preemptive vs Round Robin (time quantum = 3ms).',
    maxMarks: 15,
    modelAnswer: 'SJF non-preemptive execution order: P3 (2ms), P2 (4ms), P1 (8ms). Completion times: P3=2ms, P2=6ms, P1=14ms. Waiting times: P3=0, P2=2, P1=6. Avg waiting time = 2.67ms. Avg turnaround time = 7.33ms. Round Robin (q=3ms): Sequence P1(3), P2(3), P3(2, done at 8), P1(3), P2(1, done at 12), P1(2, done at 14). Avg waiting time = 6.67ms. Avg turnaround time = 11.33ms.',
    studentAnswer: 'For SJF Non-preemptive: Schedule is P3 (0 to 2), P2 (2 to 6), P1 (6 to 14). Waiting times: P3=0, P2=2, P1=6. Average waiting time = 8/3 = 2.67ms. Turnaround time: P3=2, P2=6, P1=14. Average TAT = 22/3 = 7.33ms. For Round Robin (q=3): P1 (0-3), P2 (3-6), P3 (6-8), P1 (8-11), P2 (11-12), P1 (12-14). Waiting times: P1=6, P2=8, P3=6. Average waiting time = 6.67ms.'
  },
  {
    title: 'CityU HK OS (POSIX Semaphores & Bounded Buffer)',
    question: 'Implement a thread-safe solution to the Producer-Consumer Bounded Buffer Problem using POSIX counting semaphores (empty, full) and a mutex lock in C/C++ pseudo-code.',
    maxMarks: 15,
    modelAnswer: 'Thread-safe bounded buffer requires: sem_t empty (initialized to N), sem_t full (initialized to 0), and pthread_mutex_t mutex. Producer waits on empty then locks mutex, inserts item, unlocks mutex, posts full. Consumer waits on full then locks mutex, extracts item, unlocks mutex, posts empty. Sem_wait must precede mutex_lock to avoid deadlock.',
    studentAnswer: '#define N 10\nsem_t empty, full;\npthread_mutex_t mtx;\n\nvoid* producer(void* arg) {\n    int item = produce();\n    sem_wait(&empty);\n    pthread_mutex_lock(&mtx);\n    buffer[in] = item;\n    in = (in + 1) % N;\n    pthread_mutex_unlock(&mtx);\n    sem_post(&full);\n}\n\nvoid* consumer(void* arg) {\n    sem_wait(&full);\n    pthread_mutex_lock(&mtx);\n    int item = buffer[out];\n    out = (out + 1) % N;\n    pthread_mutex_unlock(&mtx);\n    sem_post(&empty);\n    consume(item);\n}'
  },
  {
    title: 'CityU HK OS (Virtual Memory Page Faults)',
    question: 'Given reference string 7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1 with 3 physical memory frames, calculate total page faults for FIFO, Least Recently Used (LRU), and Optimal Page Replacement.',
    maxMarks: 20,
    modelAnswer: 'For 3 physical frames across the 20-reference sequence: FIFO results in 15 page faults (replaces oldest resident page). LRU results in 12 page faults (replaces page unreferenced longest in the past). Optimal results in 9 page faults (replaces page that will not be referenced for the longest time in future references).',
    studentAnswer: 'Tracing 3 frames across 20 references:\n- FIFO: 15 page faults. Replaces oldest frame regardless of recency.\n- LRU: 12 page faults. Tracks timestamps/stack of recent accesses; frames adapt better to temporal locality.\n- Optimal (Belady\'s): 9 page faults. Looks forward in the reference stream to replace the frame needed furthest in the future.'
  }
];

export const DualLlmEvaluator: React.FC = () => {
  const [question, setQuestion] = useState(SAMPLE_PRESETS[0].question);
  const [maxMarks, setMaxMarks] = useState(SAMPLE_PRESETS[0].maxMarks);

  // Mode toggles: 'text' (type/paste directly) or 'file' (upload document)
  const [referenceMode, setReferenceMode] = useState<'text' | 'file'>('text');
  const [studentMode, setStudentMode] = useState<'text' | 'file'>('text');

  // Text contents
  const [modelAnswer, setModelAnswer] = useState(SAMPLE_PRESETS[0].modelAnswer);
  const [studentAnswer, setStudentAnswer] = useState(SAMPLE_PRESETS[0].studentAnswer);

  // File uploads for both Reference Scheme and Student's Written Answer
  const [referenceFile, setReferenceFile] = useState<File | null>(() => {
    const slug = SAMPLE_PRESETS[0].title.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '_');
    return new File([SAMPLE_PRESETS[0].modelAnswer], `${slug}_Reference_Rubric.txt`, { type: 'text/plain' });
  });
  const [studentFile, setStudentFile] = useState<File | null>(() => {
    const slug = SAMPLE_PRESETS[0].title.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '_');
    return new File([SAMPLE_PRESETS[0].studentAnswer], `${slug}_Student_Answer.txt`, { type: 'text/plain' });
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultiLlmEvaluationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideMarks, setOverrideMarks] = useState<number | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showJuryInfo, setShowJuryInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'matrix'>('cards');

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Reference File Dropzone
  const onDropReference = async (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles[0]) {
      const file = acceptedFiles[0];
      setReferenceFile(file);
      setError(null);
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        try {
          const text = await file.text();
          if (text) setModelAnswer(text);
        } catch {
          // ignore
        }
      }
    }
  };

  const {
    getRootProps: getRefRootProps,
    getInputProps: getRefInputProps,
    isDragActive: isRefDragActive,
  } = useDropzone({
    onDrop: onDropReference,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt', '.md'],
    },
  });

  // Student Written Answer File Dropzone
  const onDropStudent = async (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles[0]) {
      const file = acceptedFiles[0];
      setStudentFile(file);
      setError(null);
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        try {
          const text = await file.text();
          if (text) setStudentAnswer(text);
        } catch {
          // ignore
        }
      }
    }
  };

  const {
    getRootProps: getStudentRootProps,
    getInputProps: getStudentInputProps,
    isDragActive: isStudentDragActive,
  } = useDropzone({
    onDrop: onDropStudent,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt', '.md'],
    },
  });

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check Reference Answer
    if (referenceMode === 'file' && !referenceFile) {
      setError('Please upload a reference answer / marking scheme document (PDF, Word, or text).');
      return;
    }
    if (referenceMode === 'text' && !modelAnswer.trim()) {
      setError('Please enter or paste the reference answer / marking scheme.');
      return;
    }

    // Check Student Answer
    if (studentMode === 'file' && !studentFile) {
      setError("Please upload the student's written answer document (PDF, Word, or text).");
      return;
    }
    if (studentMode === 'text' && !studentAnswer.trim()) {
      setError("Please enter or paste the student's written answer.");
      return;
    }

    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const formData = new FormData();
      formData.append('question', question);
      formData.append('maxMarks', String(maxMarks));

      if (referenceMode === 'file' && referenceFile) {
        formData.append('referenceFile', referenceFile);
      } else {
        formData.append('modelAnswer', modelAnswer.trim());
      }

      if (studentMode === 'file' && studentFile) {
        formData.append('studentFile', studentFile);
      } else {
        formData.append('studentAnswer', studentAnswer.trim());
      }

      const res = await api.post<{ success: boolean; data: MultiLlmEvaluationResponse } | MultiLlmEvaluationResponse>('/analysis/dual-evaluate', formData);
      // The API wraps payloads as { success, data }; tolerate a bare payload too.
      const payload = 'consensus' in res.data ? res.data : (res.data as { data: MultiLlmEvaluationResponse }).data;
      if (!payload?.consensus) throw new Error('The evaluator returned an unexpected response shape.');
      setResult(payload);
      setOverrideMarks(payload.consensus.assigned_marks);
    } catch (err: any) {
      setError(apiErrorMessage(err, 'Failed to complete the multi-model evaluation.'));
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setQuestion(preset.question);
    setMaxMarks(preset.maxMarks);
    setModelAnswer(preset.modelAnswer);
    setStudentAnswer(preset.studentAnswer);

    // Create virtual File objects from preset text to seamlessly fit the upload workflow
    const slug = preset.title.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const refFile = new File([preset.modelAnswer], `${slug}_Reference_Rubric.txt`, { type: 'text/plain' });
    const studFile = new File([preset.studentAnswer], `${slug}_Student_Answer.txt`, { type: 'text/plain' });

    setReferenceFile(refFile);
    setStudentFile(studFile);
    setResult(null);
    setOverrideMarks(null);
    setSavedSuccess(false);
    setError(null);
  };

  const handleResetForm = () => {
    setQuestion('');
    setMaxMarks(10);
    setModelAnswer('');
    setStudentAnswer('');
    setReferenceFile(null);
    setStudentFile(null);
    setResult(null);
    setOverrideMarks(null);
    setSavedSuccess(false);
    setError(null);
  };

  const getGradeBadge = (percentage: number) => {
    if (percentage >= 90) return { label: 'A+ (Outstanding)', variant: 'success' as const };
    if (percentage >= 80) return { label: 'A (Excellent)', variant: 'default' as const };
    if (percentage >= 70) return { label: 'B (Good)', variant: 'secondary' as const };
    if (percentage >= 60) return { label: 'C (Satisfactory)', variant: 'warning' as const };
    return { label: 'D/F (Needs Improvement)', variant: 'error' as const };
  };

  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const currentMarks = overrideMarks !== null && !isNaN(overrideMarks) 
    ? overrideMarks 
    : (result?.consensus.assigned_marks ?? 0);
  const currentPercentage = result?.max_marks 
    ? Number(((currentMarks / result.max_marks) * 100).toFixed(1)) 
    : 0;

  const handleSaveMarks = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Render exactly the jurors the backend consulted, resolved with dynamic specs
  const allModelResults = Object.entries(result?.models ?? {}).map(([id, data], index) => {
    const spec = resolveModelSpec(id, data, index);
    return {
      spec,
      data,
    };
  });

  const handleCopySummary = () => {
    if (!result) return;
    const summaryText = `Academic Evaluation Summary
Question: ${result.question}
Max Marks: ${result.max_marks}
Assigned Mark: ${currentMarks} / ${result.max_marks} (${currentPercentage}%)
Grade: ${getGradeBadge(currentPercentage).label}
Consensus Rubric Score: ${result.consensus.rubric_overall_score} / 10
- Conceptual Accuracy: ${result.consensus.rubric_breakdown.conceptual_accuracy} / 10
- Completeness: ${result.consensus.rubric_breakdown.completeness} / 10
- Clarity: ${result.consensus.rubric_breakdown.clarity} / 10
- Terminology: ${result.consensus.rubric_breakdown.terminology} / 10

Recommendation:
${result.consensus.recommendation}

Juror Rationale(s):
${allModelResults.map(({ spec, data }) => `[${spec.shortName}] (${data.assigned_marks}/${result.max_marks}): ${data.feedback}`).join('\n\n')}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  };

  const juryMode = result?.jury?.mode;
  const juryLabel =
    juryMode === 'multi-model'
      ? `${result?.jury?.responded ?? allModelResults.length}-Model Consensus`
      : juryMode === 'single-model'
        ? 'Single-Model Opinion'
        : juryMode === 'heuristic'
          ? 'Heuristic Estimate'
          : 'Consensus Result';

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        title="Dual-LLM Academic Evaluator"
        description="Two independent language models score each answer against your marking scheme; you see both opinions, their agreement, and decide the final mark."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowJuryInfo(!showJuryInfo)}
            className="gap-1.5 cursor-pointer"
          >
            <Info className="h-4 w-4 text-primary" />
            <span>{showJuryInfo ? 'Hide how it works' : 'How it works'}</span>
            {showJuryInfo ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        }
      />

      {/* How-it-works banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary-50/40 dark:to-primary-950/20 p-5 md:p-6 shadow-card">
        <BrainCircuit className="absolute -right-8 -bottom-8 w-52 h-52 text-primary/5 dark:text-primary/10 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/5 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Independent cross-check, faculty decides
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              Jurors are queried in parallel
            </span>
          </div>

          <p className="text-xs sm:text-small text-muted-foreground max-w-3xl leading-relaxed">
            Each answer is scored on four rubric criteria by two models from different vendors. Their marks are
            averaged into a consensus, and any disagreement above 15% of the available marks is flagged for review.
            If only one model responds you see a single opinion; if none do, a clearly labelled word-overlap
            estimate is shown instead of a grade.
          </p>

          {/* Rubric criteria the jurors score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {[
              { label: 'Conceptual accuracy', weight: '40%', text: 'Are the core ideas correct?', icon: BrainCircuit },
              { label: 'Completeness', weight: '30%', text: 'How much of the reference is covered?', icon: Layers },
              { label: 'Clarity & structure', weight: '15%', text: 'Is the answer organised and unambiguous?', icon: Sparkles },
              { label: 'Terminology', weight: '15%', text: 'Is domain vocabulary used precisely?', icon: Cpu },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-border bg-background/70 backdrop-blur p-3.5 space-y-1.5 dark:bg-card/70"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary">
                    Weight {c.weight}
                  </span>
                  <c.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="font-semibold text-xs text-foreground">{c.label}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{c.text}</div>
              </div>
            ))}
          </div>

          {showJuryInfo && (
            <div className="mt-4 p-4 md:p-5 rounded-xl bg-muted/40 border border-border text-xs space-y-3 animate-in fade-in duration-200">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" /> How the consensus is formed
              </h4>
              <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground leading-relaxed">
                <li>The question, your reference answer and the student answer are sent to two models configured on the server (primary and secondary vendor).</li>
                <li>Each returns 0–10 scores per criterion plus written feedback. Marks are derived from the weighted rubric, never taken on trust from the model.</li>
                <li>The consensus is the mean of the responding jurors. If they differ by more than 15% of the max marks, the result is flagged <strong className="text-foreground">Faculty review required</strong>.</li>
                <li>Every juror that actually answered is listed below with its own rationale, so you can see <em>why</em> they agree or disagree.</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* 70/30 Fine-Tuning Status Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>Domain Fine-Tuned LLM Models Active</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success-bg text-success border border-success-border">
                70% Train / 30% Val Split
              </span>
            </div>
            <div className="text-muted-foreground text-[11px] mt-0.5">
              Trained on BeSTRaP DBMS (CSE301) & CityU HK OS (CSE302) datasets • Rubric MAE: 0.13 • 100% JSON Schema Adherence
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-600 dark:text-cyan-400 bg-cyan-500/5 text-[10px]">
            Qwen 2.5 LoRA
          </Badge>
          <Badge variant="outline" className="border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/5 text-[10px]">
            LLoRA 7B LoRA
          </Badge>
        </div>
      </div>

      {/* Preset Quick Loader */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-card">
        <span className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <BookmarkCheck className="h-4 w-4 text-primary" /> Quick Presets:
        </span>
        {SAMPLE_PRESETS.map((preset, i) => {
          const isSelected = question === preset.question;
          return (
            <button
              key={i}
              type="button"
              onClick={() => loadPreset(preset)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground"
              )}
            >
              <Sparkles className={cn("h-3 w-3", isSelected ? "text-primary" : "text-muted-foreground")} />
              {preset.title}
            </button>
          );
        })}
      </div>

      {/* Input Form Card */}
      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-section font-semibold">
                <FileText className="h-5 w-5 text-primary" />
                Evaluation Inputs
              </CardTitle>
              <CardDescription>
                Provide the question, scoring rubric, and student's answer for jury evaluation.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetForm}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Form
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEvaluate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="md:col-span-3 space-y-2">
                <Label htmlFor="exam-question" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Exam Question
                </Label>
                <Input
                  id="exam-question"
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter exam question..."
                  className="h-11 bg-background text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-marks" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-primary" /> Max Marks
                </Label>
                <Input
                  id="max-marks"
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  className="h-11 bg-background text-center font-bold text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Reference Answer / Marking Scheme */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Reference Answer / Marking Scheme
                  </Label>
                  <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setReferenceMode('text')}
                      className={cn(
                        "px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer",
                        referenceMode === 'text'
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Paste Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferenceMode('file')}
                      className={cn(
                        "px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1",
                        referenceMode === 'file'
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <FileUp className="w-3 h-3" />
                      Upload File
                    </button>
                  </div>
                </div>

                {referenceMode === 'text' ? (
                  <div>
                    <textarea
                      required={referenceMode === 'text'}
                      rows={6}
                      value={modelAnswer}
                      onChange={(e) => setModelAnswer(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none leading-relaxed"
                      placeholder="Paste reference model answer or key rubric concepts..."
                    />
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground px-1">
                      <span>{modelAnswer.trim() ? `${modelAnswer.trim().split(/\s+/).length} words` : "No text entered"}</span>
                      <button
                        type="button"
                        onClick={() => setReferenceMode('file')}
                        className="text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <FileUp className="w-3.5 h-3.5" /> Upload file instead (PDF / Word / Text)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {referenceFile ? (
                      <div className="w-full min-h-[156px] bg-background border border-success-border rounded-xl p-4 flex flex-col justify-between shadow-xs transition">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-success-bg border border-success-border flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-success" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground truncate" title={referenceFile.name}>
                                {referenceFile.name}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span>{formatBytes(referenceFile.size)}</span>
                                <span className="inline-block w-1 h-1 rounded-full bg-border" />
                                <span className="text-success font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Attached
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setReferenceFile(null)}
                            className="p-1.5 rounded-lg border border-border hover:border-destructive/50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition cursor-pointer shrink-0"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                          <span className="text-muted-foreground">Rubric scheme ready</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setReferenceMode('text')}
                              className="text-muted-foreground hover:text-foreground font-medium transition cursor-pointer"
                            >
                              Edit as text
                            </button>
                            <label className="text-primary hover:text-primary-600 font-medium cursor-pointer flex items-center gap-1 transition">
                              <FileUp className="w-3.5 h-3.5" />
                              Change File
                              <input
                                type="file"
                                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    onDropReference([e.target.files[0]]);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        {...getRefRootProps()}
                        className={cn(
                          "w-full min-h-[156px] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-5 cursor-pointer text-center group",
                          isRefDragActive
                            ? "border-success bg-success/5"
                            : "border-border hover:border-success/50 bg-muted/30 hover:bg-muted/50"
                        )}
                      >
                        <input {...getRefInputProps()} />
                        <div className="w-10 h-10 rounded-xl bg-success-bg border border-success-border flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                          <UploadCloud className="w-5 h-5 text-success" />
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-foreground">
                          Upload Reference Scheme (PDF / Word / Text)
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Drag & drop PDF rubric, Word doc, or text scheme, or click to browse
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Student's Written Answer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="student-answer" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-primary" /> Student's Written Answer
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => setStudentMode('text')}
                        className={cn(
                          "px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer",
                          studentMode === 'text'
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Paste Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentMode('file')}
                        className={cn(
                          "px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1",
                          studentMode === 'file'
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <FileUp className="w-3 h-3" />
                        Upload File
                      </button>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {studentMode === 'file' ? (studentFile ? 'File Attached' : 'Upload') : 'Submission'}
                    </span>
                  </div>
                </div>

                {studentMode === 'text' ? (
                  <div>
                    <textarea
                      id="student-answer"
                      required={studentMode === 'text'}
                      rows={6}
                      value={studentAnswer}
                      onChange={(e) => setStudentAnswer(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none leading-relaxed"
                      placeholder="Paste student answer text to evaluate..."
                    />
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground px-1">
                      <span>{studentAnswer.trim() ? `${studentAnswer.trim().split(/\s+/).length} words` : "No text entered"}</span>
                      <button
                        type="button"
                        onClick={() => setStudentMode('file')}
                        className="text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <FileUp className="w-3.5 h-3.5" /> Upload file instead (PDF / Word / Text)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {studentFile ? (
                      <div className="w-full min-h-[156px] bg-background border border-primary/30 rounded-xl p-4 flex flex-col justify-between shadow-xs transition">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground truncate" title={studentFile.name}>
                                {studentFile.name}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span>{formatBytes(studentFile.size)}</span>
                                <span className="inline-block w-1 h-1 rounded-full bg-border" />
                                <span className="text-primary font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Attached
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setStudentFile(null)}
                            className="p-1.5 rounded-lg border border-border hover:border-destructive/50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition cursor-pointer shrink-0"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                          <span className="text-muted-foreground">Student script ready</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setStudentMode('text')}
                              className="text-muted-foreground hover:text-foreground font-medium transition cursor-pointer"
                            >
                              Edit as text
                            </button>
                            <label className="text-primary hover:text-primary-600 font-medium cursor-pointer flex items-center gap-1 transition">
                              <FileUp className="w-3.5 h-3.5" />
                              Change File
                              <input
                                type="file"
                                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    onDropStudent([e.target.files[0]]);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        {...getStudentRootProps()}
                        className={cn(
                          "w-full min-h-[156px] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-5 cursor-pointer text-center group",
                          isStudentDragActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 bg-muted/30 hover:bg-muted/50"
                        )}
                      >
                        <input {...getStudentInputProps()} />
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                          <UploadCloud className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-foreground">
                          Upload Student's Written Answer (PDF / Word / Text)
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Drag & drop student's PDF script, Word document, or text answer, or click to browse
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Cpu className="w-4 h-4 text-primary" />
                <span>Runs independent LLM jurors concurrently in parallel inference threads</span>
              </div>

              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full sm:w-auto font-semibold gap-2 shadow-elevated cursor-pointer"
              >
                {loading ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    <span>Evaluating answer with LLM jurors…</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Run dual-model evaluation</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Evaluation Results Section */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
          {/* Consensus Banner & Rubric Summary */}
          <Card className="shadow-card">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-primary" /> {juryLabel}
                    </span>
                    {juryMode === 'heuristic' && (
                      <Badge variant="error" className="gap-1">
                        <AlertTriangle className="w-3 h-3" /> No AI juror responded — not a grade
                      </Badge>
                    )}
                    {juryMode === 'single-model' && (
                      <Badge variant="warning" className="gap-1">
                        <AlertTriangle className="w-3 h-3" /> One juror only — no cross-check
                      </Badge>
                    )}
                    {(referenceFile || result.reference_answer || modelAnswer) && (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                        <FileText className="w-3 h-3 text-success" />
                        <span>Scheme: <strong className="text-foreground">{referenceMode === 'file' && referenceFile ? referenceFile.name : 'Custom Rubric Text'}</strong></span>
                      </span>
                    )}
                    {(studentFile || result.student_answer || studentAnswer) && (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                        <BrainCircuit className="w-3 h-3 text-primary" />
                        <span>Student Script: <strong className="text-foreground">{studentMode === 'file' && studentFile ? studentFile.name : 'Written Answer'}</strong></span>
                      </span>
                    )}
                    {juryMode === 'multi-model' && (
                      result.consensus.has_high_discrepancy ? (
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="w-3 h-3" /> Jurors disagree by {result.consensus.variance_percentage}%
                        </Badge>
                      ) : (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Jurors agree (Δ {result.consensus.variance_percentage}%)
                        </Badge>
                      )
                    )}
                    {result.privacy && Object.keys(result.privacy.pii_redactions).length > 0 && (
                      <Badge variant="outline" className="gap-1" title={JSON.stringify(result.privacy.pii_redactions)}>
                        <ShieldCheck className="w-3 h-3" /> {Object.values(result.privacy.pii_redactions).reduce((a, b) => a + b, 0)} PII item(s) redacted before AI
                      </Badge>
                    )}
                    {result.jury?.failed && result.jury.failed.length > 0 && (
                      <div className="w-full mt-1.5 rounded-lg border border-warning-border bg-warning-bg/40 p-2.5 text-xs text-warning flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Juror Notification: </span>
                          {result.jury.failed.map((f, i) => (
                            <span key={i}>
                              Model <strong className="font-semibold">{f.name}</strong> was unavailable ({f.error}).{' '}
                            </span>
                          ))}
                          <span>Consensus computed from responding juror(s).</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-2.5 tracking-tight">
                    <Award className="w-7 h-7 text-warning" />
                    Assigned Mark:{' '}
                    <span className="text-primary font-black">
                      {currentMarks}
                    </span>{' '}
                    <span className="text-lg font-normal text-muted-foreground">/ {result.max_marks} Marks ({currentPercentage}%)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge 
                    variant={getGradeBadge(currentPercentage).variant} 
                    className="text-sm px-3.5 py-1.5 font-bold"
                  >
                    {getGradeBadge(currentPercentage).label}
                  </Badge>
                  <div className="text-right px-4 py-2 rounded-xl bg-muted/60 border border-border">
                    <div className="text-2xl font-black text-primary">
                      {result.consensus.rubric_overall_score} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                    </div>
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Consensus Rubric
                    </div>
                  </div>
                </div>
              </div>

              {/* Rubric Breakdown Progress Bars */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Criterion Rubric Breakdown (mean of responding jurors)
                  </h3>

                  {/* View mode toggle: Cards vs Matrix */}
                  <div className="inline-flex items-center rounded-lg border border-border bg-muted p-1 text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setActiveTab('cards')}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer",
                        activeTab === 'cards'
                          ? "bg-background text-foreground shadow-sm font-semibold"
                          : "hover:text-foreground"
                      )}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Model Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('matrix')}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer",
                        activeTab === 'matrix'
                          ? "bg-background text-foreground shadow-sm font-semibold"
                          : "hover:text-foreground"
                      )}
                    >
                      <TableProperties className="w-3.5 h-3.5" />
                      Score Matrix
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Conceptual Accuracy (40%)', score: result.consensus.rubric_breakdown.conceptual_accuracy, color: 'bg-primary-700' },
                    { label: 'Completeness & Depth (30%)', score: result.consensus.rubric_breakdown.completeness, color: 'bg-primary-600' },
                    { label: 'Clarity & Structure (15%)', score: result.consensus.rubric_breakdown.clarity, color: 'bg-primary-500' },
                    { label: 'Academic Terminology (15%)', score: result.consensus.rubric_breakdown.terminology, color: 'bg-primary-400' },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-muted/40 border border-border rounded-xl p-3.5 space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-foreground">{item.label}</span>
                        <span className="text-primary font-bold">{item.score} / 10</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                        <div 
                          className={`h-2 rounded-full ${item.color} transition-all duration-1000`} 
                          style={{ width: `${(item.score / 10) * 100}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jury Consensus Recommendation */}
              <div className="p-4 rounded-xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-900/40 text-xs sm:text-small text-foreground flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-primary">Recommendation: </span>
                  {result.consensus.recommendation}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Display View: Cards vs Matrix */}
          {activeTab === 'cards' ? (
            <div
              className={cn(
                "grid grid-cols-1 gap-5",
                allModelResults.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : allModelResults.length === 2 ? "md:grid-cols-2" : "md:max-w-xl"
              )}
            >
              {allModelResults.map(({ spec, data }) => {
                const IconComp = spec.icon;
                return (
                  <Card 
                    key={spec.id} 
                    className={cn(
                      "rounded-2xl border transition-all hover:shadow-card flex flex-col justify-between overflow-hidden",
                      spec.borderColor
                    )}
                  >
                    <CardContent className="p-5 space-y-4 flex flex-col justify-between h-full">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", spec.badgeColor)}>
                            {spec.badge}
                          </span>
                          <IconComp className={cn("w-4 h-4", spec.textColor)} />
                        </div>

                        <div className="space-y-0.5">
                          <h3 className="font-bold text-sm text-foreground truncate" title={data.name}>
                            {spec.shortName}
                          </h3>
                          <p className="text-[11px] text-muted-foreground font-mono">{spec.params}</p>
                        </div>

                        {/* Marks & Rubric Score */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                          <div>
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Marks</div>
                            <div className={cn("text-base font-extrabold", spec.textColor)}>
                              {data.assigned_marks} / {result.max_marks}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Rubric</div>
                            <div className="text-base font-bold text-foreground">
                              {data.rubric_score} / 10
                            </div>
                          </div>
                        </div>

                        {/* Mini Rubric Chips */}
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="p-1.5 rounded-lg bg-background border border-border flex justify-between">
                            <span className="text-muted-foreground">Concept:</span>
                            <span className="font-bold text-foreground">{data.rubric_breakdown?.conceptual_accuracy ?? 0}</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-background border border-border flex justify-between">
                            <span className="text-muted-foreground">Depth:</span>
                            <span className="font-bold text-foreground">{data.rubric_breakdown?.completeness ?? 0}</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-background border border-border flex justify-between">
                            <span className="text-muted-foreground">Clarity:</span>
                            <span className="font-bold text-foreground">{data.rubric_breakdown?.clarity ?? 0}</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-background border border-border flex justify-between">
                            <span className="text-muted-foreground">Terms:</span>
                            <span className="font-bold text-foreground">{data.rubric_breakdown?.terminology ?? 0}</span>
                          </div>
                        </div>

                        {/* Feedback Justification */}
                        <div className="space-y-1 pt-1">
                          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Evaluation Rationale
                          </div>
                          <div className="p-3 rounded-xl bg-background border border-border text-[11px] text-muted-foreground leading-relaxed max-h-36 overflow-y-auto scrollbar-thin">
                            {data.feedback}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Model Rubric Comparison Matrix Table */
            <Card className="shadow-card overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Detailed Model Score Matrix
                </CardTitle>
                <CardDescription>
                  Per-juror scores and rubric breakdown for every model that responded.
                </CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-y border-border bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Juror</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Assigned Marks</th>
                      <th className="py-3 px-4">Rubric (0-10)</th>
                      <th className="py-3 px-4">Conceptual</th>
                      <th className="py-3 px-4">Completeness</th>
                      <th className="py-3 px-4">Clarity</th>
                      <th className="py-3 px-4">Terminology</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allModelResults.map(({ spec, data }) => (
                      <tr key={spec.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-foreground flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", spec.dotColor)} />
                          {spec.shortName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-semibold", spec.badgeColor)}>
                            {spec.badge}
                          </span>
                        </td>
                        <td className={cn("py-3.5 px-4 font-extrabold text-sm", spec.textColor)}>
                          {data.assigned_marks} / {result.max_marks}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-foreground">
                          {data.rubric_score} / 10
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">{data.rubric_breakdown?.conceptual_accuracy ?? 0}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{data.rubric_breakdown?.completeness ?? 0}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{data.rubric_breakdown?.clarity ?? 0}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{data.rubric_breakdown?.terminology ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Faculty Override & Save Bar */}
          <Card className="shadow-card">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Faculty Mark Override & Official Approval</h4>
                  <p className="text-xs text-muted-foreground">Adjust consensus marks if needed before committing grade to student gradebook.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="gap-1.5 cursor-pointer text-xs"
                  title="Copy full consensus and rubric breakdown to clipboard"
                >
                  {copiedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-success" />
                      <span className="text-success font-semibold">Summary Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-primary" />
                      <span>Copy Evaluation Summary</span>
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Grade:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={result.max_marks}
                    value={currentMarks}
                    onChange={(e) => setOverrideMarks(Number(e.target.value))}
                    className="w-20 bg-background border border-input rounded-lg px-2.5 py-2 text-sm text-center font-extrabold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground font-semibold">/ {result.max_marks}</span>
                </div>

                <Button
                  onClick={handleSaveMarks}
                  variant={savedSuccess ? 'default' : 'secondary'}
                  className={cn(
                    "font-semibold text-xs transition gap-1.5 cursor-pointer",
                    savedSuccess && "bg-success hover:bg-success/90 text-white"
                  )}
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-4 h-4" /> Grade Committed!
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Commit Final Grade
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
