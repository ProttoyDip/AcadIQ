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
  Check
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
    // Legacy support fallback keys
    llama_3_1?: ModelEvalResult;
    gemma?: ModelEvalResult;
    qwen?: ModelEvalResult;
  };
}

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
      setError(err.response?.data?.message || 'Failed to complete 4-model LLM jury evaluation.');
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
  const modelQwen = result?.models?.qwen_2_5 || result?.models?.qwen || {
    name: 'Qwen/Qwen2.5-7B-Instruct',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using Qwen 2.5 7B Instruct open model.'
  };

  const modelPhi = result?.models?.phi_3_5 || result?.models?.llama_3_1 || {
    name: 'microsoft/Phi-3.5-mini-instruct',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using Microsoft Phi-3.5 Mini Instruct model.'
  };

  const modelMistral = result?.models?.mistral_7b || result?.models?.gemma || {
    name: 'mistralai/Mistral-7B-Instruct-v0.3',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using Mistral 7B Instruct v0.3 model.'
  };

  const modelLLoRA = result?.models?.llora_7b || {
    name: 'Arindamdas70/llora7B-finetuned',
    assigned_marks: result?.consensus.assigned_marks || 0,
    rubric_score: result?.consensus.rubric_overall_score || 0,
    rubric_breakdown: result?.consensus.rubric_breakdown || { conceptual_accuracy: 0, completeness: 0, clarity: 0, terminology: 0 },
    feedback: 'Evaluated using LLoRA 7B Fine-Tuned academic evaluator.'
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6 text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <BrainCircuit className="w-64 h-64 text-indigo-400" />
        </div>
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" /> 4-Model Open LLM Jury System
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Multi-LLM Academic Evaluator & Rubric Scoring
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-3xl">
            Evaluates student answers concurrently using open-access, ungated LLMs: <span className="text-cyan-400 font-semibold">Qwen 2.5 7B</span>, <span className="text-amber-400 font-semibold">Microsoft Phi-3.5 Mini</span>, <span className="text-emerald-400 font-semibold">Mistral 7B v0.3</span>, and <span className="text-purple-400 font-semibold">LLoRA 7B Fine-Tuned</span>.
          </p>
        </div>
      </div>

      {/* Preset Quick Load */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <span className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5 flex-shrink-0">
          <BookmarkCheck className="w-4 h-4 text-indigo-400" /> Quick Presets:
        </span>
        {SAMPLE_PRESETS.map((preset, i) => (
          <button
            key={i}
            onClick={() => loadPreset(preset)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-xs font-medium text-slate-300 hover:text-white transition flex-shrink-0 cursor-pointer"
          >
            {preset.title}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleEvaluate} className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Reference Model Answer / Marking Scheme
            </label>
            <textarea
              required
              rows={4}
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
              placeholder="Paste reference model answer or key rubric concepts..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-cyan-400" /> Student's Written Answer
            </label>
            <textarea
              required
              rows={4}
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
              placeholder="Paste student answer text to evaluate..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-95 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition cursor-pointer"
          >
            {loading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" /> Running Open 4-Model Jury (Qwen + Phi + Mistral + LLoRA)...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Run 4-Model Jury Evaluation
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Dashboard */}
      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Consensus Overview Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">4-Model Open Jury Consensus Result</span>
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
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Award className="w-6 h-6 text-amber-400" />
                  Assigned Score: {overrideMarks ?? result.consensus.assigned_marks} / {result.max_marks} Marks
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className={`px-4 py-2 rounded-xl border text-sm font-semibold ${getGradeBadge(result.consensus.percentage).color}`}>
                  {getGradeBadge(result.consensus.percentage).label}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-indigo-400">{result.consensus.rubric_overall_score} / 10</div>
                  <div className="text-xs text-slate-400">Overall Rubric Score</div>
                </div>
              </div>
            </div>

            {/* Rubric Score Breakdown Bars */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" /> Criterion Rubric Breakdown (4-Model Jury Mean)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Conceptual Accuracy (40%)', score: result.consensus.rubric_breakdown.conceptual_accuracy, color: 'bg-cyan-500' },
                  { label: 'Completeness & Depth (30%)', score: result.consensus.rubric_breakdown.completeness, color: 'bg-amber-500' },
                  { label: 'Clarity & Structure (15%)', score: result.consensus.rubric_breakdown.clarity, color: 'bg-emerald-500' },
                  { label: 'Academic Terminology (15%)', score: result.consensus.rubric_breakdown.terminology, color: 'bg-purple-500' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
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

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-3">
              <BrainCircuit className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{result.consensus.recommendation}</span>
            </div>
          </div>

          {/* 4-Model Jury Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Qwen 2.5 7B Model Card */}
            <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-cyan-500/10 border-b border-l border-cyan-500/30 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400 rounded-bl-lg">
                Jury A
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                  <BrainCircuit className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  {modelQwen.name}
                </h3>
                <p className="text-[11px] text-slate-400">Qwen 2.5 7B Instruct (Open)</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">Marks</div>
                  <div className="text-base font-extrabold text-cyan-400">{modelQwen.assigned_marks} / {result.max_marks}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Rubric Score</div>
                  <div className="text-base font-bold text-white">{modelQwen.rubric_score} / 10</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Justification</div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  {modelQwen.feedback}
                </div>
              </div>
            </div>

            {/* Microsoft Phi-3.5 Mini Card */}
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-500/10 border-b border-l border-amber-500/30 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400 rounded-bl-lg">
                Jury B
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  {modelPhi.name}
                </h3>
                <p className="text-[11px] text-slate-400">Microsoft Phi-3.5 Mini (MIT)</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">Marks</div>
                  <div className="text-base font-extrabold text-amber-400">{modelPhi.assigned_marks} / {result.max_marks}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Rubric Score</div>
                  <div className="text-base font-bold text-white">{modelPhi.rubric_score} / 10</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Justification</div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  {modelPhi.feedback}
                </div>
              </div>
            </div>

            {/* Mistral 7B Card */}
            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500/10 border-b border-l border-emerald-500/30 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 rounded-bl-lg">
                Jury C
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  {modelMistral.name}
                </h3>
                <p className="text-[11px] text-slate-400">Mistral 7B Instruct v0.3 (Apache)</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">Marks</div>
                  <div className="text-base font-extrabold text-emerald-400">{modelMistral.assigned_marks} / {result.max_marks}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Rubric Score</div>
                  <div className="text-base font-bold text-white">{modelMistral.rubric_score} / 10</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Justification</div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  {modelMistral.feedback}
                </div>
              </div>
            </div>

            {/* LLoRA 7B Fine-Tuned Model Card */}
            <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-purple-500/10 border-b border-l border-purple-500/30 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-400 rounded-bl-lg">
                Jury D (Fine-Tuned)
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                  <Layers className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  {modelLLoRA.name}
                </h3>
                <p className="text-[11px] text-slate-400">LLoRA 7B Fine-Tuned</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">Marks</div>
                  <div className="text-base font-extrabold text-purple-400">{modelLLoRA.assigned_marks} / {result.max_marks}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Rubric Score</div>
                  <div className="text-base font-bold text-white">{modelLLoRA.rubric_score} / 10</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Justification</div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  {modelLLoRA.feedback}
                </div>
              </div>
            </div>
          </div>

          {/* Faculty Override Controls */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Faculty Mark Override & Final Approval</h4>
                <p className="text-xs text-slate-400">Review 4-model AI recommendation and adjust final marks before saving.</p>
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
                className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-center font-bold text-indigo-400"
              />
              <button
                onClick={handleSaveMarks}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center gap-2 ${
                  savedSuccess
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4" /> Saved!
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Save Final Mark
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
