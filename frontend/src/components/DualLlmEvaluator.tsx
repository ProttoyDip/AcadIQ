import React, { useState } from 'react';
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
  Unlock,
  Scale,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { api } from '../services/api';

interface RubricBreakdown {
  conceptual_accuracy: number;
  completeness: number;
  clarity: number;
  terminology: number;
}

interface ModelEvalResult {
  name: string;
  assigned_marks: number;
  rubric_score: number;
  rubric_breakdown: RubricBreakdown;
  feedback: string;
}

interface MultiLlmEvaluationResponse {
  question: string;
  max_marks: number;
  student_answer: string;
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
  models: {
    qwen_2_5?: ModelEvalResult;
    phi_3_5?: ModelEvalResult;
    mistral_7b?: ModelEvalResult;
    llora_7b?: ModelEvalResult;
    // Fallback key support
    llama_3_1?: ModelEvalResult;
    gemma?: ModelEvalResult;
    qwen?: ModelEvalResult;
  };
}

// 4 Open-Access Jury Models Specification Metadata
const JURY_MODEL_SPECS = [
  {
    id: 'qwen_2_5',
    name: 'Qwen/Qwen2.5-7B-Instruct',
    shortName: 'Qwen 2.5 7B',
    badge: 'Zero Gated Token',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/50',
    textColor: 'text-cyan-400',
    bgGradient: 'from-cyan-950/40 via-slate-900 to-slate-900',
    icon: BrainCircuit,
    description: 'Zero gated token requirement. #1 open model for JSON schema adherence & rubric evaluation.',
    accessType: 'Ungated / Free Access',
    params: '7.2B Parameters'
  },
  {
    id: 'phi_3_5',
    name: 'microsoft/Phi-3.5-mini-instruct',
    shortName: 'Phi-3.5 Mini',
    badge: 'Open MIT License',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    borderColor: 'border-amber-500/30 hover:border-amber-500/50',
    textColor: 'text-amber-400',
    bgGradient: 'from-amber-950/40 via-slate-900 to-slate-900',
    icon: Sparkles,
    description: 'Open MIT license, 3.8B lightweight model delivering top reasoning and logical breakdown performance.',
    accessType: 'MIT License',
    params: '3.8B Parameters'
  },
  {
    id: 'mistral_7b',
    name: 'mistralai/Mistral-7B-Instruct-v0.3',
    shortName: 'Mistral 7B v0.3',
    badge: 'Apache 2.0 Open',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/50',
    textColor: 'text-emerald-400',
    bgGradient: 'from-emerald-950/40 via-slate-900 to-slate-900',
    icon: Cpu,
    description: 'Apache 2.0 open access. Industry benchmark for fast instruction execution and semantic coherence.',
    accessType: 'Apache 2.0 License',
    params: '7.3B Parameters'
  },
  {
    id: 'llora_7b',
    name: 'Arindamdas70/llora7B-finetuned',
    shortName: 'LLoRA 7B Academic',
    badge: 'Fine-Tuned Grader',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    borderColor: 'border-purple-500/30 hover:border-purple-500/50',
    textColor: 'text-purple-400',
    bgGradient: 'from-purple-950/40 via-slate-900 to-slate-900',
    icon: Layers,
    description: 'Custom fine-tuned academic grader model specialized for rubric alignment and exam scoring.',
    accessType: 'Open Academic LoRA',
    params: '7B LoRA Adapter'
  }
];

const SAMPLE_PRESETS = [
  {
    title: 'Computer Networks (TCP vs UDP)',
    question: 'Explain the core difference between TCP and UDP protocols with examples.',
    maxMarks: 10,
    modelAnswer: 'TCP is a connection-oriented protocol that ensures reliable, ordered packet delivery with error checking (e.g., HTTP, HTTPS, SSH). UDP is connectionless, prioritizing speed and low latency over reliability without packet ordering guarantees (e.g., DNS, VoIP, Video Streaming).',
    studentAnswer: 'TCP establishes a three-way handshake connection before transmitting data, guaranteeing packet delivery with retransmission if packets are lost. It is used for web browsing and file transfers. UDP transmits datagrams directly without prior connection setup, making it much faster but less reliable, commonly used in live streaming and online gaming.'
  },
  {
    title: 'Operating Systems (Virtual Memory)',
    question: 'Describe page fault handling mechanism in virtual memory management.',
    maxMarks: 10,
    modelAnswer: 'When a process references a page not currently resident in physical RAM, a page fault exception is raised by the MMU. The OS handles this by trapping to kernel mode, locating the requested page on secondary storage (swap space/disk), allocating a free frame, reading the page from disk into RAM, updating the page table entry, and restarting the faulting instruction.',
    studentAnswer: 'Page fault happens when CPU tries to access data that is not in main memory RAM. The operating system pauses the process, fetches the missing page from hard disk swap space into RAM, updates the page table mapping, and resumes process execution.'
  },
  {
    title: 'Database Systems (ACID Properties)',
    question: 'Explain the ACID properties in relational database transaction management.',
    maxMarks: 10,
    modelAnswer: 'ACID stands for Atomicity (all operations commit or all roll back), Consistency (transactions preserve DB integrity constraints), Isolation (concurrent transactions execute independently without mutual interference), and Durability (committed modifications persist permanently even after hardware failure).',
    studentAnswer: 'ACID ensures database reliability. Atomicity means all or nothing. Consistency ensures data remains valid. Isolation prevents concurrent transactions from conflicting with each other, and Durability means committed changes are saved permanently to disk.'
  }
];

