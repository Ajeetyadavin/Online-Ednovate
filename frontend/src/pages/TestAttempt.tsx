import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, CheckCircle, Clock, FileText, Flag, ListChecks, Lock, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { saveStudentTestAttemptApi, SESSION_TOKEN_KEY } from "@/services/authApi";
import katex from "katex";
import "katex/dist/katex.min.css";

type MockQuestion = {
  id: string;
  type: string;
  difficulty: string;
  question_text: string;
  options: unknown;
  correct_answer?: unknown;
};

type AttemptReport = {
  id: string;
  paperId: string;
  paperTitle: string;
  submittedAt: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  scorePercent: number;
  timeTakenSeconds: number;
  questions?: Array<{
    questionNo: number;
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    status: "correct" | "wrong" | "not_attempted";
  }>;
};

const REPORTS_KEY = "ednovate_test_attempt_reports";
const ATTEMPT_STATE_PREFIX = "ednovate_test_attempt_state";
const ATTEMPT_LOCK_PREFIX = "ednovate_test_attempt_lock";

const userStorageKey = (base: string, identity?: string) => `${base}_${String(identity || "guest").trim().toLowerCase() || "guest"}`;

const normalizeBackslashes = (value: string) => {
  let next = String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\u005c/g, "\\")
    .replace(/\\u0028/g, "(")
    .replace(/\\u0029/g, ")")
    .replace(/&bsol;/g, "\\")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
  while (/\\\\[a-zA-Z({\[]/.test(next)) {
    const previous = next;
    next = next.replace(/\\\\/g, "\\");
    if (previous === next) break;
  }
  return next;
};

const normalizeOcrMathText = (value: string) => {
  const source = normalizeBackslashes(value)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const compactLines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  if (compactLines.length >= 5) {
    const joined = compactLines.join(" ");
    const fractionRatio = joined.match(/\b(\d+)\s+([a-zA-Z])\s*:\s*(\d+)\s+([a-zA-Z])\b/);
    if (fractionRatio && /duplicate ratio/i.test(joined)) {
      return joined.replace(
        fractionRatio[0],
        `\\(\\frac{${fractionRatio[1]}}{${fractionRatio[2]}} : \\frac{${fractionRatio[3]}}{${fractionRatio[4]}}\\)`,
      );
    }
  }

  return source.replace(/\n/g, " ");
};

const extractOptionText = (item: unknown) => {
  if (item && typeof item === "object") {
    const row = item as Record<string, unknown>;
    return String(row.text || row.value || row.label || row.option || row.answer || Object.values(row)[0] || "").trim();
  }
  return String(item || "").trim();
};

const MathText = ({ value, className = "" }: { value: unknown; className?: string }) => {
  const text = String(value || "");
  if (!text) return null;
  const normalized = normalizeOcrMathText(text).replace(/\$\$([\s\S]+?)\$\$/g, "\\[$1\\]");
  const parts = normalized.split(/(\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\$[^$]+\$)/g).filter(Boolean);
  const renderKatex = (source: string, displayMode = false) => {
    const cleanedSource = normalizeBackslashes(source)
      .replace(/\\dfrac/g, "\\frac")
      .replace(/\\tfrac/g, "\\frac")
      .replace(/\\left\s*/g, "")
      .replace(/\\right\s*/g, "")
      .trim();
    try {
      return (
        <span
          className={displayMode ? "my-1 block overflow-x-auto" : "inline-block align-middle"}
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(cleanedSource, {
              displayMode,
              throwOnError: false,
              strict: false,
              output: "html",
            }),
          }}
        />
      );
    } catch {
      return <span>{cleanedSource}</span>;
    }
  };

  const hasDelimitedMath = parts.length > 1;
  const latexCommandPattern = /\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|oint|lim|log|ln|sin|cos|tan|cot|sec|csc|pi|theta|alpha|beta|gamma|delta|lambda|mu|sigma|omega|times|div|leq|geq|neq|approx|equiv|infty|pm|mp|cdot|begin|end|left|right)/;
  const wholeLooksMath = !hasDelimitedMath && (latexCommandPattern.test(normalized) || /[\^_]\{?[\w+\-=()]+\}?/.test(normalized));

  if (wholeLooksMath && normalized.length < 260 && !/[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(normalized.replace(/\\[a-zA-Z]+/g, ""))) {
    return <span className={className}>{renderKatex(normalized, false)}</span>;
  }

  const renderAutoMath = (plain: string, partIndex: number) => {
    const source = String(plain || "");
    const autoMathPattern = /(\\(?:frac|dfrac|tfrac)\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*\{(?:[^{}]|\{[^{}]*\})*\}|\\sqrt(?:\[[^\]]*\])?\s*\{(?:[^{}]|\{[^{}]*\})*\}|\\begin\{[^{}]+\}[\s\S]*?\\end\{[^{}]+\}|\\(?:sum|prod|int|oint|lim|log|ln|sin|cos|tan|cot|sec|csc|pi|theta|alpha|beta|gamma|delta|lambda|mu|sigma|omega|times|div|leq|geq|neq|approx|equiv|infty|pm|mp|cdot)(?:\s*[_^]\s*(?:\{[^{}]*\}|[A-Za-z0-9+\-=()]+))*|[A-Za-z0-9]+(?:\s*[_^]\s*(?:\{[^{}]*\}|[A-Za-z0-9+\-=()]+))+)/g;
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = autoMathPattern.exec(source)) !== null) {
      if (match.index > cursor) nodes.push(<span key={`${partIndex}-t-${cursor}`}>{source.slice(cursor, match.index)}</span>);
      nodes.push(<span key={`${partIndex}-m-${match.index}`}>{renderKatex(match[0], false)}</span>);
      cursor = match.index + match[0].length;
    }

    if (cursor < source.length) nodes.push(<span key={`${partIndex}-t-${cursor}`}>{source.slice(cursor)}</span>);
    return nodes.length > 0 ? nodes : [<span key={`${partIndex}-plain`}>{source}</span>];
  };

  return (
    <span className={className}>
      {(hasDelimitedMath ? parts : [normalized]).map((part, index) => {
        const inline = /^\\\(/.test(part) || /^\$[^$]+\$/.test(part);
        const display = /^\\\[/.test(part);
        if (!inline && !display) return <span key={index}>{renderAutoMath(part, index)}</span>;
        const content = part.startsWith("$") ? part.slice(1, -1) : part.slice(2, -2);
        return <span key={index}>{renderKatex(content, display)}</span>;
      })}
    </span>
  );
};

const normalizeOptions = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(extractOptionText).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(extractOptionText).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      return normalizeOptions(JSON.parse(value));
    } catch {
      return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const normalizeCorrectAnswer = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") {
    try {
      return normalizeCorrectAnswer(JSON.parse(value));
    } catch {
      return value.trim().toLowerCase();
    }
  }
  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return String(objectValue.value || objectValue.answer || Object.values(objectValue)[0] || "").trim().toLowerCase();
  }
  return String(value).trim().toLowerCase();
};

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
};

