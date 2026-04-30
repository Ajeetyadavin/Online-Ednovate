import { useState, useEffect } from "react";
import { Plus, Search, FileText, Sparkles, Upload, Loader2, Check, X, Filter, Trash2, Edit2, Layout, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { toast } from "@/hooks/use-toast";
import katex from "katex";
import "katex/dist/katex.min.css";
import { adminApi } from "@/services/adminApi";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";

interface AdminCrackItProps {
  mode?: "questions" | "papers";
}

const createBlankQuestion = () => ({
  type: "mcq",
  difficulty: "medium",
  question_text: "",
  options: ["", "", "", ""],
  correct_answer: { value: "" },
  explanation: "",
  course_id: "",
  level_id: "",
  subject_id: "",
  chapter_id: "",
  metadata: {}
});

const createBlankPaperForm = () => ({
  title: "",
  description: "",
  price: 0,
  original_price: 0,
  total_time: 60,
  question_time_limit_seconds: 0,
  total_marks: 100,
  passing_percent: 40,
  attempts_allowed: 1,
  thumbnail_url: "",
  nature: "objective",
  course_id: "",
  level_id: "",
  subject_id: "",
  chapter_id: "",
  paper_code: ""
});

const createBlankAutoAssignForm = () => ({
  easy: 0,
  medium: 0,
  hard: 0,
});

const createBlankAcademicTarget = () => ({
  course_id: "",
  level_id: "",
  subject_id: "",
  chapter_id: ""
});

type ExtractionProgress = {
  elapsedSeconds: number;
  percent: number;
  title: string;
  detail: string;
  status: "idle" | "running" | "complete" | "failed";
};

const extractionTimeline = [
  { at: 0, title: "Preparing file", detail: "PDF/image ready ho raha hai." },
  { at: 2, title: "Checking AI settings", detail: "Selected provider and model load ho raha hai." },
  { at: 4, title: "Uploading document", detail: "File extraction server par ja rahi hai." },
  { at: 7, title: "AI reading document", detail: "AI pages/image ko scan kar raha hai." },
  { at: 14, title: "Detecting questions", detail: "Question, options and answer structure identify ho raha hai." },
  { at: 24, title: "Normalizing math", detail: "Formula, options and answer format clean ho raha hai." },
  { at: 36, title: "Building preview", detail: "Extracted questions preview ke liye prepare ho rahe hain." },
];

const buildExtractionProgress = (elapsedSeconds: number): ExtractionProgress => {
  const current = extractionTimeline.reduce((active, step) => (elapsedSeconds >= step.at ? step : active), extractionTimeline[0]);
  const percent = Math.min(95, Math.max(8, Math.round(8 + elapsedSeconds * 2.4)));
  return {
    elapsedSeconds,
    percent,
    title: current.title,
    detail: current.detail,
    status: "running",
  };
};

const superscriptMap: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
};

const subscriptMap: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
};

const consumeBraceGroup = (value: string, start: number) => {
  if (value[start] !== "{") return { content: "", end: start };
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") depth -= 1;
    if (depth === 0) {
      return { content: value.slice(start + 1, index), end: index + 1 };
    }
  }
  return { content: value.slice(start + 1), end: value.length };
};

const consumeScriptValue = (value: string, start: number) => {
  if (value[start] === "{") return consumeBraceGroup(value, start);
  return { content: value[start] || "", end: start + 1 };
};

const toScriptText = (value: string, map: Record<string, string>) => (
  String(value || "")
    .split("")
    .map((char) => map[char] || char)
    .join("")
);

const renderMathExpression = (source: string, keyPrefix: string): React.ReactNode[] => {
  const text = String(source || "")
    .replace(/\\\\/g, "\\")
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\pi/g, "π")
    .replace(/\\theta/g, "θ")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β");
  const nodes: React.ReactNode[] = [];
  let index = 0;

  while (index < text.length) {
    if (text.startsWith("\\frac", index)) {
      const numerator = consumeBraceGroup(text, index + 5);
      const denominator = consumeBraceGroup(text, numerator.end);
      nodes.push(
        <span key={`${keyPrefix}-frac-${index}`} className="inline-flex align-middle mx-0.5 flex-col items-center justify-center text-[0.92em] leading-none">
          <span className="border-b border-current px-1 pb-0.5">{renderMathExpression(numerator.content, `${keyPrefix}-n-${index}`)}</span>
          <span className="px-1 pt-0.5">{renderMathExpression(denominator.content, `${keyPrefix}-d-${index}`)}</span>
        </span>,
      );
      index = denominator.end;
      continue;
    }

    if (text.startsWith("\\sqrt", index)) {
      const group = consumeBraceGroup(text, index + 5);
      nodes.push(
        <span key={`${keyPrefix}-sqrt-${index}`} className="inline-flex items-start align-middle mx-0.5">
          <span className="text-[1.05em] leading-none">√</span>
          <span className="border-t border-current px-0.5">{renderMathExpression(group.content, `${keyPrefix}-sqrtv-${index}`)}</span>
        </span>,
      );
      index = group.end;
      continue;
    }

    if (text[index] === "^" || text[index] === "_") {
      const script = consumeScriptValue(text, index + 1);
      nodes.push(text[index] === "^" ? toScriptText(script.content, superscriptMap) : toScriptText(script.content, subscriptMap));
      index = script.end;
      continue;
    }

    if (text[index] === "\\" && /[a-zA-Z]/.test(text[index + 1] || "")) {
      const match = text.slice(index + 1).match(/^[a-zA-Z]+/);
      nodes.push(match?.[0] || "");
      index += (match?.[0]?.length || 0) + 1;
      continue;
    }

    nodes.push(text[index]);
    index += 1;
  }

  return nodes;
};