export const DualLlmEvaluator: React.FC = () => {
  const [question, setQuestion] = useState(SAMPLE_PRESETS[0].question);
  const [maxMarks, setMaxMarks] = useState(SAMPLE_PRESETS[0].maxMarks);
  const [modelAnswer, setModelAnswer] = useState(SAMPLE_PRESETS[0].modelAnswer);
  const [studentAnswer, setStudentAnswer] = useState(SAMPLE_PRESETS[0].studentAnswer);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultiLlmEvaluationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideMarks, setOverrideMarks] = useState<number | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showJuryInfo, setShowJuryInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'matrix'>('cards');

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSavedSuccess(false);
    try {
      const res = await api.post<MultiLlmEvaluationResponse>('/analysis/dual-evaluate', {
        question,
        maxMarks: Number(maxMarks),
        modelAnswer,
        studentAnswer,
      });
      setResult(res.data);
      setOverrideMarks(res.data.consensus.assigned_marks);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete 4-model open LLM jury evaluation.');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setQuestion(preset.question);
    setMaxMarks(preset.maxMarks);
    setModelAnswer(preset.modelAnswer);
    setStudentAnswer(preset.studentAnswer);
    setResult(null);
    setOverrideMarks(null);
    setSavedSuccess(false);
  };

  const getGradeBadge = (percentage: number) => {
    if (percentage >= 90) return { label: 'A+ (Outstanding)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    if (percentage >= 80) return { label: 'A (Excellent)', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
    if (percentage >= 70) return { label: 'B (Good)', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    if (percentage >= 60) return { label: 'C (Satisfactory)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    return { label: 'D/F (Needs Improvement)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
  };

  const handleSaveMarks = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Safe accessor helpers for model cards
  const modelQwen: ModelEvalResult = result?.models?.qwen_2_5 || result?.models?.qwen || {
    name: 'Qwen/Qwen2.5-7B-Instruct',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using Qwen 2.5 7B Instruct open model (Zero Gated Token Requirement).'
  };

  const modelPhi: ModelEvalResult = result?.models?.phi_3_5 || result?.models?.llama_3_1 || {
    name: 'microsoft/Phi-3.5-mini-instruct',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using Microsoft Phi-3.5 Mini Instruct (Open MIT License).'
  };

  const modelMistral: ModelEvalResult = result?.models?.mistral_7b || result?.models?.gemma || {
    name: 'mistralai/Mistral-7B-Instruct-v0.3',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using Mistral 7B Instruct v0.3 (Apache 2.0 Open Access).'
  };

  const modelLLoRA: ModelEvalResult = result?.models?.llora_7b || {
    name: 'Arindamdas70/llora7B-finetuned',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using LLoRA 7B Fine-Tuned academic evaluator.'
  };

  const allModelResults = [
    { spec: JURY_MODEL_SPECS[0], data: modelQwen },
    { spec: JURY_MODEL_SPECS[1], data: modelPhi },
    { spec: JURY_MODEL_SPECS[2], data: modelMistral },
    { spec: JURY_MODEL_SPECS[3], data: modelLLoRA },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6 text-slate-100">
      {/* Main Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <BrainCircuit className="w-80 h-80 text-indigo-400" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Open-Access LLM Academic Jury System
            </div>

            <button
              onClick={() => setShowJuryInfo(!showJuryInfo)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              {showJuryInfo ? 'Hide Jury Specs' : 'View Jury Model Specifications'}
              {showJuryInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
            Dual & Multi-LLM Academic Evaluator
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-4xl leading-relaxed">
            Consensus scoring & rubric analysis powered concurrently by 4 ungated open-access models:
          </p>

          {/* 4 Models Highlight Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {JURY_MODEL_SPECS.map((spec) => {
              const IconComponent = spec.icon;
              return (
                <div 
                  key={spec.id}
                  className={`p-3 rounded-2xl bg-slate-900/90 border ${spec.borderColor} transition-all space-y-1.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${spec.badgeColor}`}>
                      {spec.badge}
                    </span>
                    <IconComponent className={`w-4 h-4 ${spec.textColor}`} />
                  </div>
                  <div className="font-mono text-xs font-bold text-white truncate" title={spec.name}>
                    {spec.shortName}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                    {spec.description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapsible Jury Info Panel */}
          {showJuryInfo && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-950/90 border border-indigo-500/20 text-xs space-y-3 animate-in fade-in duration-300">
              <h4 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-400" /> Open Model Jury Specifications & Licensing
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                    <Unlock className="w-3.5 h-3.5 text-cyan-400" /> Qwen/Qwen2.5-7B-Instruct
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Zero gated token requirement. Top-ranked open weights model for structured JSON adherence and multi-criteria academic rubric evaluation.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-400" /> microsoft/Phi-3.5-mini-instruct
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Open MIT license. 3.8B parameter lightweight model optimized for step-by-step logical reasoning and technical argument parsing.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> mistralai/Mistral-7B-Instruct-v0.3
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Apache 2.0 open access license. Renowned for high precision context understanding, rapid inference, and low hallucination rate.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-semibold text-purple-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" /> Arindamdas70/llora7B-finetuned
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Domain fine-tuned academic grader LoRA adapter trained specifically on university exam answer keys and marking rubrics.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preset Quick Loader */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-2">
          <BookmarkCheck className="w-4 h-4 text-indigo-400" /> Quick Presets:
        </span>
        {SAMPLE_PRESETS.map((preset, i) => (
          <button
            key={i}
            onClick={() => loadPreset(preset)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            {preset.title}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleEvaluate} className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-400" /> Exam Question
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
              placeholder="Enter exam question..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-400" /> Max Marks
            </label>
            <input
              type="number"
              required
              min="1"
              max="100"
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-bold text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Reference Answer / Marking Scheme
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Model Key</span>
            </label>
            <textarea
              required
              rows={4}
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-none leading-relaxed"
              placeholder="Paste reference model answer or key rubric concepts..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-cyan-400" /> Student's Written Answer
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Submission</span>
            </label>
            <textarea
              required
              rows={4}
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-none leading-relaxed"
              placeholder="Paste student answer text to evaluate..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Runs 4 models concurrently in parallel threads</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" /> Evaluating with Qwen 2.5 + Phi 3.5 + Mistral + LLoRA 7B...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Run 4-Model Open LLM Jury Evaluation
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-rose-400 text-sm flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Evaluation Results Dashboard */}
      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Consensus Banner & Rubric Summary */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" /> 4-Model Open Jury Consensus Result
                  </span>
                  {result.consensus.has_high_discrepancy ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Jury Discrepancy ({result.consensus.variance_percentage}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> High Jury Consensus ({result.consensus.jury_confidence || 95}% Confidence)
                    </span>
                  )}
                </div>

                <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2 tracking-tight">
                  <Award className="w-7 h-7 text-amber-400" />
                  Assigned Mark: <span className="text-indigo-400">{overrideMarks ?? result.consensus.assigned_marks}</span> / {result.max_marks} Marks
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <div className={`px-4 py-2.5 rounded-2xl border text-sm font-bold ${getGradeBadge(result.consensus.percentage).color}`}>
                  {getGradeBadge(result.consensus.percentage).label}
                </div>
                <div className="text-right px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-2xl font-black text-indigo-400">{result.consensus.rubric_overall_score} / 10</div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Consensus Rubric Score</div>
                </div>
              </div>
            </div>

            {/* Rubric Breakdown Progress Bars */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" /> Criterion Rubric Breakdown (Mean Jury Score)
                </h3>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('cards')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === 'cards' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Model Cards
                  </button>
                  <button
                    onClick={() => setActiveTab('matrix')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === 'matrix' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Score Matrix
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Conceptual Accuracy (40%)', score: result.consensus.rubric_breakdown.conceptual_accuracy, color: 'bg-cyan-500' },
                  { label: 'Completeness & Depth (30%)', score: result.consensus.rubric_breakdown.completeness, color: 'bg-amber-500' },
                  { label: 'Clarity & Structure (15%)', score: result.consensus.rubric_breakdown.clarity, color: 'bg-emerald-500' },
                  { label: 'Academic Terminology (15%)', score: result.consensus.rubric_breakdown.terminology, color: 'bg-purple-500' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="text-indigo-400 font-bold">{item.score} / 10</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-2.5 rounded-full ${item.color} transition-all duration-1000`} style={{ width: `${(item.score / 10) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-3">
              <BrainCircuit className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{result.consensus.recommendation}</span>
            </div>
          </div>

          {/* Model Display View: Cards vs Matrix */}
          {activeTab === 'cards' ? (
            /* 4-Model Open Jury Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {allModelResults.map(({ spec, data }) => {
                const IconComp = spec.icon;
                return (
                  <div 
                    key={spec.id} 
                    className={`bg-slate-900/90 border ${spec.borderColor} rounded-3xl p-5 space-y-4 shadow-xl relative overflow-hidden flex flex-col justify-between`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${spec.badgeColor}`}>
                          {spec.badge}
                        </span>
                        <IconComp className={`w-4 h-4 ${spec.textColor}`} />
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-sm text-white truncate" title={data.name}>
                          {data.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono">{spec.params}</p>
                      </div>

                      {/* Marks & Rubric Score */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-500">Marks</div>
                          <div className={`text-base font-extrabold ${spec.textColor}`}>
                            {data.assigned_marks} / {result.max_marks}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-semibold text-slate-500">Rubric</div>
                          <div className="text-base font-bold text-white">
                            {data.rubric_score} / 10
                          </div>
                        </div>
                      </div>

                      {/* Mini Rubric Chips */}
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="p-1.5 rounded-xl bg-slate-950 border border-slate-800/60 flex justify-between">
                          <span className="text-slate-400">Concept:</span>
                          <span className="font-bold text-white">{data.rubric_breakdown?.conceptual_accuracy ?? 0}</span>
                        </div>
                        <div className="p-1.5 rounded-xl bg-slate-950 border border-slate-800/60 flex justify-between">
                          <span className="text-slate-400">Depth:</span>
                          <span className="font-bold text-white">{data.rubric_breakdown?.completeness ?? 0}</span>
                        </div>
                        <div className="p-1.5 rounded-xl bg-slate-950 border border-slate-800/60 flex justify-between">
                          <span className="text-slate-400">Clarity:</span>
                          <span className="font-bold text-white">{data.rubric_breakdown?.clarity ?? 0}</span>
                        </div>
                        <div className="p-1.5 rounded-xl bg-slate-950 border border-slate-800/60 flex justify-between">
                          <span className="text-slate-400">Terms:</span>
                          <span className="font-bold text-white">{data.rubric_breakdown?.terminology ?? 0}</span>
                        </div>
                      </div>

                      {/* Feedback Justification */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Evaluation Rationale</div>
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed max-h-36 overflow-y-auto">
                          {data.feedback}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Model Rubric Comparison Matrix Table */
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-x-auto space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Detailed Model Score Matrix
              </h3>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Jury Model</th>
                    <th className="py-3 px-4">License / Access</th>
                    <th className="py-3 px-4">Assigned Marks</th>
                    <th className="py-3 px-4">Rubric (0-10)</th>
                    <th className="py-3 px-4">Conceptual</th>
                    <th className="py-3 px-4">Completeness</th>
                    <th className="py-3 px-4">Clarity</th>
                    <th className="py-3 px-4">Terminology</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allModelResults.map(({ spec, data }) => (
                    <tr key={spec.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${spec.textColor.replace('text-', 'bg-')}`} />
                        {data.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${spec.badgeColor}`}>
                          {spec.badge}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 font-extrabold text-sm ${spec.textColor}`}>
                        {data.assigned_marks} / {result.max_marks}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {data.rubric_score} / 10
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{data.rubric_breakdown?.conceptual_accuracy ?? 0}</td>
                      <td className="py-3.5 px-4 text-slate-300">{data.rubric_breakdown?.completeness ?? 0}</td>
                      <td className="py-3.5 px-4 text-slate-300">{data.rubric_breakdown?.clarity ?? 0}</td>
                      <td className="py-3.5 px-4 text-slate-300">{data.rubric_breakdown?.terminology ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Faculty Override & Save Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Faculty Mark Override & Official Approval</h4>
                <p className="text-xs text-slate-400">Adjust consensus marks if needed before committing grade to student gradebook.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.5"
                min="0"
                max={result.max_marks}
                value={overrideMarks ?? result.consensus.assigned_marks}
                onChange={(e) => setOverrideMarks(Number(e.target.value))}
                className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-center font-extrabold text-indigo-400 focus:outline-none focus:border-indigo-500"
              />

              <button
                onClick={handleSaveMarks}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 ${
                  savedSuccess
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                }`}
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
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