const TestAttempt = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { testPapers } = usePlatformData();
  const { purchasedTestPapers } = useCart();
  const { user } = useAuth();
  const paper = testPapers.find((item) => item.id === id);
  const userIdentity = user?.studentId || user?.email || user?.mobile || "guest";
  const reportStorageKey = userStorageKey(REPORTS_KEY, userIdentity);
  const attemptStateKey = `${userStorageKey(ATTEMPT_STATE_PREFIX, userIdentity)}_${id}`;
  const attemptLockKey = `${userStorageKey(ATTEMPT_LOCK_PREFIX, userIdentity)}_${id}`;
  const [attemptInstanceId] = useState(() => `attempt-window-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [isDuplicateAttemptOpen, setIsDuplicateAttemptOpen] = useState(false);
  const hasPurchasedPaper = purchasedTestPapers.some((item) => item.id === id);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [examEndAt, setExamEndAt] = useState<number>(() => Date.now() + Math.max(1, Number(paper?.totalTime || 60)) * 60 * 1000);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.max(1, Number(paper?.totalTime || 60)) * 60);
  const [submittedReport, setSubmittedReport] = useState<AttemptReport | null>(null);
  const [attemptLimitReached, setAttemptLimitReached] = useState(false);

  const activeQuestion = questions[activeIndex] || null;
  const answeredCount = questions.filter((question) => Boolean(answers[question.id])).length;
  const markedCount = questions.filter((question) => Boolean(marked[question.id])).length;
  const totalSeconds = Math.max(1, Number(paper?.totalTime || 60)) * 60;
  const timeTakenSeconds = Math.max(0, totalSeconds - remainingSeconds);

  useEffect(() => {
    if (!paper) return;
    if (!hasPurchasedPaper) {
      navigate("/dashboard", { replace: true });
    }
  }, [hasPurchasedPaper, navigate, paper]);

  useEffect(() => {
    if (!paper || !hasPurchasedPaper || submittedReport) return;

    const now = Date.now();
    const existing = (() => {
      try {
        return JSON.parse(localStorage.getItem(attemptLockKey) || "{}");
      } catch {
        return {};
      }
    })();
    const existingUpdatedAt = Number(existing.updatedAt || 0);
    const existingActive = existing.instanceId && existing.instanceId !== attemptInstanceId && now - existingUpdatedAt < 8000;

    if (existingActive) {
      setIsDuplicateAttemptOpen(true);
      return;
    }

    const writeLock = () => {
      localStorage.setItem(attemptLockKey, JSON.stringify({
        paperId: id,
        instanceId: attemptInstanceId,
        updatedAt: Date.now(),
      }));
    };

    writeLock();
    const heartbeat = window.setInterval(writeLock, 3000);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== attemptLockKey || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        if (next.instanceId && next.instanceId !== attemptInstanceId && Date.now() - Number(next.updatedAt || 0) < 8000) {
          setIsDuplicateAttemptOpen(true);
        }
      } catch {
        // Ignore malformed lock payload.
      }
    };
    const releaseLock = () => {
      try {
        const current = JSON.parse(localStorage.getItem(attemptLockKey) || "{}");
        if (current.instanceId === attemptInstanceId) {
          localStorage.removeItem(attemptLockKey);
        }
      } catch {
        localStorage.removeItem(attemptLockKey);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", releaseLock);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", releaseLock);
      releaseLock();
    };
  }, [attemptInstanceId, attemptLockKey, hasPurchasedPaper, id, paper, submittedReport]);

  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem(SESSION_TOKEN_KEY) || "";
        const response = await fetch(`/api/test-papers/${encodeURIComponent(id)}/questions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (payload?.code === "ATTEMPT_LIMIT_REACHED") setAttemptLimitReached(true);
          setQuestions([]);
          return;
        }
        const items = Array.isArray(payload.items) ? payload.items : [];
        const nextQuestions = items.map((item: any) => ({
          id: String(item.id || ""),
          type: String(item.type || "mcq"),
          difficulty: String(item.difficulty || "medium"),
          question_text: String(item.question_text || ""),
          options: item.options,
          correct_answer: item.correct_answer,
        })).filter((item: MockQuestion) => item.id && item.question_text);
        setQuestions(nextQuestions);
        try {
          const saved = JSON.parse(localStorage.getItem(attemptStateKey) || "{}");
          if (saved && saved.paperId === id && !saved.submitted) {
            setActiveIndex(Math.min(Math.max(0, Number(saved.activeIndex || 0)), Math.max(0, nextQuestions.length - 1)));
            setAnswers(saved.answers && typeof saved.answers === "object" ? saved.answers : {});
            setMarked(saved.marked && typeof saved.marked === "object" ? saved.marked : {});
            const savedEndAt = Number(saved.examEndAt || 0);
            const fallbackEndAt = Date.now() + Math.max(1, Number(paper?.totalTime || 60)) * 60 * 1000;
            const nextEndAt = savedEndAt > 0 ? savedEndAt : fallbackEndAt;
            setExamEndAt(nextEndAt);
            setRemainingSeconds(Math.max(0, Math.ceil((nextEndAt - Date.now()) / 1000)));
          } else {
            const freshEndAt = Date.now() + Math.max(1, Number(paper?.totalTime || 60)) * 60 * 1000;
            setExamEndAt(freshEndAt);
            setRemainingSeconds(Math.max(1, Number(paper?.totalTime || 60)) * 60);
          }
        } catch {
          const freshEndAt = Date.now() + Math.max(1, Number(paper?.totalTime || 60)) * 60 * 1000;
          setExamEndAt(freshEndAt);
          setRemainingSeconds(Math.max(1, Number(paper?.totalTime || 60)) * 60);
        }
      } finally {
        setIsLoading(false);
      }
    };
    void loadQuestions();
  }, [attemptStateKey, id, paper?.totalTime]);

  useEffect(() => {
    if (submittedReport || isLoading) return;
    localStorage.setItem(attemptStateKey, JSON.stringify({
      paperId: id,
      activeIndex,
      answers,
      marked,
      examEndAt,
      updatedAt: new Date().toISOString(),
    }));
  }, [activeIndex, answers, attemptStateKey, examEndAt, id, isLoading, marked, submittedReport]);

  useEffect(() => {
    if (submittedReport) return;
    window.history.pushState(null, "", window.location.href);
    const blockBack = () => {
      window.history.pushState(null, "", window.location.href);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", blockBack);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("popstate", blockBack);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [submittedReport]);

  useEffect(() => {
    if (submittedReport || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((examEndAt - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examEndAt, remainingSeconds, submittedReport]);

  const submitAttempt = () => {
    const questionReports = questions.map((question, index) => {
      const answer = String(answers[question.id] || "").trim().toLowerCase();
      const correctAnswer = normalizeCorrectAnswer(question.correct_answer);
      const isCorrect = Boolean(answer && correctAnswer && answer === correctAnswer);
      return {
        questionNo: index + 1,
        questionText: question.question_text,
        userAnswer: answers[question.id] || "",
        correctAnswer,
        isCorrect,
        status: !answer ? "not_attempted" as const : isCorrect ? "correct" as const : "wrong" as const,
      };
    });
    const correct = questionReports.filter((item) => item.isCorrect).length;
    const attempted = questions.filter((question) => Boolean(answers[question.id])).length;
    const report: AttemptReport = {
      id: `attempt-${Date.now()}`,
      paperId: paper?.id || id,
      paperTitle: paper?.title || "Test Paper",
      submittedAt: new Date().toISOString(),
      totalQuestions: questions.length,
      attempted,
      correct,
      wrong: Math.max(0, attempted - correct),
      scorePercent: questions.length ? Math.round((correct / questions.length) * 100) : 0,
      timeTakenSeconds,
      questions: questionReports,
    };
    const previous = (() => {
      try {
        return JSON.parse(localStorage.getItem(reportStorageKey) || "[]");
      } catch {
        return [];
      }
    })();
    localStorage.setItem(reportStorageKey, JSON.stringify([report, ...(Array.isArray(previous) ? previous : [])].slice(0, 50)));
    void saveStudentTestAttemptApi(report);
    localStorage.removeItem(attemptStateKey);
    localStorage.removeItem(attemptLockKey);
    setSubmittedReport(report);
  };

  useEffect(() => {
    if (!submittedReport && remainingSeconds === 0 && questions.length > 0) submitAttempt();
  }, [remainingSeconds, questions.length, submittedReport]);

  const optionList = useMemo(() => normalizeOptions(activeQuestion?.options), [activeQuestion]);

  if (!paper) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <p className="font-bold text-slate-700">Test paper not found.</p>
        <Button className="mt-4" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  if (!hasPurchasedPaper) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <p className="font-bold text-slate-700">Purchase required to attempt this test.</p>
        <Button className="mt-4" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  if (attemptLimitReached) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <Lock className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h1 className="text-xl font-black text-slate-900">Attempt End</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            You have used all allowed attempts for this test paper.
          </p>
          <Button className="mt-5 rounded-xl bg-[#1e3a8a] text-white" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isDuplicateAttemptOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <XCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <h1 className="text-xl font-black text-slate-900">Test Already Open</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This attempt is already running in another tab or window. Close the other test window first, then open again.
          </p>
          <Button className="mt-5 rounded-xl bg-[#1e3a8a] text-white" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (submittedReport) {
    return (
      <div className="min-h-screen bg-slate-100 p-3 sm:p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Attempt Submitted</p>
              <h1 className="mt-2 text-2xl font-black text-slate-900">{submittedReport.paperTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">{new Date(submittedReport.submittedAt).toLocaleString("en-IN")}</p>
            </div>
            <Button className="rounded-xl bg-[#1e3a8a] text-white" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { label: "Score", value: `${submittedReport.scorePercent}%`, icon: Target, color: "text-[#1e3a8a]" },
              { label: "Attempted", value: `${submittedReport.attempted}/${submittedReport.totalQuestions}`, icon: ListChecks, color: "text-orange-600" },
              { label: "Correct", value: submittedReport.correct, icon: CheckCircle, color: "text-emerald-600" },
              { label: "Wrong", value: submittedReport.wrong, icon: XCircle, color: "text-red-600" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <item.icon className={`mb-2 h-5 w-5 ${item.color}`} />
                <p className="text-xs font-bold uppercase text-slate-400">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700">
              <span>Performance Report</span>
              <span>Time Taken: {formatDuration(submittedReport.timeTakenSeconds)}</span>
            </div>
            <Progress value={submittedReport.scorePercent} className="h-3" />
            <p className="mt-3 text-sm text-slate-600">
              You attempted {submittedReport.attempted} questions. Correct answers: {submittedReport.correct}, wrong answers: {submittedReport.wrong}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 text-slate-900 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Mock Test In Progress</p>
          <h1 className="truncate text-sm font-black sm:text-base">{paper.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-center">
            <p className="text-[9px] font-bold uppercase text-slate-400">Time Left</p>
            <p className={`font-mono text-sm font-black ${remainingSeconds < 300 ? "text-red-600" : "text-[#1e3a8a]"}`}>{formatDuration(remainingSeconds)}</p>
          </div>
          <Button size="sm" className="h-9 rounded-xl bg-[#E74623] text-xs font-bold text-white hover:bg-[#d13a1a]" onClick={submitAttempt}>Submit</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 bg-slate-50 p-2 md:grid-cols-[1fr_250px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Question {questions.length ? activeIndex + 1 : 0} of {questions.length}</p>
              <div className="mt-1 flex gap-1.5">
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{activeQuestion?.type || "mcq"}</Badge>
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{activeQuestion?.difficulty || "medium"}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
              <span>{answeredCount} answered</span>
              <span>{markedCount} marked</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-2.5 sm:p-3">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Loading questions...</div>
            ) : activeQuestion ? (
              <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-2">
                <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-100 bg-white p-3">
                  <p className="whitespace-pre-wrap text-sm font-bold leading-6 text-slate-900 sm:text-[15px]">
                    <MathText value={activeQuestion.question_text} />
                  </p>
                </div>
                <div className="grid min-h-0 content-start gap-2 overflow-hidden sm:grid-cols-2">
                  {optionList.length > 0 ? optionList.map((option, optionIndex) => {
                    const selected = answers[activeQuestion.id] === option;
                    return (
                      <button
                        key={`${activeQuestion.id}-${optionIndex}`}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [activeQuestion.id]: option }))}
                        className={`flex min-h-12 w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition ${selected ? "border-[#1e3a8a] bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"}`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${selected ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600"}`}>{String.fromCharCode(65 + optionIndex)}</span>
                        <span className="text-xs font-semibold leading-5 text-slate-700 sm:text-sm">
                          <MathText value={option} />
                        </span>
                      </button>
                    );
                  }) : (
                    <textarea
                      className="min-h-32 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-[#1e3a8a]"
                      placeholder="Type your answer..."
                      value={answers[activeQuestion.id] || ""}
                      onChange={(event) => setAnswers((prev) => ({ ...prev, [activeQuestion.id]: event.target.value }))}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-bold text-slate-500">No questions assigned to this test paper.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 p-2">
            <Button variant="outline" className="h-10 rounded-xl text-xs font-bold" disabled={activeIndex === 0} onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              className={`h-10 rounded-xl text-xs font-bold ${activeQuestion && marked[activeQuestion.id] ? "border-amber-300 bg-amber-50 text-amber-700" : ""}`}
              disabled={!activeQuestion}
              onClick={() => activeQuestion && setMarked((prev) => ({ ...prev, [activeQuestion.id]: !prev[activeQuestion.id] }))}
            >
              <Flag className="mr-1.5 h-4 w-4" /> Mark Later
            </Button>
            <Button className="h-10 rounded-xl bg-[#1e3a8a] text-xs font-bold text-white hover:bg-[#1e3a8a]/90" disabled={activeIndex >= questions.length - 1} onClick={() => setActiveIndex((value) => Math.min(questions.length - 1, value + 1))}>
              Save & Next
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 p-2"><p className="text-base font-black text-emerald-700">{answeredCount}</p><p className="text-[9px] font-bold text-emerald-700">Answered</p></div>
            <div className="rounded-xl bg-amber-50 p-2"><p className="text-base font-black text-amber-700">{markedCount}</p><p className="text-[9px] font-bold text-amber-700">Marked</p></div>
            <div className="rounded-xl bg-slate-100 p-2"><p className="text-base font-black text-slate-700">{Math.max(0, questions.length - answeredCount)}</p><p className="text-[9px] font-bold text-slate-600">Left</p></div>
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Question Palette</p>
          <div className="mt-2 grid max-h-48 grid-cols-8 gap-1.5 overflow-y-auto md:max-h-none md:grid-cols-5">
            {questions.map((question, index) => {
              const answered = Boolean(answers[question.id]);
              const isMarked = Boolean(marked[question.id]);
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-8 rounded-lg text-xs font-black ${index === activeIndex ? "ring-2 ring-[#1e3a8a]" : ""} ${isMarked ? "bg-amber-400 text-white" : answered ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-auto hidden rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 md:block">
            <ArrowLeft className="mb-1 h-4 w-4" />
            Back is locked during exam. Submit to see result and return.
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-600"><BarChart3 className="h-4 w-4 text-[#1e3a8a]" /> Progress</div>
            <Progress value={questions.length ? (answeredCount / questions.length) * 100 : 0} className="h-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestAttempt;
