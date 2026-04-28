import { useEffect, useMemo, useRef, useState } from "react";
import {
  adminApi,
  type AdminCategoryItem,
  type CourseMasterDeliveryMode,
  type CourseMasterLanguage,
  type CourseMasterAttemptOption,
  type CourseMasterPricingCombination,
  type CourseMasterSubjectChapter,
  type CourseMasterSubject,
  type CourseMasterValidityOption,
  type CourseMasterViewMode,
} from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Save, LayoutDashboard, Eye, Clock, MonitorPlay, Languages, BookOpen, X, Check, Edit2, ListTree, ChevronRight, Folder, FolderOpen, FileText, Hash, GripVertical } from "lucide-react";
import * as XLSX from "xlsx";
import { useConfirm } from "@/context/ConfirmContext";

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export default function AdminMasters() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { confirm, prompt } = useConfirm();

  const [viewModes, setViewModes] = useState<CourseMasterViewMode[]>([]);
  const [validityOptions, setValidityOptions] = useState<CourseMasterValidityOption[]>([]);
  const [deliveryModes, setDeliveryModes] = useState<CourseMasterDeliveryMode[]>([]);
  const [languages, setLanguages] = useState<CourseMasterLanguage[]>([]);
  const [attemptOptions, setAttemptOptions] = useState<CourseMasterAttemptOption[]>([]);
  const [pricingCombinations, setPricingCombinations] = useState<CourseMasterPricingCombination[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [subjects, setSubjects] = useState<CourseMasterSubject[]>([]);

  const load = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getCourseMasters();
      setViewModes(response.viewModes || []);
      setValidityOptions(response.validityOptions || []);
      setDeliveryModes(response.deliveryModes || []);
      setLanguages(response.languages || []);
      setAttemptOptions(response.attemptOptions || []);
      setPricingCombinations(response.pricingCombinations || []);
      setCategories(response.categories || []);
      setSubjects(response.subjects || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load master module");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addViewMode = () => {
    setViewModes((prev) => [
      ...prev,
      {
        id: uid("view-mode"),
        name: `View ${prev.length + 1}`,
        maxViews: 1,
        isLifetime: false,
        isActive: true,
        sortOrder: prev.length + 1,
      },
    ]);
  };

  const addValidityOption = () => {
    setValidityOptions((prev) => [
      ...prev,
      {
        id: uid("validity"),
        label: `Validity ${prev.length + 1}`,
        days: 30,
        isLifetime: false,
        isActive: true,
        sortOrder: prev.length + 1,
      },
    ]);
  };

  const addDeliveryMode = () => {
    setDeliveryModes((prev) => [
      ...prev,
      { id: uid("delivery-mode"), name: "", isActive: true, sortOrder: prev.length + 1 },
    ]);
  };

  const addLanguage = () => {
    setLanguages((prev) => [
      ...prev,
      { id: uid("language"), name: "", isActive: true, sortOrder: prev.length + 1 },
    ]);
  };

  const addAttemptOption = () => {
    setAttemptOptions((prev) => [
      ...prev,
      {
        id: uid("attempt"),
        label: "",
        endDate: "",
        isActive: true,
        sortOrder: prev.length + 1,
      },
    ]);
  };

  const [subjectPopup, setSubjectPopup] = useState<{ open: boolean; targetId: string; targetName: string; targetType: 'course' | 'level' }>({ open: false, targetId: '', targetName: '', targetType: 'course' });
  const [popupNewName, setPopupNewName] = useState('');
  const [popupEditingId, setPopupEditingId] = useState<string | null>(null);
  const [popupEditingName, setPopupEditingName] = useState('');
  const [chapterPopup, setChapterPopup] = useState<{ open: boolean; subjectId: string; subjectName: string }>({ open: false, subjectId: '', subjectName: '' });
  const [chapterNewName, setChapterNewName] = useState('');
  const [chapterNewNumber, setChapterNewNumber] = useState<number>(1);
  const [chapterEditingId, setChapterEditingId] = useState<string | null>(null);
  const [chapterEditingName, setChapterEditingName] = useState('');
  const [chapterEditingNumber, setChapterEditingNumber] = useState<number>(1);
  const [isImportingChapters, setIsImportingChapters] = useState(false);
  const chapterImportInputRef = useRef<HTMLInputElement | null>(null);
  const [courseQuickName, setCourseQuickName] = useState('');
  const [levelQuickName, setLevelQuickName] = useState('');
  const [isAddingCourseQuick, setIsAddingCourseQuick] = useState(false);
  const [isAddingLevelQuick, setIsAddingLevelQuick] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [dragCourseId, setDragCourseId] = useState('');
  const [dragLevelId, setDragLevelId] = useState('');
  const [dragSubjectId, setDragSubjectId] = useState('');
  const [dragChapterId, setDragChapterId] = useState('');
  const [subjectSerialDrafts, setSubjectSerialDrafts] = useState<Record<string, string>>({});
  const [chapterSerialDrafts, setChapterSerialDrafts] = useState<Record<string, string>>({});
  const [chapterSearch, setChapterSearch] = useState('');
  const [chapterPopupSearch, setChapterPopupSearch] = useState('');

  const openSubjectPopup = (id: string, name: string, type: 'course' | 'level') => {
    setSubjectPopup({ open: true, targetId: id, targetName: name, targetType: type });
    setPopupNewName('');
    setPopupEditingId(null);
  };

  const getSubjectChapters = (subjectId: string): CourseMasterSubjectChapter[] => {
    const subject = subjects.find((item) => item.id === subjectId);
    return Array.isArray(subject?.chapters)
      ? [...subject.chapters].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      : [];
  };

  const addSubjectToTarget = () => {
    const name = popupNewName.trim();
    if (!name) return;
    const { targetId, targetType } = subjectPopup;
    setSubjects((prev) => [...prev, {
      id: uid('subject'),
      name,
      courseIds: targetType === 'course' ? [targetId] : [],
      levelIds: targetType === 'level' ? [targetId] : [],
      isActive: true,
      sortOrder: prev.length + 1,
      chapters: [],
    }]);
    setPopupNewName('');
  };

  const openChapterPopup = (subjectId: string, subjectName: string) => {
    setChapterPopup({ open: true, subjectId, subjectName });
    setChapterNewName('');
    setChapterNewNumber(1);
    setChapterEditingId(null);
    setChapterEditingName('');
    setChapterEditingNumber(1);
    setChapterPopupSearch('');
  };

  const addChapterToSubject = () => {
    const name = chapterNewName.trim();
    const chapterNumber = Math.max(1, chapterNewNumber);
    if (!name || !chapterPopup.subjectId) return;
    setSubjects((prev) => prev.map((item) => {
      if (item.id !== chapterPopup.subjectId) return item;
      const prevChapters = Array.isArray(item.chapters) ? item.chapters : [];
      
      // Add new chapter with specified sortOrder
      const newChapter = {
        id: uid('chapter'),
        name,
        isActive: true,
        sortOrder: chapterNumber,
      };
      
      // Insert chapter and sort by sortOrder
      const updatedChapters = [...prevChapters, newChapter];
      const sortedChapters = [...updatedChapters].sort((a, b) => {
        if (a.sortOrder === b.sortOrder) {
          // If same sortOrder, new chapter goes after existing ones
          const aIndex = updatedChapters.findIndex(ch => ch.id === a.id);
          const bIndex = updatedChapters.findIndex(ch => ch.id === b.id);
          return aIndex - bIndex;
        }
        return a.sortOrder - b.sortOrder;
      });
      
      // Reassign sortOrder based on position to ensure consistency
      const finalChapters = sortedChapters.map((chapter, index) => ({
        ...chapter,
        sortOrder: index + 1,
      }));
      
      return {
        ...item,
        chapters: finalChapters,
      };
    }));
    setChapterNewName('');
    setChapterNewNumber(1);
  };

  const saveChapterEdit = (chapterId: string) => {
    const name = chapterEditingName.trim();
    const chapterNumber = Math.max(1, chapterEditingNumber);
    if (!name || !chapterPopup.subjectId) return;
    
    setSubjects((prev) => prev.map((item) => {
      if (item.id !== chapterPopup.subjectId) return item;
      const prevChapters = Array.isArray(item.chapters) ? item.chapters : [];
      
      // Update the chapter with new name and sortOrder
      const updatedChapters = prevChapters.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, name, sortOrder: chapterNumber } : chapter
      );
      
      // Sort chapters by sortOrder, then by original order for ties
      const sortedChapters = [...updatedChapters].sort((a, b) => {
        if (a.sortOrder === b.sortOrder) {
          // If same sortOrder, maintain original order
          const aIndex = prevChapters.findIndex(ch => ch.id === a.id);
          const bIndex = prevChapters.findIndex(ch => ch.id === b.id);
          return aIndex - bIndex;
        }
        return a.sortOrder - b.sortOrder;
      });
      
      // Reassign sortOrder based on position to ensure consistency
      const finalChapters = sortedChapters.map((chapter, index) => ({
        ...chapter,
        sortOrder: index + 1
      }));
      
      return {
        ...item,
        chapters: finalChapters,
      };
    }));
    
    setChapterEditingId(null);
    setChapterEditingName('');
    setChapterEditingNumber(1);
  };

  const removeChapterFromSubject = (chapterId: string) => {
    if (!chapterPopup.subjectId) return;
    setSubjects((prev) => prev.map((item) => {
      if (item.id !== chapterPopup.subjectId) return item;
      const prevChapters = Array.isArray(item.chapters) ? item.chapters : [];
      const nextChapters = prevChapters
        .filter((chapter) => chapter.id !== chapterId)
        .map((chapter, index) => ({ ...chapter, sortOrder: index + 1 }));
      return { ...item, chapters: nextChapters };
    }));
  };

  const downloadChapterImportSample = () => {
    const rows = [
      { chapter_name: "Introduction" },
      { chapter_name: "Core Concepts" },
      { chapter_name: "Practice Questions" },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "chapters");
    XLSX.writeFile(workbook, "chapter-import-sample.xlsx");
  };

  const importChaptersFromFile = async (file: File | null) => {
    if (!file || !chapterPopup.subjectId) return;
    setIsImportingChapters(true);
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("No sheet found in file");

      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
      if (!rows.length) throw new Error("File is empty");

      const extracted = rows
        .map((row) => {
          const chapterName =
            row.chapter_name ||
            row.chapter ||
            row.name ||
            Object.values(row)[0] ||
            "";
          return String(chapterName || "").trim();
        })
        .filter(Boolean);

      if (!extracted.length) throw new Error("No chapter names found. Use column: chapter_name");

      setSubjects((prev) => prev.map((item) => {
        if (item.id !== chapterPopup.subjectId) return item;
        const existing = Array.isArray(item.chapters) ? item.chapters : [];
        const existingNames = new Set(existing.map((chapter) => chapter.name.trim().toLowerCase()));
        const newNames = Array.from(new Set(extracted.map((name) => name.trim()))).filter((name) => !existingNames.has(name.toLowerCase()));
        if (!newNames.length) return item;
        const added = newNames.map((name, index) => ({
          id: uid("chapter"),
          name,
          isActive: true,
          sortOrder: existing.length + index + 1,
        }));
        return { ...item, chapters: [...existing, ...added] };
      }));

      setMessage("Chapters imported successfully. Click Save Changes to persist.");
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import chapters");
      setTimeout(() => setError(""), 7000);
    } finally {
      if (chapterImportInputRef.current) chapterImportInputRef.current.value = "";
      setIsImportingChapters(false);
    }
  };

  const addCourseFromExplorer = async () => {
    const name = courseQuickName.trim();
    if (!name || isAddingCourseQuick) return;
    const alreadyExists = categories.some(
      (item) => !item.parentId && item.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (alreadyExists) {
      setError("Course with this name already exists");
      return;
    }
    setIsAddingCourseQuick(true);
    try {
      const payload = {
        id: uid('course'),
        name,
        slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        color: '#3b82f6',
        parentId: null,
        sortOrder: categories.length + 1,
        isVisible: true,
      };
      const response = await adminApi.upsertCategory(payload);
      const next = response.item as AdminCategoryItem;
      setCategories((prev) => {
        const exists = prev.some((item) => item.id === next.id);
        return exists ? prev.map((item) => item.id === next.id ? next : item) : [...prev, next];
      });
      setSelectedCourseId(next.id);
      setCourseQuickName('');
      setMessage('Course added. Click Save Changes to persist master setup.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add course');
    } finally {
      setIsAddingCourseQuick(false);
    }
  };

  const addLevelFromExplorer = async () => {
    const name = levelQuickName.trim();
    if (!selectedCourseId || !name || isAddingLevelQuick) return;
    const alreadyExists = categories.some(
      (item) => item.parentId === selectedCourseId && item.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (alreadyExists) {
      setError("Level with this name already exists under selected course");
      return;
    }
    setIsAddingLevelQuick(true);
    try {
      const payload = {
        id: uid('level'),
        name,
        slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        color: '#0ea5e9',
        parentId: selectedCourseId,
        sortOrder: categories.filter((item) => item.parentId === selectedCourseId).length + 1,
        isVisible: true,
      };
      const response = await adminApi.upsertCategory(payload);
      const next = response.item as AdminCategoryItem;
      setCategories((prev) => {
        const exists = prev.some((item) => item.id === next.id);
        return exists ? prev.map((item) => item.id === next.id ? next : item) : [...prev, next];
      });
      setSelectedLevelId(next.id);
      setLevelQuickName('');
      setMessage('Level added. Click Save Changes to persist master setup.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add level');
    } finally {
      setIsAddingLevelQuick(false);
    }
  };

  const reorderArray = <T,>(list: T[], fromIndex: number, toIndex: number): T[] => {
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const upsertCategoryWithSort = async (item: AdminCategoryItem, sortOrder: number, parentId: string | null) => {
    return adminApi.upsertCategory({
      id: item.id,
      name: item.name,
      slug: item.slug || item.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      color: item.color || '#475569',
      parentId,
      sortOrder,
      isVisible: item.isVisible,
    });
  };

  const editCategoryFromExplorer = async (item: AdminCategoryItem) => {
    const nextName = await prompt({ title: 'Rename Category', defaultValue: item.name, confirmText: 'Rename' });
    if (!nextName || nextName === item.name) return;
    try {
      const response = await adminApi.upsertCategory({
        id: item.id,
        name: nextName,
        slug: item.slug || nextName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        color: item.color || '#475569',
        parentId: item.parentId,
        sortOrder: item.sortOrder,
        isVisible: item.isVisible,
      });
      const next = response.item as AdminCategoryItem;
      setCategories((prev) => prev.map((row) => row.id === next.id ? next : row));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const deleteCategoryFromExplorer = async (item: AdminCategoryItem) => {
    const isConfirmed = await confirm({ title: "Are you sure?", description: `Delete "${item.name}"?` });
    if (!isConfirmed) return;
    try {
      await adminApi.deleteCategory(item.id);
      setCategories((prev) => prev.filter((row) => row.id !== item.id));
      setSubjects((prev) => prev.map((subject) => ({
        ...subject,
        courseIds: (subject.courseIds || []).filter((id) => id !== item.id),
        levelIds: (subject.levelIds || []).filter((id) => id !== item.id),
      })));
      if (selectedCourseId === item.id) setSelectedCourseId('');
      if (selectedLevelId === item.id) setSelectedLevelId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleCourseDrop = async (targetCourseId: string) => {
    if (!dragCourseId || dragCourseId === targetCourseId) return;
    const ordered = [...masterCourses];
    const fromIndex = ordered.findIndex((item) => item.id === dragCourseId);
    const toIndex = ordered.findIndex((item) => item.id === targetCourseId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = reorderArray(ordered, fromIndex, toIndex).map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setCategories((prev) => prev.map((item) => {
      const found = reordered.find((row) => row.id === item.id);
      return found ? { ...item, sortOrder: found.sortOrder } : item;
    }));
    try {
      await Promise.all(reordered.map((item) => upsertCategoryWithSort(item, item.sortOrder, null)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder courses');
    } finally {
      setDragCourseId('');
    }
  };

  const handleLevelDrop = async (targetLevelId: string) => {
    if (!dragLevelId || dragLevelId === targetLevelId || !selectedCourseId) return;
    const ordered = [...masterLevels];
    const fromIndex = ordered.findIndex((item) => item.id === dragLevelId);
    const toIndex = ordered.findIndex((item) => item.id === targetLevelId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = reorderArray(ordered, fromIndex, toIndex).map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setCategories((prev) => prev.map((item) => {
      const found = reordered.find((row) => row.id === item.id);
      return found ? { ...item, sortOrder: found.sortOrder } : item;
    }));
    try {
      await Promise.all(reordered.map((item) => upsertCategoryWithSort(item, item.sortOrder, selectedCourseId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder levels');
    } finally {
      setDragLevelId('');
    }
  };

  const editSubjectFromExplorer = async (subjectId: string) => {
    const target = subjects.find((row) => row.id === subjectId);
    if (!target) return;
    const nextName = await prompt({ title: 'Rename Subject', defaultValue: target.name, confirmText: 'Rename' });
    if (!nextName || nextName === target.name) return;
    setSubjects((prev) => prev.map((item) => item.id === subjectId ? { ...item, name: nextName } : item));
  };

  const deleteSubjectFromExplorer = async (subjectId: string) => {
    const target = subjects.find((item) => item.id === subjectId);
    if (!target) return;
    const isConfirmed = await confirm({ title: "Delete Subject?", description: `Delete subject "${target.name}"?` });
    if (!isConfirmed) return;
    setSubjects((prev) => prev.filter((item) => item.id !== subjectId));
    if (selectedSubjectId === subjectId) setSelectedSubjectId('');
  };

  const handleSubjectDrop = (targetSubjectId: string) => {
    if (!dragSubjectId || dragSubjectId === targetSubjectId || !selectedLevelId) return;
    const ordered = [...masterSubjects];
    const fromIndex = ordered.findIndex((item) => item.id === dragSubjectId);
    const toIndex = ordered.findIndex((item) => item.id === targetSubjectId);
    if (fromIndex < 0 || toIndex < 0) return;
    const reordered = reorderArray(ordered, fromIndex, toIndex).map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setSubjects((prev) => prev.map((item) => {
      const found = reordered.find((row) => row.id === item.id);
      return found ? { ...item, sortOrder: found.sortOrder } : item;
    }));
    setDragSubjectId('');
  };

  const moveSubjectToSerial = (subjectId: string, serialRaw: string | number) => {
    if (!selectedLevelId) return;
    const numeric = Number(serialRaw);
    if (!Number.isFinite(numeric)) return;

    const ordered = [...masterSubjects];
    const currentIndex = ordered.findIndex((item) => item.id === subjectId);
    if (currentIndex < 0 || ordered.length <= 1) return;

    const targetSerial = Math.max(1, Math.floor(numeric));
    const boundedTarget = Math.min(ordered.length, targetSerial);
    if (boundedTarget === currentIndex + 1) return;

    const [moved] = ordered.splice(currentIndex, 1);
    ordered.splice(boundedTarget - 1, 0, moved);
    const reordered = ordered.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setSubjects((prev) => prev.map((item) => {
      const found = reordered.find((row) => row.id === item.id);
      return found ? { ...item, sortOrder: found.sortOrder } : item;
    }));
  };

  const applySubjectSerialMove = (subjectId: string, fallbackOrder: number) => {
    const draft = String(subjectSerialDrafts[subjectId] ?? "").trim();
    if (!draft) {
      setSubjectSerialDrafts((prev) => ({ ...prev, [subjectId]: String(fallbackOrder) }));
      return;
    }
    moveSubjectToSerial(subjectId, draft);
    setSubjectSerialDrafts((prev) => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
  };

  const editChapterFromExplorer = async (chapterId: string) => {
    const target = (subjects.flatMap((s) => s.chapters || []).find((c) => c.id === chapterId)) as CourseMasterSubjectChapter | undefined;
    if (!target) return;
    const nextName = await prompt({ title: 'Rename Chapter', defaultValue: target.name, confirmText: 'Rename' });
    if (!nextName || nextName === target.name) return;
    setSubjects((prev) => prev.map((item) => {
      if (item.id !== selectedSubjectId) return item;
      return {
        ...item,
        chapters: (item.chapters || []).map((chapter) => chapter.id === chapterId ? { ...chapter, name: nextName } : chapter),
      };
    }));
  };

  const deleteChapterFromExplorer = async (chapterId: string) => {
    if (!selectedSubjectId) return;
    const target = masterChapters.find((item) => item.id === chapterId);
    if (!target) return;
    const isConfirmed = await confirm({ title: "Delete Chapter?", description: `Delete chapter "${target.name}"?` });
    if (!isConfirmed) return;
    setSubjects((prev) => prev.map((item) => {
      if (item.id !== selectedSubjectId) return item;
      return {
        ...item,
        chapters: (item.chapters || []).filter((chapter) => chapter.id !== chapterId).map((chapter, index) => ({ ...chapter, sortOrder: index + 1 })),
      };
    }));
  };

  const handleChapterDrop = (targetChapterId: string) => {
    if (!dragChapterId || dragChapterId === targetChapterId || !selectedSubjectId) return;
    const ordered = [...masterChapters];
    const fromIndex = ordered.findIndex((item) => item.id === dragChapterId);
    const toIndex = ordered.findIndex((item) => item.id === targetChapterId);
    if (fromIndex < 0 || toIndex < 0) return;
    const reordered = reorderArray(ordered, fromIndex, toIndex).map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setSubjects((prev) => prev.map((item) => item.id === selectedSubjectId ? { ...item, chapters: reordered } : item));
    setDragChapterId('');
  };

  const moveChapterToSerial = (chapterId: string, serialRaw: string | number) => {
    if (!selectedSubjectId) return;
    const numeric = Number(serialRaw);
    if (!Number.isFinite(numeric)) return;

    const ordered = [...masterChapters];
    const currentIndex = ordered.findIndex((item) => item.id === chapterId);
    if (currentIndex < 0 || ordered.length <= 1) return;

    const targetSerial = Math.max(1, Math.floor(numeric));
    const boundedTarget = Math.min(ordered.length, targetSerial);
    if (boundedTarget === currentIndex + 1) return;

    const [moved] = ordered.splice(currentIndex, 1);
    ordered.splice(boundedTarget - 1, 0, moved);
    const reordered = ordered.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setSubjects((prev) => prev.map((item) => item.id === selectedSubjectId ? { ...item, chapters: reordered } : item));
  };

  const applyChapterSerialMove = (chapterId: string, fallbackOrder: number) => {
    const draft = String(chapterSerialDrafts[chapterId] ?? "").trim();
    if (!draft) {
      setChapterSerialDrafts((prev) => ({ ...prev, [chapterId]: String(fallbackOrder) }));
      return;
    }
    moveChapterToSerial(chapterId, draft);
    setChapterSerialDrafts((prev) => {
      const next = { ...prev };
      delete next[chapterId];
      return next;
    });
  };

  const removeSubjectFromTarget = (subjectId: string) => {
    const { targetId, targetType } = subjectPopup;
    setSubjects((prev) =>
      prev.flatMap((s) => {
        if (s.id !== subjectId) return [s];
        const newCourseIds = targetType === 'course' ? (s.courseIds || []).filter((id) => id !== targetId) : (s.courseIds || []);
        const newLevelIds = targetType === 'level' ? (s.levelIds || []).filter((id) => id !== targetId) : (s.levelIds || []);
        if (newCourseIds.length === 0 && newLevelIds.length === 0) return [];
        return [{ ...s, courseIds: newCourseIds, levelIds: newLevelIds }];
      })
    );
  };

  const saveSubjectEdit = (subjectId: string) => {
    const name = popupEditingName.trim();
    if (!name) return;
    setSubjects((prev) => prev.map((s) => s.id === subjectId ? { ...s, name } : s));
    setPopupEditingId(null);
  };

  const saveMasters = async () => {
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const cleanedViewModes = viewModes
        .map((item, index) => ({
          ...item,
          sortOrder: index + 1,
          name: String(item.name || `View ${index + 1}`).trim(),
        }))
        .filter((item) => item.name);

      const cleanedValidityOptions = validityOptions
        .map((item, index) => {
          const fallbackLabel = Number(item.days) > 0
            ? `${Math.floor(Number(item.days))} Days`
            : `Validity ${index + 1}`;
          return {
            ...item,
            sortOrder: index + 1,
            label: String(item.label || fallbackLabel).trim(),
          };
        })
        .filter((item) => item.label);

      const cleanedDeliveryModes = deliveryModes
        .map((item, index) => ({ ...item, sortOrder: index + 1, name: item.name.trim() }))
        .filter((item) => item.name);

      const cleanedAttemptOptions = attemptOptions
        .map((item, index) => ({
          ...item,
          sortOrder: index + 1,
          label: String(item.label || "").trim(),
          endDate: String(item.endDate || "").trim(),
        }))
        .filter((item) => item.label && item.endDate);

      const cleanedLanguages = languages
        .map((item, index) => ({ ...item, sortOrder: index + 1, name: item.name.trim() }))
        .filter((item) => item.name);

      const validCategoryIds = new Set(categories.map((item) => item.id));
      const validLevelIds = new Set(categories.filter((item) => item.parentId).map((item) => item.id));
      const cleanedSubjects = subjects
        .map((item, index) => ({
          ...item,
          sortOrder: index + 1,
          name: String(item.name || "").trim(),
          courseIds: Array.from(new Set((item.courseIds || []).filter((id) => validCategoryIds.has(id)))),
          levelIds: Array.from(new Set((item.levelIds || []).filter((id) => validLevelIds.has(id)))),
          chapters: (Array.isArray(item.chapters) ? item.chapters : [])
            .map((chapter, chapterIndex) => ({
              ...chapter,
              name: String(chapter.name || "").trim(),
              sortOrder: chapterIndex + 1,
            }))
            .filter((chapter) => chapter.name),
        }))
        .filter((item) => item.name);

      await adminApi.saveCourseMasters({
        viewModes: cleanedViewModes,
        validityOptions: cleanedValidityOptions,
        attemptOptions: cleanedAttemptOptions,
        deliveryModes: cleanedDeliveryModes,
        languages: cleanedLanguages,
        subjects: cleanedSubjects,
        pricingCombinations,
      });

      setMessage("Master configurations saved successfully");
      await load();
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save master module");
      setTimeout(() => setError(""), 7000);
    } finally {
      setIsSaving(false);
    }
  };

  const popupSubjects = useMemo(() => {
    if (!subjectPopup.targetId) return [];
    return subjects.filter((s) =>
      subjectPopup.targetType === 'course'
        ? (s.courseIds || []).includes(subjectPopup.targetId)
        : (s.levelIds || []).includes(subjectPopup.targetId)
    );
  }, [subjects, subjectPopup.targetId, subjectPopup.targetType]);

  const chapterPopupSubjects = getSubjectChapters(chapterPopup.subjectId);

  const masterCourses = useMemo(
    () => [...categories].filter((item) => !item.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const masterLevels = useMemo(
    () => [...categories].filter((item) => item.parentId === selectedCourseId).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, selectedCourseId],
  );

  const masterSubjects = useMemo(
    () => [...subjects].filter((item) => (item.levelIds || []).includes(selectedLevelId)).sort((a, b) => a.sortOrder - b.sortOrder),
    [subjects, selectedLevelId],
  );

  const masterChapters = useMemo(
    () => getSubjectChapters(selectedSubjectId),
    [subjects, selectedSubjectId],
  );

  const filteredMasterChapters = useMemo(() => {
    const needle = chapterSearch.trim().toLowerCase();
    if (!needle) return masterChapters;
    return masterChapters.filter((chapter) => String(chapter.name || '').toLowerCase().includes(needle));
  }, [chapterSearch, masterChapters]);

  const filteredChapterPopupSubjects = useMemo(() => {
    const needle = chapterPopupSearch.trim().toLowerCase();
    if (!needle) return chapterPopupSubjects;
    return chapterPopupSubjects.filter((chapter) => String(chapter.name || '').toLowerCase().includes(needle));
  }, [chapterPopupSearch, chapterPopupSubjects]);

  const selectedLevel = useMemo(
    () => categories.find((item) => item.id === selectedLevelId) || null,
    [categories, selectedLevelId],
  );

  const selectedSubject = useMemo(
    () => subjects.find((item) => item.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId],
  );

  useEffect(() => {
    setSelectedLevelId('');
    setSelectedSubjectId('');
  }, [selectedCourseId]);

  useEffect(() => {
    setSelectedSubjectId('');
    setChapterSearch('');
  }, [selectedLevelId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-gray-500">Loading master configurations...</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-500 pb-16">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-100 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Platform Masters</h1>
          <p className="mt-2 text-sm text-gray-500">
            Configure Course, Level, Subject, and other core master dropdowns.
          </p>
        </div>
        <Button 
          onClick={saveMasters} 
          disabled={isSaving} 
          className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}
      
      {message && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-emerald-800">{message}</p>
        </div>
      )}

      <Tabs defaultValue="categories" className="w-full space-y-8">
        <div className="relative overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="h-auto p-1.5 bg-gray-100/80 rounded-2xl flex-inline flex-nowrap w-max sm:w-auto overflow-hidden border border-gray-200/60 shadow-inner">
            <TabsTrigger value="categories" className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-gray-200 gap-2">
              <LayoutDashboard className="h-4 w-4" /> Course & Levels
            </TabsTrigger>
            <TabsTrigger value="view-modes" className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-gray-200 gap-2">
              <Eye className="h-4 w-4" /> View Modes
            </TabsTrigger>
            <TabsTrigger value="validities" className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-gray-200 gap-2">
              <Clock className="h-4 w-4" /> Validity
            </TabsTrigger>
            <TabsTrigger value="attempts" className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-gray-200 gap-2">
              <Clock className="h-4 w-4" /> Attempts
            </TabsTrigger>
            <TabsTrigger value="lecture-modes" className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-gray-200 gap-2">
              <MonitorPlay className="h-4 w-4" /> Lecture Modes
            </TabsTrigger>
            <TabsTrigger value="languages" className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-gray-200 gap-2">
              <Languages className="h-4 w-4" /> Languages
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="categories" className="m-0 focus-visible:outline-none">
          <div>
            <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 pb-4">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ListTree className="h-5 w-5 text-indigo-500" />
                  Course Architecture Explorer
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium">Build your hierarchy: Course → Level → Subject → Chapter. Select items to drill down.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y xl:divide-y-0 xl:divide-x divide-slate-100 bg-slate-50/30">
                  {/* COURSES COLUMN */}
                  <div className="p-4 flex flex-col h-[420px]">
                    <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center"><Folder className="h-3.5 w-3.5" /></div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Courses</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px] bg-white hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-all"
                        disabled={isAddingCourseQuick || !courseQuickName.trim()}
                        onClick={() => void addCourseFromExplorer()}
                      >
                        {isAddingCourseQuick ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                        Add
                      </Button>
                    </div>
                    <Input
                      className="mb-3 h-8 rounded-lg border-slate-200 text-xs shadow-sm bg-white shrink-0"
                      placeholder="Type & press Enter to add..."
                      value={courseQuickName}
                      onChange={(event) => setCourseQuickName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void addCourseFromExplorer();
                        }
                      }}
                    />
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                      {masterCourses.length > 0 ? masterCourses.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => setSelectedCourseId(course.id)}
                          draggable
                          onDragStart={() => setDragCourseId(course.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => void handleCourseDrop(course.id)}
                          className={`w-full group flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${selectedCourseId === course.id ? "border-indigo-200 bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-100" : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:shadow-sm"}`}
                        >
                          <span className="truncate font-medium flex items-center gap-2">
                            {selectedCourseId === course.id ? <FolderOpen className="h-4 w-4 shrink-0 text-indigo-500" /> : <Folder className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-400 transition-colors" />}
                            {course.name}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-indigo-100 hover:text-indigo-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                void editCategoryFromExplorer(course);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </span>
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteCategoryFromExplorer(course);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                            <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${selectedCourseId === course.id ? "text-indigo-500 translate-x-0.5" : "text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"}`} />
                          </span>
                        </button>
                      )) : (
                        <div className="flex flex-col items-center justify-center h-[calc(100%-10px)] text-center px-4 opacity-70">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"><Folder className="h-5 w-5 text-slate-400" /></div>
                          <p className="text-xs text-slate-500 font-medium">No courses found</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LEVELS COLUMN */}
                  <div className="p-4 flex flex-col h-[420px] bg-white/60">
                    <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center"><Folder className="h-3.5 w-3.5" /></div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Levels</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px] bg-white hover:bg-slate-50 hover:text-blue-600 shadow-sm transition-all"
                        disabled={!selectedCourseId || isAddingLevelQuick || !levelQuickName.trim()}
                        onClick={() => void addLevelFromExplorer()}
                      >
                        {isAddingLevelQuick ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                        Add
                      </Button>
                    </div>
                    <Input
                      className="mb-3 h-8 rounded-lg border-slate-200 text-xs shadow-sm bg-white shrink-0 disabled:bg-slate-50/50 disabled:opacity-60"
                      placeholder={selectedCourseId ? 'Type & press Enter to add...' : 'Select a course first →'}
                      value={levelQuickName}
                      disabled={!selectedCourseId}
                      onChange={(event) => setLevelQuickName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void addLevelFromExplorer();
                        }
                      }}
                    />
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                      {!selectedCourseId ? (
                        <div className="flex flex-col items-center justify-center h-[calc(100%-10px)] text-center px-4 opacity-50">
                          <ChevronRight className="h-8 w-8 text-slate-300 mb-2" />
                          <p className="text-xs text-slate-500 font-medium">Select a course first</p>
                        </div>
                      ) : masterLevels.length > 0 ? masterLevels.map((level) => (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() => setSelectedLevelId(level.id)}
                          draggable
                          onDragStart={() => setDragLevelId(level.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => void handleLevelDrop(level.id)}
                          className={`w-full group flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${selectedLevelId === level.id ? "border-blue-200 bg-blue-50/80 text-blue-700 shadow-sm ring-1 ring-blue-100" : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:shadow-sm"}`}
                        >
                          <span className="truncate font-medium flex items-center gap-2">
                            {selectedLevelId === level.id ? <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" /> : <Folder className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-400 transition-colors" />}
                            {level.name}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-blue-100 hover:text-blue-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                void editCategoryFromExplorer(level);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </span>
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteCategoryFromExplorer(level);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                            <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${selectedLevelId === level.id ? "text-blue-500 translate-x-0.5" : "text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"}`} />
                          </span>
                        </button>
                      )) : (
                        <div className="flex flex-col items-center justify-center h-[calc(100%-10px)] text-center px-4 opacity-70">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"><Folder className="h-5 w-5 text-slate-400" /></div>
                          <p className="text-xs text-slate-500 font-medium">No levels found</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SUBJECTS COLUMN */}
                  <div className="p-4 flex flex-col h-[420px]">
                    <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-md bg-teal-100 text-teal-600 flex items-center justify-center"><BookOpen className="h-3.5 w-3.5" /></div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Subjects</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px] bg-white hover:bg-slate-50 hover:text-teal-600 shadow-sm transition-all"
                        disabled={!selectedLevel}
                        onClick={() => selectedLevel && openSubjectPopup(selectedLevel.id, selectedLevel.name, 'level')}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 mt-11"> 
                      {!selectedLevelId ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 opacity-50 -mt-11">
                          <ChevronRight className="h-8 w-8 text-slate-300 mb-2" />
                          <p className="text-xs text-slate-500 font-medium">Select a level first</p>
                        </div>
                      ) : masterSubjects.length > 0 ? masterSubjects.map((subject, index) => (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => setSelectedSubjectId(subject.id)}
                          draggable
                          onDragStart={() => setDragSubjectId(subject.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleSubjectDrop(subject.id)}
                          className={`w-full group flex flex-col justify-center rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${selectedSubjectId === subject.id ? "border-teal-200 bg-teal-50/80 text-teal-800 shadow-sm ring-1 ring-teal-100" : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:shadow-sm"}`}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="truncate font-medium flex items-center gap-2">
                              <BookOpen className={`h-4 w-4 shrink-0 transition-colors ${selectedSubjectId === subject.id ? "text-teal-600" : "text-slate-400 group-hover:text-teal-400"}`} />
                              {subject.name}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <input
                                type="number"
                                min={1}
                                className="h-6 w-12 rounded-md border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-600 focus:border-teal-400 focus:outline-none"
                                title="Move subject to serial number"
                                value={subjectSerialDrafts[subject.id] ?? String(subject.sortOrder || index + 1)}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  setSubjectSerialDrafts((prev) => ({ ...prev, [subject.id]: event.target.value }));
                                }}
                                onBlur={(event) => {
                                  event.stopPropagation();
                                  applySubjectSerialMove(subject.id, subject.sortOrder || index + 1);
                                }}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    applySubjectSerialMove(subject.id, subject.sortOrder || index + 1);
                                  }
                                }}
                              />
                              <span
                                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-teal-100 hover:text-teal-600"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  editSubjectFromExplorer(subject.id);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </span>
                              <span
                                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteSubjectFromExplorer(subject.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </span>
                              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${selectedSubjectId === subject.id ? "text-teal-500 translate-x-0.5" : "text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"}`} />
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 pl-6">
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedSubjectId === subject.id ? 'bg-teal-100/80 text-teal-700' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                              {Array.isArray(subject.chapters) ? subject.chapters.length : 0} Chapters
                            </span>
                          </div>
                        </button>
                      )) : (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 opacity-70 -mt-11">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"><BookOpen className="h-5 w-5 text-slate-400" /></div>
                          <p className="text-xs text-slate-500 font-medium">No subjects found</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CHAPTERS COLUMN */}
                  <div className="p-4 flex flex-col h-[420px] bg-white/60">
                    <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center"><FileText className="h-3.5 w-3.5" /></div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Chapters</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px] bg-white hover:bg-slate-50 hover:text-amber-600 shadow-sm transition-all"
                        disabled={!selectedSubject}
                        onClick={() => selectedSubject && openChapterPopup(selectedSubject.id, selectedSubject.name)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Manage
                      </Button>
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 mt-11">
                      {!selectedSubjectId ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 opacity-50 -mt-11">
                          <ChevronRight className="h-8 w-8 text-slate-300 mb-2" />
                          <p className="text-xs text-slate-500 font-medium">Select a subject first</p>
                        </div>
                      ) : (
                        <>
                          <Input
                            className="mb-3 h-8 rounded-lg border-slate-200 text-xs shadow-sm bg-white"
                            placeholder="Search chapters..."
                            value={chapterSearch}
                            onChange={(event) => setChapterSearch(event.target.value)}
                          />
                          {filteredMasterChapters.length > 0 ? (
                        <div className="relative before:absolute before:left-3.5 before:top-2 before:bottom-3 before:w-px before:bg-slate-200 pl-1 py-1 space-y-2">
                          {filteredMasterChapters.map((chapter, index) => (
                            <div
                              key={chapter.id}
                              className="relative pl-8 pr-3 py-2.5 text-sm text-slate-700 font-medium bg-white border border-slate-100 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-amber-200 hover:shadow-md transition-all group"
                              draggable
                              onDragStart={() => setDragChapterId(chapter.id)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleChapterDrop(chapter.id)}
                            >
                              <div className="absolute left-[13px] top-1/2 -translate-y-1/2 w-3 h-px bg-slate-200 group-hover:bg-amber-300 transition-colors"></div>
                              <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full bg-slate-300 group-hover:bg-amber-500 transition-colors ring-4 ring-white"></div>
                              <span className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  <Hash className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-amber-500 transition-colors" />
                                  <input
                                    type="number"
                                    min={1}
                                    className="h-6 w-12 rounded-md border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-600 focus:border-amber-400 focus:outline-none"
                                    title="Move chapter to serial number"
                                    value={chapterSerialDrafts[chapter.id] ?? String(chapter.sortOrder || index + 1)}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => {
                                      event.stopPropagation();
                                      setChapterSerialDrafts((prev) => ({ ...prev, [chapter.id]: event.target.value }));
                                    }}
                                    onBlur={(event) => {
                                      event.stopPropagation();
                                      applyChapterSerialMove(chapter.id, chapter.sortOrder || index + 1);
                                    }}
                                    onKeyDown={(event) => {
                                      event.stopPropagation();
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        applyChapterSerialMove(chapter.id, chapter.sortOrder || index + 1);
                                      }
                                    }}
                                  />
                                  {chapter.name}
                                  </span>
                                <span className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                                    onClick={() => editChapterFromExplorer(chapter.id)}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                                    onClick={() => deleteChapterFromExplorer(chapter.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                          ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 opacity-70 -mt-11">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"><FileText className="h-5 w-5 text-slate-400" /></div>
                          <p className="text-xs text-slate-500 font-medium">No chapters match your search</p>
                        </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attempts" className="m-0 focus-visible:outline-none">
          <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">Attempt Windows</CardTitle>
              <CardDescription>Create fixed attempt validity windows like "Attempt 1 (31 Mar)" and "Attempt 2 (04 Jun)".</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {attemptOptions.map((item, index) => (
                  <div key={item.id} className="group flex flex-col items-start gap-4 rounded-xl border border-transparent bg-gray-50/50 p-4 transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center">
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Attempt Label</label>
                      <Input
                        placeholder="e.g. Attempt 1 - Mar 31"
                        value={item.label}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        onChange={(e) => setAttemptOptions((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))}
                      />
                    </div>

                    <div className="w-full sm:w-48 space-y-1.5 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">End Date</label>
                      <Input
                        type="date"
                        value={String(item.endDate || "").slice(0, 10)}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        onChange={(e) => setAttemptOptions((prev) => prev.map((row, i) => i === index ? { ...row, endDate: e.target.value } : row))}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-6 sm:mt-6 sm:ml-4 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-attempt-${index}`}
                          checked={item.isActive}
                          className="data-[state=checked]:bg-emerald-500"
                          onCheckedChange={(checked) => setAttemptOptions((prev) => prev.map((row, i) => i === index ? { ...row, isActive: checked } : row))}
                        />
                        <label htmlFor={`active-attempt-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">Active</label>
                      </div>

                      <Button type="button" size="icon" variant="ghost" className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-2 transition-colors" onClick={() => setAttemptOptions((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {attemptOptions.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
                    <Clock className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No attempt windows configured.</p>
                  </div>
                )}

                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={addAttemptOption} className="gap-2 border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto">
                    <Plus className="h-4 w-4" /> Add Attempt Window
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="view-modes" className="m-0 focus-visible:outline-none">
          <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">Viewing Modes Configurations</CardTitle>
              <CardDescription>Determine how many times a user can access a lecture (e.g., 1.5 Views).</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {viewModes.map((item, index) => (
                  <div key={item.id} className="group flex flex-col items-start gap-4 rounded-xl border border-transparent bg-gray-50/50 p-4 transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center">
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Mode Name</label>
                      <Input
                        placeholder="e.g. 1.5 Views"
                        value={item.name}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        onChange={(e) => setViewModes((prev) => prev.map((row, i) => i === index ? { ...row, name: e.target.value } : row))}
                      />
                    </div>
                    
                    <div className="w-full sm:w-28 space-y-1.5 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Max Views</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        placeholder="0.0"
                        value={item.maxViews ?? 0}
                        disabled={item.isLifetime}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:bg-gray-100 disabled:opacity-50"
                        onChange={(e) => setViewModes((prev) => prev.map((row, i) => i === index ? { ...row, maxViews: Number(e.target.value) || null } : row))}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-6 sm:mt-6 sm:ml-4 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`lifetime-mode-${index}`}
                          checked={item.isLifetime}
                          onCheckedChange={(checked) => setViewModes((prev) => prev.map((row, i) => i === index ? { ...row, isLifetime: checked, maxViews: checked ? null : row.maxViews || 1 } : row))}
                        />
                        <label htmlFor={`lifetime-mode-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">Lifetime</label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-mode-${index}`}
                          checked={item.isActive}
                          className="data-[state=checked]:bg-emerald-500"
                          onCheckedChange={(checked) => setViewModes((prev) => prev.map((row, i) => i === index ? { ...row, isActive: checked } : row))}
                        />
                        <label htmlFor={`active-mode-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">Active</label>
                      </div>

                      <Button type="button" size="icon" variant="ghost" className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-2 transition-colors" onClick={() => setViewModes((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {viewModes.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
                    <Eye className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No viewing modes configured.</p>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={addViewMode} className="gap-2 border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto">
                    <Plus className="h-4 w-4" /> Add Viewing Mode
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validities" className="m-0 focus-visible:outline-none">
          <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">Validity Periods</CardTitle>
              <CardDescription>Configure subscription durations available for coursework.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {validityOptions.map((item, index) => (
                  <div key={item.id} className="group flex flex-col items-start gap-4 rounded-xl border border-transparent bg-gray-50/50 p-4 transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center">
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Label</label>
                      <Input
                        placeholder="e.g. 6 Months"
                        value={item.label}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        onChange={(e) => setValidityOptions((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))}
                      />
                    </div>
                    
                    <div className="w-full sm:w-28 space-y-1.5 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Days</label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="180"
                        value={item.days ?? 0}
                        disabled={item.isLifetime}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:bg-gray-100 disabled:opacity-50"
                        onChange={(e) => setValidityOptions((prev) => prev.map((row, i) => i === index ? { ...row, days: Number(e.target.value) || null } : row))}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-6 sm:mt-6 sm:ml-4 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`lifetime-val-${index}`}
                          checked={item.isLifetime}
                          onCheckedChange={(checked) => setValidityOptions((prev) => prev.map((row, i) => i === index ? { ...row, isLifetime: checked, days: checked ? null : row.days || 30 } : row))}
                        />
                        <label htmlFor={`lifetime-val-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">Lifetime</label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-val-${index}`}
                          checked={item.isActive}
                          className="data-[state=checked]:bg-emerald-500"
                          onCheckedChange={(checked) => setValidityOptions((prev) => prev.map((row, i) => i === index ? { ...row, isActive: checked } : row))}
                        />
                        <label htmlFor={`active-val-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">Active</label>
                      </div>

                      <Button type="button" size="icon" variant="ghost" className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-2 transition-colors" onClick={() => setValidityOptions((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {validityOptions.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
                    <Clock className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No validity periods configured.</p>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={addValidityOption} className="gap-2 border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto">
                    <Plus className="h-4 w-4" /> Add Validity Option
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lecture-modes" className="m-0 focus-visible:outline-none">
          <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">Lecture Modes</CardTitle>
              <CardDescription>Setup delivery logic forms like Online, Pen Drive, Google Drive etc.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {deliveryModes.map((item, index) => (
                  <div key={item.id} className="group flex flex-col items-start gap-4 rounded-xl border border-transparent bg-gray-50/50 p-4 transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center">
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Mode Name</label>
                      <Input
                        placeholder="e.g. Google Drive Link"
                        value={item.name}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        onChange={(e) => setDeliveryModes((prev) => prev.map((row, i) => i === index ? { ...row, name: e.target.value } : row))}
                      />
                    </div>
                    
                    <div className="flex shrink-0 items-center gap-6 sm:mt-6 sm:ml-4 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-del-${index}`}
                          checked={item.isActive}
                          className="data-[state=checked]:bg-emerald-500"
                          onCheckedChange={(checked) => setDeliveryModes((prev) => prev.map((row, i) => i === index ? { ...row, isActive: checked } : row))}
                        />
                        <label htmlFor={`active-del-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">Active</label>
                      </div>

                      <Button type="button" size="icon" variant="ghost" className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-2 transition-colors" onClick={() => setDeliveryModes((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {deliveryModes.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
                    <MonitorPlay className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No lecture modes configured.</p>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={addDeliveryMode} className="gap-2 border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto">
                    <Plus className="h-4 w-4" /> Add Lecture Mode
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="m-0 focus-visible:outline-none">
          <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">Languages</CardTitle>
              <CardDescription>Available languages for instruction and UI.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {languages.map((item, index) => (
                  <div key={item.id} className="group flex flex-col items-start gap-4 rounded-xl border border-transparent bg-gray-50/50 p-4 transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center">
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Language Name</label>
                      <Input
                        placeholder="e.g. English, Hindi"
                        value={item.name}
                        className="bg-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        onChange={(e) => setLanguages((prev) => prev.map((row, i) => i === index ? { ...row, name: e.target.value } : row))}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-6 sm:mt-6 sm:ml-4 border-t border-gray-200 pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-lang-${index}`}
                          checked={item.isActive}
                          className="data-[state=checked]:bg-emerald-500"
                          onCheckedChange={(checked) => setLanguages((prev) => prev.map((row, i) => i === index ? { ...row, isActive: checked } : row))}
                        />
                        <label htmlFor={`active-lang-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">Active</label>
                      </div>

                      <Button type="button" size="icon" variant="ghost" className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-2 transition-colors" onClick={() => setLanguages((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {languages.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
                    <Languages className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No languages configured.</p>
                  </div>
                )}

                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={addLanguage} className="gap-2 border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto">
                    <Plus className="h-4 w-4" /> Add Language
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      
      {(!isLoading && (viewModes.length > 5 || validityOptions.length > 5 || deliveryModes.length > 5 || languages.length > 5)) && (
        <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
          <Button
            onClick={saveMasters}
            disabled={isSaving}
            className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      )}

      {/* Subject Popup */}
      <Dialog open={subjectPopup.open} onOpenChange={(open) => setSubjectPopup((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-md overflow-hidden rounded-2xl border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">
              Subjects — {subjectPopup.targetName}
            </DialogTitle>
            <p className="mt-0.5 text-xs text-slate-400">
              {subjectPopup.targetType === 'course' ? 'Subjects linked to this Course' : 'Subjects linked to this Level'}
            </p>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {/* Add subject row */}
            <div className="flex gap-2">
              <Input
                className="h-9 flex-1 rounded-xl border-slate-200 text-sm placeholder:text-slate-400 focus-visible:ring-primary/40"
                placeholder="Enter subject name..."
                value={popupNewName}
                onChange={(e) => setPopupNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addSubjectToTarget(); }}
              />
              <Button
                size="sm"
                className="h-9 w-9 shrink-0 rounded-xl p-0"
                onClick={addSubjectToTarget}
                disabled={!popupNewName.trim()}
                title="Add subject"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Subject list */}
            {popupSubjects.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-auto">
                {popupSubjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    {popupEditingId === s.id ? (
                      <>
                        <input
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          value={popupEditingName}
                          autoFocus
                          onChange={(e) => setPopupEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveSubjectEdit(s.id);
                            if (e.key === 'Escape') setPopupEditingId(null);
                          }}
                        />
                        <button type="button" onClick={() => saveSubjectEdit(s.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setPopupEditingId(null)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium text-slate-900">{s.name}</span>
                        <button
                          type="button"
                          onClick={() => openChapterPopup(s.id, s.name)}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                          title="Manage chapters"
                        >
                          <ListTree className="h-3 w-3" />
                          {Array.isArray(s.chapters) ? s.chapters.length : 0}
                        </button>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button type="button"
                          onClick={() => { setPopupEditingId(s.id); setPopupEditingName(s.name); }}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                          title="Edit name">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => removeSubjectFromTarget(s.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Remove">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8">
                <BookOpen className="mb-2 h-8 w-8 text-slate-200" />
                <p className="text-xs text-slate-400">No subjects yet. Add one above.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-3">
            <p className="text-[10px] text-slate-400">Click "Save Changes" to persist</p>
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs"
              onClick={() => setSubjectPopup((p) => ({ ...p, open: false }))}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={chapterPopup.open} onOpenChange={(open) => setChapterPopup((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md overflow-hidden rounded-2xl border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">
              Chapters — {chapterPopup.subjectName}
            </DialogTitle>
            <p className="mt-0.5 text-xs text-slate-400">Add and manage chapters under this subject</p>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  min="1"
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={chapterNewNumber}
                  onChange={(event) => setChapterNewNumber(Number(event.target.value) || 1)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addChapterToSubject();
                  }}
                />
                <span className="text-slate-400">.</span>
                <Input
                  className="flex-1 rounded-xl border-slate-200 text-sm placeholder:text-slate-400 focus-visible:ring-primary/40"
                  placeholder="Enter chapter name..."
                  value={chapterNewName}
                  onChange={(event) => setChapterNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addChapterToSubject();
                  }}
                />
              </div>
              <Button
                size="sm"
                className="h-9 w-9 shrink-0 rounded-xl p-0"
                onClick={addChapterToSubject}
                disabled={!chapterNewName.trim()}
                title="Add chapter"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Input
              className="h-9 rounded-xl border-slate-200 text-sm placeholder:text-slate-400 focus-visible:ring-primary/40"
              placeholder="Search chapters..."
              value={chapterPopupSearch}
              onChange={(event) => setChapterPopupSearch(event.target.value)}
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[11px] font-semibold text-slate-700">Bulk Import Chapters</p>
              <p className="mt-1 text-[11px] text-slate-500">Download sample Excel, fill chapter names in <span className="font-semibold">chapter_name</span> column, then import.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg border-slate-200 text-[11px]" onClick={downloadChapterImportSample}>
                  Download Sample
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg text-[11px]"
                  disabled={isImportingChapters}
                  onClick={() => chapterImportInputRef.current?.click()}
                >
                  {isImportingChapters ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Import File
                </Button>
                <input
                  ref={chapterImportInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    void importChaptersFromFile(file);
                  }}
                />
              </div>
            </div>

            {filteredChapterPopupSubjects.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-auto">
                {filteredChapterPopupSubjects.map((chapter) => (
                  <div key={chapter.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    {chapterEditingId === chapter.id ? (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="number"
                            min="1"
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={chapterEditingNumber}
                            onChange={(event) => setChapterEditingNumber(Number(event.target.value) || 1)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') saveChapterEdit(chapter.id);
                            }}
                          />
                          <span className="text-slate-400">.</span>
                          <input
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={chapterEditingName}
                            autoFocus
                            onChange={(event) => setChapterEditingName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') saveChapterEdit(chapter.id);
                              if (event.key === 'Escape') {
                                setChapterEditingId(null);
                                setChapterEditingName('');
                                setChapterEditingNumber(1);
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => saveChapterEdit(chapter.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setChapterEditingId(null);
                            setChapterEditingName('');
                            setChapterEditingNumber(1);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium text-slate-900 flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500 w-5 text-right">{chapter.sortOrder}.</span>
                          {chapter.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setChapterEditingId(chapter.id);
                            setChapterEditingName(chapter.name);
                            setChapterEditingNumber(chapter.sortOrder);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                          title="Edit chapter"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChapterFromSubject(chapter.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Remove chapter"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8">
                <ListTree className="mb-2 h-8 w-8 text-slate-200" />
                <p className="text-xs text-slate-400">No chapters yet. Add one above.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-3">
            <p className="text-[10px] text-slate-400">Click "Save Changes" to persist</p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-xs"
              onClick={() => setChapterPopup((prev) => ({ ...prev, open: false }))}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