const MathText = ({ value, className = "" }: { value: unknown; className?: string }) => {
  const text = String(value || "");
  if (!text) return null;
  const normalized = text.replace(/\$\$([\s\S]+?)\$\$/g, "\\($1\\)");
  const parts = normalized.split(/(\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\$[^$]+\$)/g).filter(Boolean);
  const hasMath = /\\(frac|sqrt|sum|int|lim|pi|theta|alpha|beta|times|div|leq|geq|neq)|[\^_]\{?[\w+\-=()]+\}?/.test(normalized);
  const renderKatex = (expression: string, displayMode = false) => {
    const source = expression.replace(/\\\\/g, "\\").trim();
    try {
      return (
        <span
          className={displayMode ? "my-1 block overflow-x-auto" : "inline-block align-middle"}
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(source, {
              displayMode,
              throwOnError: false,
              strict: false,
              trust: false,
              output: "html",
            }),
          }}
        />
      );
    } catch {
      return <span className="font-mono text-[0.96em]">{renderMathExpression(source, `fallback-${source.slice(0, 8)}`)}</span>;
    }
  };

  return (
    <span className={className}>
      {(parts.length > 1 ? parts : [normalized]).map((part, index) => {
        const isInlineDelimited = /^\\\(/.test(part) || /^\$[^$]+\$/.test(part);
        const isDisplayDelimited = /^\\\[/.test(part);
        const content = isInlineDelimited
          ? part.startsWith("$") ? part.slice(1, -1) : part.slice(2, -2)
          : isDisplayDelimited
            ? part.slice(2, -2)
            : part;
        if (isInlineDelimited || isDisplayDelimited) {
          return <span key={index}>{renderKatex(content, isDisplayDelimited)}</span>;
        }
        if (!hasMath) return <span key={index}>{part}</span>;
        return (
          <span key={index} className="font-mono text-[0.96em]">
            {renderMathExpression(content, `math-${index}`)}
          </span>
        );
      })}
    </span>
  );
};

const AdminCrackIt = ({ mode = "questions" }: AdminCrackItProps) => {
  const { categories, testPapers, refreshData } = usePlatformData();
  const { settings } = useSiteSettings();
  const [activeTab, setActiveTab] = useState(mode);
  const [isLoading, setIsLoading] = useState(false);

  // Robust data extraction
  const courseMasters = settings?.courseMasters || { subjects: [] };
  const subjects = Array.isArray(courseMasters.subjects) ? courseMasters.subjects : [];

  const getSubjectsForAcademic = (courseId?: string, levelId?: string) => {
    if (!levelId) return [];
    return subjects
      .filter((subject: any) => {
        const levelIds = Array.isArray(subject.levelIds) ? subject.levelIds : [];
        const courseIds = Array.isArray(subject.courseIds) ? subject.courseIds : [];
        const matchesLevel = levelIds.includes(levelId);
        const matchesCourse = !courseId || courseIds.length === 0 || courseIds.includes(courseId);
        return matchesLevel && matchesCourse && subject.isActive !== false;
      })
      .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  };

  const getChaptersForSubject = (subjectId?: string) => {
    const subject = subjects.find((item: any) => item.id === subjectId);
    return Array.isArray(subject?.chapters)
      ? [...subject.chapters]
          .filter((chapter: any) => chapter.isActive !== false)
          .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      : [];
  };

  // Sync tab with route mode
  useEffect(() => {
    setActiveTab(mode);
  }, [mode]);
  
  // Question Bank State
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQuestionBankIds, setSelectedQuestionBankIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [questionFilters, setQuestionFilters] = useState({
    course_id: "all",
    level_id: "all",
    subject_id: "all",
    chapter_id: "all",
  });
  const [paperListFilters, setPaperListFilters] = useState({
    search: "",
    course_id: "all",
    level_id: "all",
    subject_id: "all",
    chapter_id: "all",
  });
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<any[]>([]);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress>({
    elapsedSeconds: 0,
    percent: 0,
    title: "Ready",
    detail: "Upload start karne ke baad realtime progress yaha dikhega.",
    status: "idle",
  });
  const [extractAcademicTarget, setExtractAcademicTarget] = useState(createBlankAcademicTarget());
  const extractSubjects = getSubjectsForAcademic(extractAcademicTarget.course_id, extractAcademicTarget.level_id);
  const extractChapters = getChaptersForSubject(extractAcademicTarget.subject_id);
  const canUploadForExtraction = Boolean(
    extractAcademicTarget.course_id &&
    extractAcademicTarget.level_id &&
    extractAcademicTarget.subject_id &&
    extractAcademicTarget.chapter_id
  );
  
  // Manual Question State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualQuestion, setManualQuestion] = useState<any>(createBlankQuestion());
  const [manualMathView, setManualMathView] = useState<"latex" | "math">("latex");
  const isEditingQuestion = Boolean(manualQuestion.id);
  const manualSubjects = getSubjectsForAcademic(manualQuestion.course_id, manualQuestion.level_id);
  const manualChapters = getChaptersForSubject(manualQuestion.subject_id);
  const questionFilterSubjects = getSubjectsForAcademic(
    questionFilters.course_id === "all" ? "" : questionFilters.course_id,
    questionFilters.level_id === "all" ? "" : questionFilters.level_id,
  );
  const questionFilterChapters = getChaptersForSubject(questionFilters.subject_id === "all" ? "" : questionFilters.subject_id);
  const paperListFilterSubjects = getSubjectsForAcademic(
    paperListFilters.course_id === "all" ? "" : paperListFilters.course_id,
    paperListFilters.level_id === "all" ? "" : paperListFilters.level_id,
  );
  const paperListFilterChapters = getChaptersForSubject(paperListFilters.subject_id === "all" ? "" : paperListFilters.subject_id);
  const getCategoryName = (id?: string) => categories.find((item) => item.id === id)?.name || "";
  const getSubjectName = (id?: string) => subjects.find((item: any) => item.id === id)?.name || "";
  const getChapterName = (subjectId?: string, chapterId?: string) => {
    if (!subjectId || !chapterId) return "";
    const chapter = getChaptersForSubject(subjectId).find((item: any) => String(item.id || item.name) === String(chapterId));
    return chapter?.name || "";
  };
  const filteredQuestions = questions.filter((q) => {
    const search = searchQuery.trim().toLowerCase();
    if (search && !String(q.question_text || "").toLowerCase().includes(search)) return false;
    if (questionFilters.course_id !== "all" && String(q.course_id || "") !== questionFilters.course_id) return false;
    if (questionFilters.level_id !== "all" && String(q.level_id || "") !== questionFilters.level_id) return false;
    if (questionFilters.subject_id !== "all" && String(q.subject_id || "") !== questionFilters.subject_id) return false;
    if (questionFilters.chapter_id !== "all" && String(q.chapter_id || "") !== questionFilters.chapter_id) return false;
    return true;
  });
  const visibleQuestionIds = filteredQuestions.map((q) => String(q.id || "")).filter(Boolean);
  const selectedVisibleQuestionIds = selectedQuestionBankIds.filter((id) => visibleQuestionIds.includes(id));
  const allVisibleQuestionsSelected = visibleQuestionIds.length > 0 && selectedVisibleQuestionIds.length === visibleQuestionIds.length;
  const filteredTestPapers = testPapers.filter((paper) => {
    const search = paperListFilters.search.trim().toLowerCase();
    if (search) {
      const haystack = `${paper.title || ""} ${paper.paperCode || ""} ${paper.description || ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (paperListFilters.course_id !== "all" && String(paper.courseId || "") !== paperListFilters.course_id) return false;
    if (paperListFilters.level_id !== "all" && String(paper.levelId || "") !== paperListFilters.level_id) return false;
    if (paperListFilters.subject_id !== "all" && String(paper.subjectId || "") !== paperListFilters.subject_id) return false;
    if (paperListFilters.chapter_id !== "all" && String(paper.chapterId || "") !== paperListFilters.chapter_id) return false;
    return true;
  });

  useEffect(() => {
    console.log("CrackIt Debug - Categories:", categories);
    console.log("CrackIt Debug - Subjects:", subjects);
  }, [categories, subjects]);

  const fetchQuestions = async () => {
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      
      const res = await fetch("/api/admin/crackit/questions", {
        headers: adminToken ? { "Authorization": `Bearer ${adminToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);
  useEffect(() => {
    const availableIds = new Set(questions.map((q) => String(q.id || "")).filter(Boolean));
    setSelectedQuestionBankIds((prev) => prev.filter((id) => availableIds.has(id)));
  }, [questions]);
  useEffect(() => {
    if (!isExtracting) return;
    const startedAt = Date.now() - extractionProgress.elapsedSeconds * 1000;
    const interval = window.setInterval(() => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setExtractionProgress((prev) => {
        if (prev.status !== "running") return prev;
        return buildExtractionProgress(elapsedSeconds);
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isExtracting]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!canUploadForExtraction) {
      toast({
        title: "Select Academic Target",
        description: "Please choose Course, Level, Subject and Chapter before uploading.",
        variant: "destructive"
      });
      return;
    }

    setIsExtracting(true);
    setExtractedPreview([]);
    setExtractionProgress({
      elapsedSeconds: 0,
      percent: 6,
      title: "Preparing file",
      detail: `${file.name} ready ho raha hai.`,
      status: "running",
    });
    const formData = new FormData();
    formData.append("file", file);

    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      setExtractionProgress((prev) => ({
        ...prev,
        percent: Math.max(prev.percent, 12),
        title: "Checking AI settings",
        detail: "Admin settings se selected AI provider/model load ho raha hai.",
      }));
      const settingsRes = await fetch("/api/admin/platform-settings", {
        headers: adminToken ? { "Authorization": `Bearer ${adminToken}` } : {},
      });
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const aiExtraction = settingsData?.settings?.aiExtraction;
        if (aiExtraction && typeof aiExtraction === "object") {
          formData.append("aiExtraction", JSON.stringify(aiExtraction));
        }
      }
      setExtractionProgress((prev) => ({
        ...prev,
        percent: Math.max(prev.percent, 22),
        title: "Uploading document",
        detail: "File server ko bheji ja rahi hai. Large PDF me thoda time lag sakta hai.",
      }));
      
      const res = await fetch("/api/admin/crackit/extract-questions", {
        method: "POST",
        headers: adminToken ? { "Authorization": `Bearer ${adminToken}` } : {},
        body: formData,
      });
      setExtractionProgress((prev) => ({
        ...prev,
        percent: Math.max(prev.percent, 88),
        title: "Building preview",
        detail: "AI response parse karke question preview ban raha hai.",
      }));

      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setExtractedPreview(items.map((item: any) => ({
          ...item,
          ...extractAcademicTarget,
          metadata: {
            ...(typeof item.metadata === "object" && item.metadata !== null ? item.metadata : {}),
            extractedBy: "ai"
          }
        })));
        setExtractionProgress((prev) => ({
          elapsedSeconds: prev.elapsedSeconds,
          percent: 100,
          title: "Extraction complete",
          detail: `${items.length} question${items.length === 1 ? "" : "s"} extracted. Preview ready hai.`,
          status: "complete",
        }));
        toast({ title: "AI Extraction Complete", description: `Extracted ${data.items.length} questions.` });
      } else {
        const err = await res.json();
        setExtractionProgress((prev) => ({
          ...prev,
          percent: 100,
          title: "Extraction failed",
          detail: err.message || "AI extraction failed.",
          status: "failed",
        }));
        toast({ title: "Extraction Failed", description: err.message, variant: "destructive" });
      }
    } catch (err) {
      setExtractionProgress((prev) => ({
        ...prev,
        percent: 100,
        title: "Extraction failed",
        detail: "Network ya server error ki wajah se extraction complete nahi hua.",
        status: "failed",
      }));
      toast({ title: "Error", description: "Something went wrong during extraction", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const saveExtracted = async () => {
    setIsLoading(true);
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      
      for (const q of extractedPreview) {
        await fetch("/api/admin/crackit/questions", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
          },
          body: JSON.stringify({
            ...q,
            ...extractAcademicTarget,
            metadata: {
              ...(typeof q.metadata === "object" && q.metadata !== null ? q.metadata : {}),
              extractedBy: "ai"
            }
          }),
        });
      }
      toast({ title: "Success", description: "Questions saved to bank." });
      closeExtractModal(false);
      fetchQuestions();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save some questions", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openExtractModal = () => {
    setExtractAcademicTarget(createBlankAcademicTarget());
    setExtractedPreview([]);
    setExtractionProgress({
      elapsedSeconds: 0,
      percent: 0,
      title: "Ready",
      detail: "Upload start karne ke baad realtime progress yaha dikhega.",
      status: "idle",
    });
    setExtractModalOpen(true);
  };

  const closeExtractModal = (open: boolean) => {
    setExtractModalOpen(open);
    if (!open) {
      setExtractAcademicTarget(createBlankAcademicTarget());
      setExtractedPreview([]);
      setIsExtracting(false);
      setExtractionProgress({
        elapsedSeconds: 0,
        percent: 0,
        title: "Ready",
        detail: "Upload start karne ke baad realtime progress yaha dikhega.",
        status: "idle",
      });
    }
  };

  const normalizeQuestionForEdit = (question: any) => {
    const options = Array.isArray(question.options)
      ? question.options
      : typeof question.options === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(question.options);
              return Array.isArray(parsed) ? parsed : ["", "", "", ""];
            } catch {
              return ["", "", "", ""];
            }
          })()
        : ["", "", "", ""];

    const correctAnswer = typeof question.correct_answer === "object" && question.correct_answer !== null
      ? question.correct_answer
      : typeof question.correct_answer === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(question.correct_answer);
              return typeof parsed === "object" && parsed !== null ? parsed : { value: "" };
            } catch {
              return { value: question.correct_answer };
            }
          })()
        : { value: "" };

    return {
      ...createBlankQuestion(),
      ...question,
      options: [...options, "", "", "", ""].slice(0, Math.max(4, options.length)),
      correct_answer: correctAnswer,
      metadata: typeof question.metadata === "object" && question.metadata !== null ? question.metadata : {}
    };
  };

  const openAddQuestionModal = () => {
    setManualQuestion(createBlankQuestion());
    setManualModalOpen(true);
  };

  const openEditQuestionModal = (question: any) => {
    const normalized = normalizeQuestionForEdit(question);
    setManualQuestion(normalized);
    setManualModalOpen(true);
  };

  const closeManualQuestionModal = (open: boolean) => {
    setManualModalOpen(open);
    if (!open) {
      setManualQuestion(createBlankQuestion());
    }
  };

  const handleSaveManual = async () => {
    if (!manualQuestion.question_text) {
      toast({ title: "Validation Error", description: "Question text is required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      
      const res = await fetch("/api/admin/crackit/questions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify(manualQuestion),
      });
      if (res.ok) {
        toast({ title: "Success", description: isEditingQuestion ? "Question updated." : "Question added manually." });
        closeManualQuestionModal(false);
        fetchQuestions();
      } else {
        const err = await res.json();
        console.error("Save Question Error:", err);
        toast({ title: "Error", description: err.message || "Failed to add question", variant: "destructive" });
      }
    } catch (e) {
      console.error("Save Question Catch Error:", e);
      toast({ title: "Error", description: "Failed to save question", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuestion = async (question: any) => {
    if (!question?.id) return;
    const confirmed = window.confirm("Delete this question from Question Bank?");
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      const res = await fetch(`/api/admin/crackit/questions/${encodeURIComponent(question.id)}`, {
        method: "DELETE",
        headers: adminToken ? { "Authorization": `Bearer ${adminToken}` } : {},
      });

      if (res.ok) {
        setQuestions((prev) => prev.filter((item) => item.id !== question.id));
        setSelectedQuestionIds((prev) => prev.filter((id) => id !== question.id));
        setSelectedQuestionBankIds((prev) => prev.filter((id) => id !== String(question.id || "")));
        toast({ title: "Deleted", description: "Question removed from Question Bank." });
      } else {
        const err = await res.json();
        toast({ title: "Delete Failed", description: err.message || "Failed to delete question", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Delete Failed", description: "Failed to delete question", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleQuestionBankSelection = (questionId: unknown, checked: boolean) => {
    const id = String(questionId || "").trim();
    if (!id) return;
    setSelectedQuestionBankIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const toggleAllVisibleQuestionBankSelection = (checked: boolean) => {
    setSelectedQuestionBankIds((prev) => {
      if (!checked) return prev.filter((id) => !visibleQuestionIds.includes(id));
      const next = new Set(prev);
      visibleQuestionIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const handleBulkDeleteQuestions = async () => {
    const ids = selectedQuestionBankIds;
    if (ids.length === 0) {
      toast({ title: "No Questions Selected", description: "Select questions before deleting.", variant: "destructive" });
      return;
    }
    const confirmed = window.confirm(`Delete ${ids.length} selected question${ids.length === 1 ? "" : "s"} from Question Bank?`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      const res = await fetch("/api/admin/crackit/questions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });

      if (res.ok) {
        const data = await res.json();
        const deletedCount = Number(data.deleted || ids.length);
        setQuestions((prev) => prev.filter((item) => !ids.includes(String(item.id || ""))));
        setSelectedQuestionIds((prev) => prev.filter((id) => !ids.includes(String(id || ""))));
        setSelectedQuestionBankIds([]);
        toast({ title: "Deleted", description: `${deletedCount} question${deletedCount === 1 ? "" : "s"} removed from Question Bank.` });
      } else {
        const err = await res.json();
        toast({ title: "Delete Failed", description: err.message || "Failed to delete selected questions", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Delete Failed", description: "Failed to delete selected questions", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Paper State
  const [paperModalOpen, setPaperModalOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedPaperChapterIds, setSelectedPaperChapterIds] = useState<string[]>([]);
  const [paperQuestionFilters, setPaperQuestionFilters] = useState({ search: "", difficulty: "all", type: "all" });
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [autoAssignForm, setAutoAssignForm] = useState(createBlankAutoAssignForm());
  const [paperForm, setPaperForm] = useState(createBlankPaperForm());
  const [isPaperThumbnailUploading, setIsPaperThumbnailUploading] = useState(false);
  const paperSubjects = getSubjectsForAcademic(paperForm.course_id, paperForm.level_id);
  const paperChapters = getChaptersForSubject(paperForm.subject_id);
  const paperQuestionPoolBase = questions.filter((q) => {
    if (!paperForm.course_id || !paperForm.level_id || !paperForm.subject_id) return false;
    if (String(q.course_id || "") !== paperForm.course_id) return false;
    if (String(q.level_id || "") !== paperForm.level_id) return false;
    if (String(q.subject_id || "") !== paperForm.subject_id) return false;
    if (selectedPaperChapterIds.length === 0) return false;
    return selectedPaperChapterIds.includes(String(q.chapter_id || ""));
  });
  const paperQuestionPool = paperQuestionPoolBase.filter((q) => {
    const search = paperQuestionFilters.search.trim().toLowerCase();
    if (search && !String(q.question_text || "").toLowerCase().includes(search)) return false;
    if (paperQuestionFilters.difficulty !== "all" && String(q.difficulty || "medium") !== paperQuestionFilters.difficulty) return false;
    if (paperQuestionFilters.type !== "all" && String(q.type || "mcq") !== paperQuestionFilters.type) return false;
    return true;
  });
  const paperQuestionPoolCounts = {
    easy: paperQuestionPool.filter((q) => String(q.difficulty || "medium") === "easy").length,
    medium: paperQuestionPool.filter((q) => String(q.difficulty || "medium") === "medium").length,
    hard: paperQuestionPool.filter((q) => String(q.difficulty || "medium") === "hard").length,
  };

  const openCreatePaperModal = () => {
    setSelectedPaper(null);
    setSelectedQuestionIds([]);
    setSelectedPaperChapterIds([]);
    setPaperQuestionFilters({ search: "", difficulty: "all", type: "all" });
    setAutoAssignForm(createBlankAutoAssignForm());
    setPaperForm(createBlankPaperForm());
    setPaperModalOpen(true);
  };

  const openEditPaperModal = (paper: any) => {
    setSelectedPaper(paper);
    const paperQuestionIds = Array.isArray(paper.questionIds) ? paper.questionIds : [];
    setSelectedQuestionIds(paperQuestionIds);
    const inferredChapterIds = Array.from(new Set(
      questions
        .filter((question) => paperQuestionIds.includes(question.id))
        .map((question) => String(question.chapter_id || ""))
        .filter(Boolean),
    ));
    setSelectedPaperChapterIds(inferredChapterIds.length > 0 ? inferredChapterIds : (paper.chapterId ? [paper.chapterId] : []));
    setPaperQuestionFilters({ search: "", difficulty: "all", type: "all" });
    setAutoAssignForm(createBlankAutoAssignForm());
    setPaperForm({
      ...createBlankPaperForm(),
      title: paper.title || "",
      description: paper.description || "",
      price: Number(paper.price || 0),
      original_price: Number(paper.originalPrice || 0),
      total_time: Number(paper.totalTime || 60),
      question_time_limit_seconds: Number(paper.questionTimeLimitSeconds || 0),
      passing_percent: Number(paper.passingPercent || 40),
      attempts_allowed: Number(paper.attemptsAllowed || 1),
      nature: paper.nature || "objective",
      thumbnail_url: paper.thumbnailUrl || "",
      course_id: paper.courseId || "",
      level_id: paper.levelId || "",
      subject_id: paper.subjectId || "",
      chapter_id: paper.chapterId || "",
      paper_code: paper.paperCode || ""
    });
    setPaperModalOpen(true);
  };

  const closePaperModal = (open: boolean) => {
    setPaperModalOpen(open);
    if (!open) {
      setSelectedPaper(null);
      setSelectedQuestionIds([]);
      setSelectedPaperChapterIds([]);
      setPaperQuestionFilters({ search: "", difficulty: "all", type: "all" });
      setAutoAssignOpen(false);
      setAutoAssignForm(createBlankAutoAssignForm());
      setPaperForm(createBlankPaperForm());
    }
  };

  const togglePaperChapter = (chapterId: string) => {
    setSelectedPaperChapterIds((prev) => {
      const next = prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId];
      setSelectedQuestionIds((selectedIds) => selectedIds.filter((id) => {
        const question = questions.find((item) => item.id === id);
        if (!question) return false;
        return next.includes(String(question.chapter_id || ""));
      }));
      return next;
    });
  };

  const shuffleQuestions = (items: any[]) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  };

  const handleAutoAssignQuestions = () => {
    const nextIds = ["easy", "medium", "hard"].flatMap((difficulty) => {
      const count = Math.max(0, Number(autoAssignForm[difficulty as keyof typeof autoAssignForm] || 0));
      return shuffleQuestions(paperQuestionPool.filter((q) => String(q.difficulty || "medium") === difficulty))
        .slice(0, count)
        .map((q) => q.id);
    });

    setSelectedQuestionIds(Array.from(new Set(nextIds)));
    setAutoAssignOpen(false);
    toast({ title: "Questions Assigned", description: `${nextIds.length} random questions selected.` });
  };

  const handlePaperThumbnailUpload = async (file?: File | null) => {
    if (!file) return;
    setIsPaperThumbnailUploading(true);
    try {
      const uploaded = await adminApi.uploadImageWithProgress(file, "test-papers");
      setPaperForm((prev) => ({ ...prev, thumbnail_url: uploaded.url }));
      toast({ title: "Thumbnail Uploaded", description: "Test paper thumbnail added." });
    } catch (error) {
      toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "Thumbnail upload failed", variant: "destructive" });
    } finally {
      setIsPaperThumbnailUploading(false);
    }
  };

  const handleCreatePaper = async () => {
    if (!paperForm.title) {
      toast({ title: "Validation Error", description: "Paper title is required", variant: "destructive" });
      return;
    }

    if (selectedQuestionIds.length === 0) {
      toast({ title: "Validation Error", description: "Select at least one question", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;

      const paperData = {
        ...(selectedPaper?.id ? { id: selectedPaper.id } : {}),
        ...paperForm,
        chapter_id: selectedPaperChapterIds[0] || paperForm.chapter_id || "",
        category: "mock",
        remark_teacher: "",
        remark_students: "",
        attempts_allowed: Math.max(1, Number(paperForm.attempts_allowed || 1)),
        question_time_limit_seconds: Math.max(0, Number(paperForm.question_time_limit_seconds || 0)),
        thumbnail_url: paperForm.thumbnail_url,
        is_visible: true,
        question_ids: selectedQuestionIds,
        is_published: true
      };

      const res = await fetch("/api/admin/crackit/papers", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify(paperData),
      });

      if (res.ok) {
        toast({ title: "Success", description: selectedPaper ? "Test paper updated successfully." : "Test paper created successfully." });
        closePaperModal(false);
        await refreshData();
        fetchQuestions();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.message || "Failed to create paper", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to create paper", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePaper = async (paper: any) => {
    if (!paper?.id) return;
    const confirmed = window.confirm(`Delete test paper "${paper.title || paper.paperCode || "Untitled"}"?`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const stored = localStorage.getItem("admin_session_v2");
      const adminToken = stored ? JSON.parse(stored)?.token : null;
      const res = await fetch(`/api/admin/crackit/papers/${encodeURIComponent(paper.id)}`, {
        method: "DELETE",
        headers: adminToken ? { "Authorization": `Bearer ${adminToken}` } : {},
      });

      if (res.ok) {
        toast({ title: "Deleted", description: "Test paper removed successfully." });
        await refreshData();
      } else {
        const err = await res.json();
        toast({ title: "Delete Failed", description: err.message || "Failed to delete test paper", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Delete Failed", description: "Failed to delete test paper", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {activeTab === "questions" ? "Question Bank" : "Test Paper Management"}
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            {activeTab === "questions" 
              ? "Manage questions, AI extraction & bank filters" 
              : "Create and organize test papers for students"}
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === "questions" ? (
            <>
              <Button onClick={openAddQuestionModal} variant="outline" className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold">
                <Plus className="w-4 h-4 mr-2" />
                Add Question (Manual)
              </Button>
              <Button onClick={openExtractModal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Extract Questions
              </Button>
            </>
          ) : (
            <Button onClick={openCreatePaperModal} className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
              <Plus className="w-4 h-4 mr-2" />
              Create Test Paper
            </Button>
          )}
        </div>
      </div>

      {activeTab === "questions" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-black text-slate-900">Dynamic Question Filter</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setQuestionFilters({ course_id: "all", level_id: "all", subject_id: "all", chapter_id: "all" });
                }}
              >
                Clear
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search questions..."
                  className="pl-10 h-10 bg-white border-slate-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={questionFilters.course_id}
                onValueChange={(v) => setQuestionFilters({ course_id: v, level_id: "all", subject_id: "all", chapter_id: "all" })}
              >
                <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {categories.filter(c => !c.parentId || c.parentId === "").map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={questionFilters.level_id}
                onValueChange={(v) => setQuestionFilters({ ...questionFilters, level_id: v, subject_id: "all", chapter_id: "all" })}
              >
                <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {categories.filter(c => {
                    if (questionFilters.course_id !== "all") return c.parentId === questionFilters.course_id;
                    return c.parentId && c.parentId !== "";
                  }).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={questionFilters.subject_id}
                onValueChange={(v) => setQuestionFilters({ ...questionFilters, subject_id: v, chapter_id: "all" })}
                disabled={questionFilters.level_id === "all"}
              >
                <SelectTrigger><SelectValue placeholder={questionFilters.level_id === "all" ? "Select level first" : "Subject"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {questionFilterSubjects.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={questionFilters.chapter_id}
                onValueChange={(v) => setQuestionFilters({ ...questionFilters, chapter_id: v })}
                disabled={questionFilters.subject_id === "all"}
              >
                <SelectTrigger><SelectValue placeholder={questionFilters.subject_id === "all" ? "Select subject first" : "Chapter"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chapters</SelectItem>
                  {questionFilterChapters.map((c: any) => (
                    <SelectItem key={c.id || c.name} value={c.id || c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing {filteredQuestions.length} of {questions.length} questions
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {selectedQuestionBankIds.length > 0 ? (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                    {selectedQuestionBankIds.length} selected
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  onClick={handleBulkDeleteQuestions}
                  disabled={isLoading || selectedQuestionBankIds.length === 0}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all visible questions"
                      checked={allVisibleQuestionsSelected}
                      disabled={visibleQuestionIds.length === 0}
                      onChange={(event) => toggleAllVisibleQuestionBankSelection(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3 font-bold text-slate-700">Question</th>
                  <th className="px-4 py-3 font-bold text-slate-700">Type</th>
                  <th className="px-4 py-3 font-bold text-slate-700">Difficulty</th>
                  <th className="px-4 py-3 font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuestions.map((q) => {
                  const questionId = String(q.id || "");
                  const isSelected = selectedQuestionBankIds.includes(questionId);
                  return (
                  <tr key={q.id} className={`transition-colors ${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/50"}`}>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        aria-label="Select question"
                        checked={isSelected}
                        onChange={(event) => toggleQuestionBankSelection(questionId, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="line-clamp-2">
                        <MathText value={q.question_text} />
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase">{q.type}</span></td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                        q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Edit question"
                          onClick={() => openEditQuestionModal(q)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600"
                          title="Delete question"
                          onClick={() => handleDeleteQuestion(q)}
                          disabled={isLoading}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filteredQuestions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      No questions found for selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-black text-slate-900">Dynamic Paper Filter</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPaperListFilters({ search: "", course_id: "all", level_id: "all", subject_id: "all", chapter_id: "all" })}
              >
                Clear
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search papers..."
                  className="pl-10 h-10 bg-white border-slate-200"
                  value={paperListFilters.search}
                  onChange={(e) => setPaperListFilters({ ...paperListFilters, search: e.target.value })}
                />
              </div>
              <Select
                value={paperListFilters.course_id}
                onValueChange={(v) => setPaperListFilters({ search: paperListFilters.search, course_id: v, level_id: "all", subject_id: "all", chapter_id: "all" })}
              >
                <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {categories.filter(c => !c.parentId || c.parentId === "").map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={paperListFilters.level_id}
                onValueChange={(v) => setPaperListFilters({ ...paperListFilters, level_id: v, subject_id: "all", chapter_id: "all" })}
              >
                <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {categories.filter(c => {
                    if (paperListFilters.course_id !== "all") return c.parentId === paperListFilters.course_id;
                    return c.parentId && c.parentId !== "";
                  }).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={paperListFilters.subject_id}
                onValueChange={(v) => setPaperListFilters({ ...paperListFilters, subject_id: v, chapter_id: "all" })}
                disabled={paperListFilters.level_id === "all"}
              >
                <SelectTrigger><SelectValue placeholder={paperListFilters.level_id === "all" ? "Select level first" : "Subject"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {paperListFilterSubjects.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={paperListFilters.chapter_id}
                onValueChange={(v) => setPaperListFilters({ ...paperListFilters, chapter_id: v })}
                disabled={paperListFilters.subject_id === "all"}
              >
                <SelectTrigger><SelectValue placeholder={paperListFilters.subject_id === "all" ? "Select subject first" : "Chapter"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chapters</SelectItem>
                  {paperListFilterChapters.map((c: any) => (
                    <SelectItem key={c.id || c.name} value={c.id || c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Showing {filteredTestPapers.length} of {testPapers.length} test papers
            </p>
          </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredTestPapers.map((paper) => (
            <div key={paper.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
              <div className="aspect-[16/7.5] overflow-hidden rounded-lg bg-slate-100">
                {paper.thumbnailUrl ? (
                  <img
                    src={resolveUploadAssetUrl(paper.thumbnailUrl, paper.thumbnailUrl)}
                    alt={paper.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">No Thumbnail</div>
                )}
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">{paper.paperCode}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Edit test paper"
                    onClick={() => openEditPaperModal(paper)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    title="Delete test paper"
                    onClick={() => handleDeletePaper(paper)}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight">{paper.title}</h3>
              <div className="flex flex-wrap gap-1">
                {getCategoryName(paper.courseId) && (
                  <span className="max-w-full truncate rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-700">{getCategoryName(paper.courseId)}</span>
                )}
                {getCategoryName(paper.levelId) && (
                  <span className="max-w-full truncate rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-black text-sky-700">{getCategoryName(paper.levelId)}</span>
                )}
                {getSubjectName(paper.subjectId) && (
                  <span className="max-w-full truncate rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{getSubjectName(paper.subjectId)}</span>
                )}
                {getChapterName(paper.subjectId, paper.chapterId) && (
                  <span className="max-w-full truncate rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">{getChapterName(paper.subjectId, paper.chapterId)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {paper.totalTime}m</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Q: {Number(paper.questionTimeLimitSeconds || 0) > 0 ? `${paper.questionTimeLimitSeconds}s` : "No timer"}</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3" /> {paper.passingPercent}% Pass</span>
              </div>
              <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
                <span className="text-xs font-black text-slate-900">₹{paper.price.toLocaleString()}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${paper.isVisible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {paper.isVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            </div>
          ))}
          {filteredTestPapers.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
              No test papers found for selected filters.
            </div>
          )}
        </div>
        </div>
      )}

      {/* AI Extraction Modal */}
      <Dialog open={extractModalOpen} onOpenChange={closeExtractModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI Question Extraction
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
              <div>
                <p className="text-sm font-black text-slate-900">Academic Target</p>
                <p className="text-xs text-slate-500">Select where extracted questions should be added before uploading.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Course *</Label>
                  <Select
                    value={extractAcademicTarget.course_id}
                    onValueChange={(v) => setExtractAcademicTarget({ ...extractAcademicTarget, course_id: v, level_id: "", subject_id: "", chapter_id: "" })}
                    disabled={extractedPreview.length > 0 || isExtracting}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => !c.parentId || c.parentId === "").map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level *</Label>
                  <Select
                    value={extractAcademicTarget.level_id}
                    onValueChange={(v) => setExtractAcademicTarget({ ...extractAcademicTarget, level_id: v, subject_id: "", chapter_id: "" })}
                    disabled={extractedPreview.length > 0 || isExtracting}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => {
                        if (extractAcademicTarget.course_id) return c.parentId === extractAcademicTarget.course_id;
                        return c.parentId && c.parentId !== "";
                      }).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Select
                    value={extractAcademicTarget.subject_id}
                    onValueChange={(v) => setExtractAcademicTarget({ ...extractAcademicTarget, subject_id: v, chapter_id: "" })}
                    disabled={!extractAcademicTarget.level_id || extractedPreview.length > 0 || isExtracting}
                  >
                    <SelectTrigger><SelectValue placeholder={extractAcademicTarget.level_id ? "Select Subject" : "Select level first"} /></SelectTrigger>
                    <SelectContent>
                      {extractSubjects.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chapter *</Label>
                  <Select
                    value={extractAcademicTarget.chapter_id}
                    onValueChange={(v) => setExtractAcademicTarget({ ...extractAcademicTarget, chapter_id: v })}
                    disabled={!extractAcademicTarget.subject_id || extractedPreview.length > 0 || isExtracting}
                  >
                    <SelectTrigger><SelectValue placeholder={extractAcademicTarget.subject_id ? "Select Chapter" : "Select subject first"} /></SelectTrigger>
                    <SelectContent>
                      {extractChapters.map((c: any) => (
                        <SelectItem key={c.id || c.name} value={c.id || c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {extractedPreview.length === 0 ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-4">
                {isExtracting || extractionProgress.status === "failed" ? (
                  <div className="w-full max-w-2xl space-y-4 text-left">
                    <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${extractionProgress.status === "failed" ? "bg-rose-50" : "bg-indigo-50"}`}>
                            {extractionProgress.status === "failed" ? (
                              <X className="h-5 w-5 text-rose-600" />
                            ) : (
                              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{extractionProgress.title}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500">{extractionProgress.detail}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-lg font-black ${extractionProgress.status === "failed" ? "text-rose-700" : "text-indigo-700"}`}>{extractionProgress.percent}%</p>
                          <p className="text-[11px] font-semibold text-slate-400">{extractionProgress.elapsedSeconds}s</p>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full transition-all duration-500 ${extractionProgress.status === "failed" ? "bg-rose-500" : "bg-indigo-600"}`} style={{ width: `${extractionProgress.percent}%` }} />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {extractionTimeline.map((step) => {
                        const isDone = extractionProgress.elapsedSeconds >= step.at;
                        const isActive = extractionProgress.title === step.title;
                        return (
                          <div key={step.title} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                            isActive
                              ? "border-indigo-200 bg-indigo-50"
                              : isDone
                                ? "border-emerald-100 bg-emerald-50/60"
                                : "border-slate-100 bg-white"
                          }`}>
                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              isDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                            }`}>
                              {isDone ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${isActive ? "text-indigo-800" : "text-slate-700"}`}>{step.title}</p>
                              <p className="text-[11px] text-slate-500">{step.detail}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {extractionProgress.status === "failed" ? (
                      <div className="text-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl border-slate-200"
                          onClick={() => setExtractionProgress({
                            elapsedSeconds: 0,
                            percent: 0,
                            title: "Ready",
                            detail: "Upload start karne ke baad realtime progress yaha dikhega.",
                            status: "idle",
                          })}
                        >
                          Try Again
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-bold">Upload Question Paper</p>
                      <p className="text-slate-500 text-sm">PDF or image accepted. AI will identify questions, options and answers.</p>
                    </div>
                    <label className={canUploadForExtraction ? "cursor-pointer" : "cursor-not-allowed"}>
                      <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={!canUploadForExtraction} />
                      <div className={`px-6 py-2 rounded-lg font-bold transition-all ${
                        canUploadForExtraction
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-slate-200 text-slate-500"
                      }`}>
                        {canUploadForExtraction ? "Select PDF / Image" : "Select academic target first"}
                      </div>
                    </label>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">Preview Extracted Questions ({extractedPreview.length})</p>
                {extractedPreview.map((q, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative group">
                    <div className="flex justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Question {i + 1}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-rose-500 opacity-0 group-hover:opacity-100" onClick={() => setExtractedPreview(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
                    </div>
                    <p className="text-sm font-bold text-slate-900"><MathText value={q.question_text} /></p>
                    {q.options && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt: string, oi: number) => (
                          <div key={oi} className={`text-[11px] p-2 rounded border ${q.correct_answer?.value === opt ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200'}`}>
                            <MathText value={opt} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 bg-white px-6 py-4">
            <Button variant="ghost" onClick={() => closeExtractModal(false)}>Cancel</Button>
            {extractedPreview.length > 0 && (
              <Button onClick={saveExtracted} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Save to Question Bank
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Question Modal */}
      <Dialog open={manualModalOpen} onOpenChange={closeManualQuestionModal}>
        <DialogContent className="max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-amber-50 px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-950">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                {isEditingQuestion ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </span>
              {isEditingQuestion ? "Edit Question" : "Add Question Manually"}
            </DialogTitle>
            <p className="text-sm font-semibold text-slate-500">Course, level, subject, chapter, math text and answer in one clean form.</p>
          </DialogHeader>
          <div className="max-h-[72vh] space-y-5 overflow-y-auto bg-slate-50/70 px-6 py-5">
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={manualQuestion.course_id} onValueChange={(v) => setManualQuestion({ ...manualQuestion, course_id: v, level_id: "", subject_id: "", chapter_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => !c.parentId || c.parentId === "").map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={manualQuestion.level_id} onValueChange={(v) => setManualQuestion({ ...manualQuestion, level_id: v, subject_id: "", chapter_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => {
                      if (manualQuestion.course_id) {
                        return c.parentId === manualQuestion.course_id;
                      }
                      return c.parentId && c.parentId !== "";
                    }).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select 
                  value={manualQuestion.subject_id} 
                  onValueChange={(v) => {
                    setManualQuestion({ ...manualQuestion, subject_id: v, chapter_id: "" });
                  }}
                  disabled={!manualQuestion.level_id}
                >
                  <SelectTrigger><SelectValue placeholder={manualQuestion.level_id ? "Select Subject" : "Select level first"} /></SelectTrigger>
                  <SelectContent>
                    {manualSubjects.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chapter</Label>
                <Select value={manualQuestion.chapter_id} onValueChange={(v) => setManualQuestion({ ...manualQuestion, chapter_id: v })} disabled={!manualQuestion.subject_id}>
                  <SelectTrigger><SelectValue placeholder={manualQuestion.subject_id ? "Select Chapter" : "Select subject first"} /></SelectTrigger>
                  <SelectContent>
                    {manualChapters.map((c: any) => (
                      <SelectItem key={c.id || c.name} value={c.id || c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Label>Question Text *</Label>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setManualMathView("latex")}
                    className={`rounded-md px-3 py-1 text-xs font-bold ${manualMathView === "latex" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    LaTeX
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualMathView("math")}
                    className={`rounded-md px-3 py-1 text-xs font-bold ${manualMathView === "math" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    Math
                  </button>
                </div>
              </div>
              {manualMathView === "latex" ? (
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  placeholder="Type your question here. Example: What is \\frac{x}{2}?"
                  value={manualQuestion.question_text}
                  onChange={(e) => setManualQuestion({ ...manualQuestion, question_text: e.target.value })}
                />
              ) : (
                <div className="min-h-[100px] rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900">
                  <MathText value={manualQuestion.question_text || "Question preview will appear here"} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={manualQuestion.type} onValueChange={(v) => setManualQuestion({ ...manualQuestion, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="msq">Multiple Selection</SelectItem>
                    <SelectItem value="tf">True/False</SelectItem>
                    <SelectItem value="short">Short Answer</SelectItem>
                    <SelectItem value="fill">Fill in the blanks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={manualQuestion.difficulty} onValueChange={(v) => setManualQuestion({ ...manualQuestion, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {["mcq", "msq"].includes(manualQuestion.type) && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <Label>Options & Correct Answer</Label>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">Select correct</span>
                </div>
                {manualQuestion.options.map((opt: string, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                    <div className="space-y-1">
                      {manualMathView === "latex" ? (
                        <Input
                          placeholder={`Option ${i + 1}`}
                          value={opt}
                          className="font-mono"
                          onChange={(e) => {
                            const next = [...manualQuestion.options];
                            next[i] = e.target.value;
                            setManualQuestion({ ...manualQuestion, options: next });
                          }}
                        />
                      ) : (
                        <div className="min-h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                          <MathText value={opt || `Option ${i + 1}`} />
                        </div>
                      )}
                    </div>
                    <input 
                      type="radio" 
                      name="correct" 
                      checked={manualQuestion.correct_answer?.value === opt && opt !== ""} 
                      onChange={() => setManualQuestion({ ...manualQuestion, correct_answer: { value: opt } })}
                      className="w-4 h-4 text-indigo-600"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Label>Explanation (Optional)</Label>
              {manualMathView === "latex" ? (
                <Input
                  placeholder="Explain why this answer is correct"
                  value={manualQuestion.explanation}
                  className="font-mono"
                  onChange={(e) => setManualQuestion({ ...manualQuestion, explanation: e.target.value })}
                />
              ) : (
                <div className="min-h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <MathText value={manualQuestion.explanation || "Explanation preview will appear here"} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 bg-white px-6 py-4">
            <Button variant="ghost" onClick={() => closeManualQuestionModal(false)}>Cancel</Button>
            <Button onClick={handleSaveManual} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {isEditingQuestion ? "Update Question" : "Save Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Paper Create/Edit Modal */}
      <Dialog open={paperModalOpen} onOpenChange={closePaperModal}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-950">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                <FileText className="h-5 w-5" />
              </span>
              {selectedPaper ? "Edit Test Paper" : "Create New Test Paper"}
            </DialogTitle>
            <p className="text-sm font-semibold text-slate-500">Build paper details, dynamic academic filters and question assignment.</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-slate-50/70 px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
              <div className="space-y-2">
                <Label>Paper Code *</Label>
                <Input 
                  placeholder="e.g. KSDVC0" 
                  value={paperForm.paper_code}
                  onChange={(e) => setPaperForm({ ...paperForm, paper_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Paper Title *</Label>
                <Input 
                  placeholder="e.g. Mathematics Final Exam" 
                  value={paperForm.title}
                  onChange={(e) => setPaperForm({ ...paperForm, title: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Label>Description</Label>
              <textarea 
                className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="Briefly describe what this test covers..."
                value={paperForm.description}
                onChange={(e) => setPaperForm({ ...paperForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
              <div className="space-y-2">
                <Label>Nature</Label>
                <Select 
                  value={paperForm.nature} 
                  onValueChange={(v) => setPaperForm({ ...paperForm, nature: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objective">Objective</SelectItem>
                    <SelectItem value="subjective">Subjective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Time (Minutes)</Label>
                <Input 
                  type="number" 
                  value={paperForm.total_time}
                  onChange={(e) => setPaperForm({ ...paperForm, total_time: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Question Time (Seconds)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0 = No time"
                  value={paperForm.question_time_limit_seconds}
                  onChange={(e) => setPaperForm({ ...paperForm, question_time_limit_seconds: Math.max(0, Number(e.target.value || 0)) })}
                />
                <p className="text-[11px] font-semibold text-slate-500">0 = no timer. Enter 10, 20, 30 or any seconds manually.</p>
              </div>
              <div className="space-y-2">
                <Label>Passing %</Label>
                <Input 
                  type="number" 
                  value={paperForm.passing_percent}
                  onChange={(e) => setPaperForm({ ...paperForm, passing_percent: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[220px_1fr]">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="aspect-video w-full bg-slate-100">
                  {paperForm.thumbnail_url ? (
                    <img
                      src={resolveUploadAssetUrl(paperForm.thumbnail_url, paperForm.thumbnail_url)}
                      alt="Test paper thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                      Thumbnail
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Thumbnail</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={isPaperThumbnailUploading}
                    onChange={(e) => void handlePaperThumbnailUpload(e.target.files?.[0])}
                  />
                  <p className="text-xs font-semibold text-slate-500">Course thumbnail ke same ratio me image show hogi.</p>
                </div>
                <div className="space-y-2">
                  <Label>Attempts Allowed</Label>
                  <Input
                    type="number"
                    min={1}
                    value={paperForm.attempts_allowed}
                    onChange={(e) => setPaperForm({ ...paperForm, attempts_allowed: Math.max(1, Number(e.target.value || 1)) })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sale Price (₹) *</Label>
                <Input 
                  type="number" 
                  value={paperForm.price}
                  onChange={(e) => setPaperForm({ ...paperForm, price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Original Price (₹)</Label>
                <Input 
                  type="number" 
                  value={paperForm.original_price}
                  onChange={(e) => setPaperForm({ ...paperForm, original_price: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-600" />
                <Label className="text-indigo-600 font-black">Dynamic Academic Filter</Label>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select 
                    value={paperForm.course_id} 
                    onValueChange={(v) => {
                      setPaperForm({ ...paperForm, course_id: v, level_id: "", subject_id: "", chapter_id: "" });
                      setSelectedPaperChapterIds([]);
                      setSelectedQuestionIds([]);
                      setPaperQuestionFilters({ search: "", difficulty: "all", type: "all" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Course" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => !c.parentId || c.parentId === "").map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select 
                    value={paperForm.level_id} 
                    onValueChange={(v) => {
                      setPaperForm({ ...paperForm, level_id: v, subject_id: "", chapter_id: "" });
                      setSelectedPaperChapterIds([]);
                      setSelectedQuestionIds([]);
                      setPaperQuestionFilters({ search: "", difficulty: "all", type: "all" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Level" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => {
                        if (paperForm.course_id) return c.parentId === paperForm.course_id;
                        return c.parentId && c.parentId !== "";
                      }).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select 
                    value={paperForm.subject_id} 
                    onValueChange={(v) => {
                      setPaperForm({ ...paperForm, subject_id: v, chapter_id: "" });
                      setSelectedPaperChapterIds([]);
                      setSelectedQuestionIds([]);
                      setPaperQuestionFilters({ search: "", difficulty: "all", type: "all" });
                    }}
                    disabled={!paperForm.level_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={paperForm.level_id ? "Select Subject" : "Select level first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {paperSubjects.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chapters (Multiple)</Label>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 space-y-1">
                    {!paperForm.subject_id ? (
                      <p className="px-2 py-3 text-xs font-semibold text-slate-500">Select subject first</p>
                    ) : paperChapters.length === 0 ? (
                      <p className="px-2 py-3 text-xs font-semibold text-slate-500">No chapters found</p>
                    ) : paperChapters.map((chapter: any) => {
                      const chapterId = String(chapter.id || chapter.name);
                      return (
                        <label key={chapterId} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                            checked={selectedPaperChapterIds.includes(chapterId)}
                            onChange={() => togglePaperChapter(chapterId)}
                          />
                          <span className="font-semibold text-slate-700">{chapter.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-emerald-600 font-black">Question Selection</Label>
                  <p className="text-xs font-semibold text-slate-500">
                    {selectedPaperChapterIds.length > 0
                      ? "Showing questions from selected chapters only"
                      : "Select one or more chapters to show questions"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {paperQuestionPool.length} Available
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    disabled={paperQuestionPool.length === 0}
                    onClick={() => {
                      setAutoAssignForm(createBlankAutoAssignForm());
                      setAutoAssignOpen(true);
                    }}
                  >
                    Auto Assign Questions
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[1fr_160px_160px_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Filter questions by text..."
                    className="h-10 bg-white pl-10"
                    value={paperQuestionFilters.search}
                    onChange={(e) => setPaperQuestionFilters({ ...paperQuestionFilters, search: e.target.value })}
                  />
                </div>
                <Select
                  value={paperQuestionFilters.difficulty}
                  onValueChange={(v) => setPaperQuestionFilters({ ...paperQuestionFilters, difficulty: v })}
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Difficulty</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={paperQuestionFilters.type}
                  onValueChange={(v) => setPaperQuestionFilters({ ...paperQuestionFilters, type: v })}
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="mcq">MCQ</SelectItem>
                    <SelectItem value="msq">MSQ</SelectItem>
                    <SelectItem value="tf">True/False</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="fill">Fill</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10"
                  onClick={() => setPaperQuestionFilters({ search: "", difficulty: "all", type: "all" })}
                >
                  Clear
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {paperQuestionPool.map((q) => (
                  <label key={q.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                      checked={selectedQuestionIds.includes(q.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                        } else {
                          setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== q.id));
                        }
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate"><MathText value={q.question_text} /></p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">{q.type}</span>
                        <span className="text-[9px] font-black text-amber-500 uppercase">{q.difficulty}</span>
                      </div>
                    </div>
                  </label>
                ))}
                {paperQuestionPool.length === 0 && (
                  <div className="p-8 text-center text-sm font-semibold text-slate-500">
                    No questions found for selected course, level, subject and chapters.
                  </div>
                )}
              </div>
              {selectedQuestionIds.length > 0 && (
                <p className="text-xs font-bold text-indigo-600">{selectedQuestionIds.length} questions selected</p>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 bg-white px-6 py-4">
            <Button variant="ghost" onClick={() => closePaperModal(false)}>Cancel</Button>
            <Button 
              onClick={handleCreatePaper} 
              disabled={isLoading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (selectedPaper ? <Check className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />)}
              {selectedPaper ? "Update Paper" : "Create Paper"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={autoAssignOpen} onOpenChange={setAutoAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Auto Assign Questions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
              Available: {paperQuestionPool.length} questions
              <span className="ml-2 text-emerald-700">Easy {paperQuestionPoolCounts.easy}</span>
              <span className="ml-2 text-amber-700">Medium {paperQuestionPoolCounts.medium}</span>
              <span className="ml-2 text-rose-700">Hard {paperQuestionPoolCounts.hard}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Easy</Label>
                <Input
                  type="number"
                  min={0}
                  max={paperQuestionPoolCounts.easy}
                  value={autoAssignForm.easy}
                  onChange={(e) => setAutoAssignForm({ ...autoAssignForm, easy: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Medium</Label>
                <Input
                  type="number"
                  min={0}
                  max={paperQuestionPoolCounts.medium}
                  value={autoAssignForm.medium}
                  onChange={(e) => setAutoAssignForm({ ...autoAssignForm, medium: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hard</Label>
                <Input
                  type="number"
                  min={0}
                  max={paperQuestionPoolCounts.hard}
                  value={autoAssignForm.hard}
                  onChange={(e) => setAutoAssignForm({ ...autoAssignForm, hard: Number(e.target.value) })}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Random questions selected chapters ke pool se pick honge. Existing selected questions replace ho jayenge.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAutoAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAutoAssignQuestions} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Clock = ({ className }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export default AdminCrackIt;
