"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXERCISE_DATABASE, ExerciseInfo } from "../data/exercises";

type View = "HOME" | "WORKOUT" | "CHECK" | "FINISH";
type RoutineType = "무분할" | "상체" | "하체";
type Intensity = "LIGHT" | "NORMAL" | "HARD";
type VolumeMode = "LOW" | "NORMAL" | "HIGH";

interface UserPersistence {
  userPoints: number;
  rewardStatus: {
    date: string;
    count: number;
  };
  lastIndices: Record<string, number>;
}

interface PreviewOverride {
  defaultWeight?: number;
  defaultReps?: number;
  setCount?: number;
}

interface RoutineExercise extends ExerciseInfo {
  setCount: number;
}

interface WorkoutSet {
  id: number;
  weight: number;
  reps: number;
  completed: boolean;
  isEdited: boolean;
}

interface SessionExercise extends RoutineExercise {
  order: number;
  originalIndex: number;
  sets: WorkoutSet[];
  completed: boolean;
  skipped: boolean;
  completedAt?: string;
}

interface WorkoutSession {
  startedAt: string;
  routineType: RoutineType;
  intensity: Intensity;
  volumeMode: VolumeMode;
  exercises: SessionExercise[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  elapsedSeconds: number;
  isResting: boolean;
  timeLeft: number;
}

interface SessionSummaryExercise {
  exerciseId: string;
  exerciseName: string;
  category: string;
  volume: number;
}

interface SessionSummary {
  durationSeconds: number;
  totalVolume: number;
  completedExercises: SessionSummaryExercise[];
  finishedAt: string;
  finishedEarly: boolean;
}

interface PRRecord {
  maxWeight: number;
  maxReps: number;
}

const STORAGE_KEY = "MINIMAL_FIT_DATA";
const WORKOUT_SESSION_KEY = "MINIMAL_FIT_WORKOUT_SESSION";
const LAST_SUMMARY_KEY = "MINIMAL_FIT_LAST_SUMMARY";
const HISTORY_KEY = "MINIMAL_FIT_HISTORY";
const PR_KEY = "MINIMAL_FIT_PR";

const DAILY_REWARD_LIMIT = 2;
const REWARD_AMOUNT = 30;
const DEFAULT_REST_SECONDS = 60;

const INTENSITY_CONFIG: Record<
  Intensity,
  { displayLabel: string; setBonus: number; repDelta: number }
> = {
  LIGHT: { displayLabel: "가볍게", setBonus: 0, repDelta: 2 },
  NORMAL: { displayLabel: "기본", setBonus: 1, repDelta: 0 },
  HARD: { displayLabel: "강하게", setBonus: 2, repDelta: -2 },
};

const VOLUME_CONFIG: Record<
  VolumeMode,
  { displayLabel: string; counts: Record<string, number> }
> = {
  LOW: {
    displayLabel: "낮음",
    counts: { 가슴: 1, 등: 1, 하체: 1, 어깨: 1, 팔: 1, 복근: 1 },
  },
  NORMAL: {
    displayLabel: "보통",
    counts: { 가슴: 2, 등: 2, 하체: 2, 어깨: 2, 팔: 1, 복근: 1 },
  },
  HIGH: {
    displayLabel: "높음",
    counts: { 가슴: 3, 등: 3, 하체: 3, 어깨: 2, 팔: 2, 복근: 1 },
  },
};

const ROUTINE_CATEGORIES: Record<RoutineType, string[]> = {
  무분할: ["가슴", "등", "하체", "어깨"],
  상체: ["가슴", "등", "어깨", "팔"],
  하체: ["하체", "복근"],
};

const DEFAULT_PERSISTENCE: UserPersistence = {
  userPoints: 0,
  rewardStatus: {
    date: "",
    count: 0,
  },
  lastIndices: {},
};

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatHourMin(totalMinutes: number) {
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const hour = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  return `${hour}시간 ${min}분`;
}

function clampNumber(value: number, min: number) {
  return value < min ? min : value;
}

function getCategoryPool(category: string) {
  return EXERCISE_DATABASE.filter((item) => item.category === category);
}

function getNextRollingExercises(
  category: string,
  count: number,
  lastIndices: Record<string, number>
) {
  const pool = getCategoryPool(category);
  if (pool.length === 0 || count <= 0) return [];

  const startIndex = ((lastIndices[category] ?? -1) + 1 + pool.length) % pool.length;
  const result: ExerciseInfo[] = [];

  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    result.push(pool[(startIndex + i) % pool.length]);
  }

  return result;
}

function createWorkoutSets(exercise: RoutineExercise): WorkoutSet[] {
  return Array.from({ length: exercise.setCount }, (_, index) => ({
    id: index + 1,
    weight: exercise.defaultWeight,
    reps: exercise.defaultReps,
    completed: false,
    isEdited: false,
  }));
}

function calculateExerciseVolume(exercise: SessionExercise) {
  return exercise.sets
    .filter((set) => set.completed)
    .reduce((sum, set) => sum + set.weight * set.reps, 0);
}

function getCompletedSetsCount(exercise: SessionExercise) {
  return exercise.sets.filter((set) => set.completed).length;
}

function getExerciseProgressLabel(exercise: SessionExercise) {
  const completed = getCompletedSetsCount(exercise);
  return `${completed}/${exercise.sets.length}세트`;
}

function getAllDistinctCategoriesFromSession(exercises: SessionExercise[]) {
  const result: string[] = [];
  exercises.forEach((exercise) => {
    if (!result.includes(exercise.category)) {
      result.push(exercise.category);
    }
  });
  return result;
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export default function Page() {
  const [view, setView] = useState<View>("HOME");

  const [userData, setUserData] = useState<UserPersistence>(DEFAULT_PERSISTENCE);

  const [routineType, setRoutineType] = useState<RoutineType>("무분할");
  const [intensity, setIntensity] = useState<Intensity>("NORMAL");
  const [volumeMode, setVolumeMode] = useState<VolumeMode>("NORMAL");

  const [activeCategories, setActiveCategories] = useState<string[]>(
    ROUTINE_CATEGORIES["무분할"]
  );
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, PreviewOverride>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [session, setSession] = useState<WorkoutSession | null>(null);

  const [lastSessionSummary, setLastSessionSummary] = useState<SessionSummary | null>(null);
  const [newPRs, setNewPRs] = useState<
    { exerciseName: string; maxWeight: number; maxReps: number }[]
  >([]);
  const [streak, setStreak] = useState(0);

  const [isAdLoading, setIsAdLoading] = useState(false);
  const [adFallbackVisible, setAdFallbackVisible] = useState(false);

  const [switchMenuOpen, setSwitchMenuOpen] = useState(false);

  const timerRef = useRef<number | null>(null);
  const restRef = useRef<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const today = getTodayKey();

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UserPersistence;
        const nextData: UserPersistence = {
          userPoints: parsed.userPoints ?? 0,
          rewardStatus: parsed.rewardStatus ?? { date: today, count: 0 },
          lastIndices: parsed.lastIndices ?? {},
        };

        if (nextData.rewardStatus.date !== today) {
          nextData.rewardStatus = { date: today, count: 0 };
        }

        setUserData(nextData);
      } catch {
        setUserData({
          ...DEFAULT_PERSISTENCE,
          rewardStatus: { date: today, count: 0 },
        });
      }
    } else {
      setUserData({
        ...DEFAULT_PERSISTENCE,
        rewardStatus: { date: today, count: 0 },
      });
    }

    const savedSession = localStorage.getItem(WORKOUT_SESSION_KEY);
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession) as WorkoutSession;
        setSession(parsedSession);
      } catch {
        localStorage.removeItem(WORKOUT_SESSION_KEY);
      }
    }

    const savedSummary = localStorage.getItem(LAST_SUMMARY_KEY);
    if (savedSummary) {
      try {
        setLastSessionSummary(JSON.parse(savedSummary) as SessionSummary);
      } catch {
        localStorage.removeItem(LAST_SUMMARY_KEY);
      }
    }

    const rawHistory = localStorage.getItem(HISTORY_KEY);
    if (rawHistory) {
      try {
        const history = JSON.parse(rawHistory) as SessionSummary[];
        setStreak(calculateStreak(history));
      } catch {
        setStreak(0);
      }
    }
  }, []);

  useEffect(() => {
    if (!userData.rewardStatus.date) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  }, [userData]);

  useEffect(() => {
    if (session) {
      localStorage.setItem(WORKOUT_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(WORKOUT_SESSION_KEY);
    }
  }, [session]);

  useEffect(() => {
    setActiveCategories(ROUTINE_CATEGORIES[routineType]);
  }, [routineType]);

  useEffect(() => {
    if (view === "WORKOUT" && session) {
      timerRef.current = window.setInterval(() => {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                elapsedSeconds: prev.elapsedSeconds + 1,
              }
            : prev
        );
      }, 1000);
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [view, session?.startedAt]);

  useEffect(() => {
    if (view === "WORKOUT" && session?.isResting) {
      restRef.current = window.setInterval(() => {
        setSession((prev) => {
          if (!prev || !prev.isResting) return prev;

          if (prev.timeLeft <= 1) {
            if (restRef.current) window.clearInterval(restRef.current);
            return moveToNextPosition({
              ...prev,
              isResting: false,
              timeLeft: 0,
            });
          }

          return {
            ...prev,
            timeLeft: prev.timeLeft - 1,
          };
        });
      }, 1000);
    }

    return () => {
      if (restRef.current) window.clearInterval(restRef.current);
      restRef.current = null;
    };
  }, [view, session?.isResting]);

  const previewRoutine = useMemo(() => {
    const categories = activeCategories.length > 0 ? activeCategories : ROUTINE_CATEGORIES[routineType];

    const exercises: RoutineExercise[] = categories.flatMap((category) => {
      const count = VOLUME_CONFIG[volumeMode].counts[category] ?? 1;
      const chosen = getNextRollingExercises(category, count, userData.lastIndices);

      return chosen.map((exercise) => {
        const override = previewOverrides[exercise.id];
        return {
          ...exercise,
          defaultWeight: override?.defaultWeight ?? exercise.defaultWeight,
          defaultReps: override?.defaultReps ?? Math.max(1, exercise.defaultReps + INTENSITY_CONFIG[intensity].repDelta),
          setCount: override?.setCount ?? Math.max(1, 3 + INTENSITY_CONFIG[intensity].setBonus),
        };
      });
    });

    return exercises.map((exercise, index) => ({
      ...exercise,
      setCount: clampNumber(exercise.setCount, 1),
      defaultWeight: clampNumber(exercise.defaultWeight, 0),
      defaultReps: clampNumber(exercise.defaultReps, 1),
      originalIndex: index,
    }));
  }, [activeCategories, intensity, previewOverrides, routineType, userData.lastIndices, volumeMode]);

  const totalSets = previewRoutine.reduce((sum, exercise) => sum + exercise.setCount, 0);
  const estimatedMinutes = Math.max(15, totalSets * 3);
  const mainCategory = previewRoutine[0]?.category ?? "-";

  const currentExercise = session?.exercises[session.currentExerciseIndex] ?? null;
  const currentSet = currentExercise?.sets[session.currentSetIndex] ?? null;
  const hasActiveSession = !!session;

  function calculateStreak(history: SessionSummary[]) {
    if (history.length === 0) return 0;

    const dates = Array.from(
      new Set(history.map((item) => item.finishedAt.slice(0, 10)))
    ).sort((a, b) => (a > b ? -1 : 1));

    let streakCount = 0;
    let cursor = new Date();

    for (let i = 0; i < dates.length; i += 1) {
      const expected = new Date(cursor);
      expected.setDate(cursor.getDate() - i);
      const y = expected.getFullYear();
      const m = `${expected.getMonth() + 1}`.padStart(2, "0");
      const d = `${expected.getDate()}`.padStart(2, "0");
      const expectedKey = `${y}-${m}-${d}`;

      if (dates[i] === expectedKey) {
        streakCount += 1;
      } else {
        break;
      }
    }

    return streakCount;
  }

  function saveHistory(summary: SessionSummary) {
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? (JSON.parse(rawHistory) as SessionSummary[]) : [];
    const nextHistory = [...history, summary];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setStreak(calculateStreak(nextHistory));
  }

  function startNewRoutine() {
    if (previewRoutine.length === 0) return;

    const exercises: SessionExercise[] = previewRoutine.map((exercise, index) => ({
      ...exercise,
      order: index,
      originalIndex: index,
      sets: createWorkoutSets(exercise),
      completed: false,
      skipped: false,
    }));

    setSession({
      startedAt: new Date().toISOString(),
      routineType,
      intensity,
      volumeMode,
      exercises,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      elapsedSeconds: 0,
      isResting: false,
      timeLeft: DEFAULT_REST_SECONDS,
    });

    setSwitchMenuOpen(false);
    setView("WORKOUT");
  }

  function resumeWorkout() {
    if (!session) return;
    setView("WORKOUT");
  }

  function handleStartOrResume() {
    if (session) {
      resumeWorkout();
      return;
    }
    startNewRoutine();
  }

  function handlePreviewValueEdit(
    exerciseId: string,
    title: string,
    field: keyof PreviewOverride,
    currentValue: number
  ) {
    const input = window.prompt(`${title} 값을 입력하세요.`, `${currentValue}`);
    if (input === null) return;

    const parsed = Number(input);
    if (Number.isNaN(parsed)) return;

    setPreviewOverrides((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: field === "defaultWeight" ? clampNumber(parsed, 0) : clampNumber(parsed, 1),
      },
    }));
  }

  function toggleCategory(category: string) {
    setActiveCategories((prev) => {
      if (prev.includes(category)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== category);
      }
      return [...prev, category];
    });
  }

  function updateSessionExercise(
    exerciseIndex: number,
    updater: (exercise: SessionExercise) => SessionExercise
  ) {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      exercises[exerciseIndex] = updater(exercises[exerciseIndex]);
      return { ...prev, exercises };
    });
  }

  function changeCurrentExercise(exerciseIndex: number) {
    if (!session) return;
    const nextExercise = session.exercises[exerciseIndex];
    const firstIncompleteSetIndex = nextExercise.sets.findIndex((set) => !set.completed);

    setSession({
      ...session,
      currentExerciseIndex: exerciseIndex,
      currentSetIndex: firstIncompleteSetIndex === -1 ? nextExercise.sets.length - 1 : firstIncompleteSetIndex,
      isResting: false,
      timeLeft: DEFAULT_REST_SECONDS,
    });

    setSwitchMenuOpen(false);
    setView("WORKOUT");
  }

  function syncSetValue(setIndex: number, field: "weight" | "reps", value: number) {
    if (!session || !currentExercise) return;

    const nextValue = field === "weight" ? clampNumber(value, 0) : clampNumber(value, 1);

    updateSessionExercise(session.currentExerciseIndex, (exercise) => {
      const nextSets = exercise.sets.map((set, index) => {
        if (index === setIndex) {
          return {
            ...set,
            [field]: nextValue,
            isEdited: true,
          };
        }

        if (setIndex === 0 && !set.isEdited && !set.completed) {
          return {
            ...set,
            [field]: nextValue,
          };
        }

        return set;
      });

      return {
        ...exercise,
        sets: nextSets,
      };
    });
  }

  function adjustCurrentSet(field: "weight" | "reps", delta: number) {
    if (!session || !currentExercise || !currentSet) return;
    const currentValue = currentSet[field];
    const nextValue = field === "weight"
      ? clampNumber(currentValue + delta, 0)
      : clampNumber(currentValue + delta, 1);

    syncSetValue(session.currentSetIndex, field, nextValue);
  }

  function findNextIncompleteExerciseIndex(exercises: SessionExercise[]) {
    return exercises.findIndex((exercise) => !exercise.completed);
  }

  function moveToNextPosition(nextSession: WorkoutSession) {
    const currentExerciseInNext = nextSession.exercises[nextSession.currentExerciseIndex];

    if (!currentExerciseInNext) {
      return nextSession;
    }

    const nextSetIndex = currentExerciseInNext.sets.findIndex((set) => !set.completed);
    if (nextSetIndex !== -1) {
      return {
        ...nextSession,
        currentSetIndex: nextSetIndex,
      };
    }

    const nextExerciseIndex = findNextIncompleteExerciseIndex(nextSession.exercises);
    if (nextExerciseIndex === -1) {
      finishWorkout(nextSession, false);
      return nextSession;
    }

    const targetExercise = nextSession.exercises[nextExerciseIndex];
    const targetSetIndex = targetExercise.sets.findIndex((set) => !set.completed);

    return {
      ...nextSession,
      currentExerciseIndex: nextExerciseIndex,
      currentSetIndex: targetSetIndex === -1 ? 0 : targetSetIndex,
    };
  }

  function completeCurrentSet() {
    if (!session || !currentExercise || !currentSet) return;

    const updatedExercises = session.exercises.map((exercise, exerciseIndex) => {
      if (exerciseIndex !== session.currentExerciseIndex) return exercise;

      const nextSets = exercise.sets.map((set, setIndex) =>
        setIndex === session.currentSetIndex ? { ...set, completed: true } : set
      );

      const allDone = nextSets.every((set) => set.completed);

      return {
        ...exercise,
        sets: nextSets,
        completed: allDone,
        completedAt: allDone ? new Date().toISOString() : exercise.completedAt,
      };
    });

    const nextSession: WorkoutSession = {
      ...session,
      exercises: updatedExercises,
      isResting: true,
      timeLeft: DEFAULT_REST_SECONDS,
    };

    setSession(nextSession);
    triggerAdReward();
  }

  function triggerAdReward() {
    setAdFallbackVisible(false);
    setIsAdLoading(true);

    window.setTimeout(() => {
      setIsAdLoading(false);

      const today = getTodayKey();
      setUserData((prev) => {
        const rewardStatus =
          prev.rewardStatus.date === today
            ? prev.rewardStatus
            : { date: today, count: 0 };

        if (rewardStatus.count >= DAILY_REWARD_LIMIT) {
          setAdFallbackVisible(true);
          return {
            ...prev,
            rewardStatus,
          };
        }

        return {
          ...prev,
          userPoints: prev.userPoints + REWARD_AMOUNT,
          rewardStatus: {
            date: today,
            count: rewardStatus.count + 1,
          },
        };
      });

      const canShowFallback =
        userData.rewardStatus.date !== today
          ? 0 < DAILY_REWARD_LIMIT
          : userData.rewardStatus.count >= DAILY_REWARD_LIMIT;

      if (canShowFallback) {
        setAdFallbackVisible(true);
      }
    }, 800);
  }

  function skipRest() {
    if (!session) return;

    const nextSession = moveToNextPosition({
      ...session,
      isResting: false,
      timeLeft: 0,
    });

    setSession(nextSession);
    setAdFallbackVisible(false);
  }

  function moveToNextExerciseManually() {
    if (!session) return;
    const nextIndex = session.currentExerciseIndex + 1;
    if (nextIndex < session.exercises.length) {
      changeCurrentExercise(nextIndex);
    }
  }

  function moveToNextCategory() {
    if (!session || !currentExercise) return;

    const categories = getAllDistinctCategoriesFromSession(session.exercises);
    const currentCategoryIndex = categories.findIndex((item) => item === currentExercise.category);
    const nextCategory = categories[(currentCategoryIndex + 1) % categories.length];

    const candidateIndex = session.exercises.findIndex(
      (exercise) => !exercise.completed && exercise.category === nextCategory
    );

    if (candidateIndex !== -1) {
      changeCurrentExercise(candidateIndex);
      return;
    }

    const anyIndex = session.exercises.findIndex(
      (exercise) => exercise.category === nextCategory
    );
    if (anyIndex !== -1) {
      changeCurrentExercise(anyIndex);
    }
  }

  function moveToSamePartAlternative() {
    if (!session || !currentExercise) return;

    const pool = EXERCISE_DATABASE.filter(
      (exercise) =>
        exercise.category === currentExercise.category &&
        exercise.subTarget === currentExercise.subTarget
    );

    if (pool.length <= 1) return;

    const currentPoolIndex = pool.findIndex((item) => item.id === currentExercise.id);
    const nextPoolExercise = pool[(currentPoolIndex + 1) % pool.length];

    updateSessionExercise(session.currentExerciseIndex, (exercise) => {
      const nextWeight = exercise.sets[0]?.weight ?? nextPoolExercise.defaultWeight;
      const nextReps = exercise.sets[0]?.reps ?? nextPoolExercise.defaultReps;

      const nextSets = exercise.sets.map((set) => ({
        ...set,
        weight: set.completed ? set.weight : nextWeight,
        reps: set.completed ? set.reps : nextReps,
      }));

      return {
        ...exercise,
        ...nextPoolExercise,
        setCount: exercise.setCount,
        sets: nextSets,
      };
    });

    setSwitchMenuOpen(false);
  }

  function updateLastIndicesFromCompletedExercises(exercises: SessionExercise[]) {
    const completedExercises = exercises.filter((exercise) => exercise.completed);

    if (completedExercises.length === 0) return;

    const nextIndices = { ...userData.lastIndices };

    completedExercises.forEach((exercise) => {
      const pool = getCategoryPool(exercise.category);
      const indexInCategory = pool.findIndex((item) => item.id === exercise.id);
      if (indexInCategory !== -1) {
        nextIndices[exercise.category] = indexInCategory;
      }
    });

    setUserData((prev) => ({
      ...prev,
      lastIndices: nextIndices,
    }));
  }

  function finishWorkout(sourceSession: WorkoutSession, finishedEarly: boolean) {
    const completedExercises = sourceSession.exercises.filter((exercise) => getCompletedSetsCount(exercise) > 0);

    const summary: SessionSummary = {
      durationSeconds: sourceSession.elapsedSeconds,
      totalVolume: completedExercises.reduce((sum, exercise) => sum + calculateExerciseVolume(exercise), 0),
      completedExercises: completedExercises.map((exercise) => ({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        category: exercise.category,
        volume: calculateExerciseVolume(exercise),
      })),
      finishedAt: new Date().toISOString(),
      finishedEarly,
    };

    const rawPR = localStorage.getItem(PR_KEY);
    const savedPR = rawPR ? (JSON.parse(rawPR) as Record<string, PRRecord>) : {};
    const nextPR = { ...savedPR };
    const discoveredPRs: { exerciseName: string; maxWeight: number; maxReps: number }[] = [];

    completedExercises.forEach((exercise) => {
      const maxWeight = Math.max(...exercise.sets.filter((set) => set.completed).map((set) => set.weight), 0);
      const maxReps = Math.max(...exercise.sets.filter((set) => set.completed).map((set) => set.reps), 0);
      const prev = nextPR[exercise.id] ?? { maxWeight: 0, maxReps: 0 };

      const improved = maxWeight > prev.maxWeight || maxReps > prev.maxReps;
      nextPR[exercise.id] = {
        maxWeight: Math.max(prev.maxWeight, maxWeight),
        maxReps: Math.max(prev.maxReps, maxReps),
      };

      if (improved) {
        discoveredPRs.push({
          exerciseName: exercise.name,
          maxWeight: nextPR[exercise.id].maxWeight,
          maxReps: nextPR[exercise.id].maxReps,
        });
      }
    });

    localStorage.setItem(PR_KEY, JSON.stringify(nextPR));
    localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(summary));

    setLastSessionSummary(summary);
    setNewPRs(discoveredPRs);

    updateLastIndicesFromCompletedExercises(sourceSession.exercises);
    saveHistory(summary);

    setSession(null);
    setSwitchMenuOpen(false);
    setView("FINISH");
  }

  function finishTodayEarly() {
    if (!session) return;
    finishWorkout(session, true);
  }

  function renderSettingsModal() {
    if (!isSettingsOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4">
        <div className="w-full max-w-2xl rounded-[2.5rem] bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">운동 설정</h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
            >
              닫기
            </button>
          </div>

          <div className="space-y-6">
            <section>
              <p className="mb-3 text-sm font-bold text-slate-500">루틴 분할</p>
              <div className="grid grid-cols-3 gap-3">
                {(["무분할", "상체", "하체"] as RoutineType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setRoutineType(type)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                      routineType === type ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-3 text-sm font-bold text-slate-500">운동 강도 설정</p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(INTENSITY_CONFIG) as Intensity[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setIntensity(key)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                      intensity === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {INTENSITY_CONFIG[key].displayLabel}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-3 text-sm font-bold text-slate-500">운동 볼륨 설정</p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(VOLUME_CONFIG) as VolumeMode[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setVolumeMode(key)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                      volumeMode === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {VOLUME_CONFIG[key].displayLabel}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                볼륨을 낮추면 같은 부위의 추천 종목 수가 줄어들고, 빠진 종목은 다음 회차에 추천됩니다.
              </p>
            </section>

            <section>
              <p className="mb-3 text-sm font-bold text-slate-500">운동 종목 설정</p>
              <div className="grid grid-cols-2 gap-3">
                {["가슴", "등", "하체", "어깨", "팔", "복근"].map((category) => {
                  const active = activeCategories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                        active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  function renderSwitchMenu() {
    if (!switchMenuOpen || !session) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4">
        <div className="w-full max-w-xl rounded-[2.5rem] bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">다른 운동하기</h3>
            <button
              onClick={() => setSwitchMenuOpen(false)}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
            >
              닫기
            </button>
          </div>

          <div className="grid gap-3">
            <button
              onClick={moveToNextExerciseManually}
              className="rounded-2xl bg-slate-900 px-4 py-4 text-left font-bold text-white"
            >
              다음 운동
              <p className="mt-1 text-sm font-medium text-slate-200">
                현재 순서 다음 운동으로 이동
              </p>
            </button>

            <button
              onClick={moveToNextCategory}
              className="rounded-2xl bg-blue-600 px-4 py-4 text-left font-bold text-white"
            >
              다음 부위
              <p className="mt-1 text-sm font-medium text-blue-100">
                가슴 → 등처럼 다음 카테고리로 이동
              </p>
            </button>

            <button
              onClick={moveToSamePartAlternative}
              className="rounded-2xl bg-emerald-600 px-4 py-4 text-left font-bold text-white"
            >
              같은 부위 다른 운동
              <p className="mt-1 text-sm font-medium text-emerald-100">
                같은 대분류·같은 subTarget 운동으로 교체
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderHomeView() {
    return (
      <main className="min-h-screen bg-slate-100 pb-36">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex items-center justify-between rounded-[2.5rem] bg-white p-5 shadow-2xl">
            <div>
              <p className="text-sm font-bold text-slate-500">오늘의 루틴</p>
              <h1 className="text-2xl font-black text-slate-900">Minimal Fit</h1>
            </div>
            <div className="rounded-3xl bg-slate-900 px-4 py-3 text-right text-white">
              <p className="text-xs font-semibold text-slate-300">포인트</p>
              <p className="text-xl font-black">{userData.userPoints} FP</p>
            </div>
          </div>

          {hasActiveSession && session && currentExercise && (
            <section className="mb-4 rounded-[2.5rem] bg-amber-50 p-5 shadow-2xl">
              <p className="text-sm font-bold text-amber-700">진행 중인 운동 바로가기</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">{currentExercise.name}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {session.currentExerciseIndex + 1}번째 운동 · {session.currentSetIndex + 1}번째 세트
              </p>
              <button
                onClick={resumeWorkout}
                className="mt-4 w-full rounded-[2rem] bg-amber-500 px-5 py-4 text-lg font-black text-white"
              >
                진행 중인 운동 이어하기
              </button>
            </section>
          )}

          <section className="rounded-[2.5rem] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {routineType} {INTENSITY_CONFIG[intensity].displayLabel}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  예상 운동시간 {formatHourMin(estimatedMinutes)} · 메인 부위 {mainCategory} · 총 세트 수 {totalSets}
                </p>
              </div>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xl shadow-sm"
                aria-label="설정 열기"
              >
                ⚙️
              </button>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200">
              <div className="grid grid-cols-[52px_1fr_70px_64px_64px] bg-slate-50 px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500">
                <div>No</div>
                <div className="text-left">Exercise</div>
                <div>kg</div>
                <div>set</div>
                <div>rep</div>
              </div>

              {previewRoutine.map((exercise, index) => (
                <div
                  key={`${exercise.id}-${index}`}
                  className="grid grid-cols-[52px_1fr_70px_64px_64px] items-center border-t border-slate-100 px-3 py-3"
                >
                  <div className="text-center text-sm font-black text-slate-500">{index + 1}</div>

                  <div className="pr-2">
                    <p className="text-sm font-black text-slate-900">{exercise.name}</p>
                    <p className="text-xs text-slate-500">
                      {exercise.category} · {exercise.subTarget} · {exercise.equipment}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      handlePreviewValueEdit(
                        exercise.id,
                        `${exercise.name} 중량`,
                        "defaultWeight",
                        exercise.defaultWeight
                      )
                    }
                    className="flex items-center justify-center text-sm font-black text-slate-900"
                  >
                    {exercise.defaultWeight}
                  </button>

                  <button
                    onClick={() =>
                      handlePreviewValueEdit(
                        exercise.id,
                        `${exercise.name} 세트 수`,
                        "setCount",
                        exercise.setCount
                      )
                    }
                    className="flex items-center justify-center text-sm font-black text-slate-900"
                  >
                    {exercise.setCount}
                  </button>

                  <button
                    onClick={() =>
                      handlePreviewValueEdit(
                        exercise.id,
                        `${exercise.name} 반복 수`,
                        "defaultReps",
                        exercise.defaultReps
                      )
                    }
                    className="flex items-center justify-center text-sm font-black text-slate-900"
                  >
                    {exercise.defaultReps}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <button
              onClick={handleStartOrResume}
              disabled={!hasActiveSession && previewRoutine.length === 0}
              className="w-full rounded-[2.5rem] bg-slate-900 px-5 py-5 text-lg font-black text-white shadow-2xl transition active:scale-[0.99] disabled:bg-slate-400"
            >
              {hasActiveSession ? "진행 중인 운동 이어하기" : "내 루틴 시작하기"}
            </button>
          </div>
        </div>

        {renderSettingsModal()}
      </main>
    );
  }

  function renderWorkoutView() {
    if (!session || !currentExercise || !currentSet) return null;

    return (
      <main className={`min-h-screen ${session.isResting ? "bg-slate-950" : "bg-slate-100"}`}>
        <div className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setView("CHECK")}
              className="text-sm font-semibold text-blue-600 underline"
            >
              ROUTINE LIST
            </button>

            <div className={`text-lg font-black ${session.isResting ? "text-white" : "text-slate-900"}`}>
              {formatTime(session.elapsedSeconds)}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg"
                aria-label="운동 설정 열기"
              >
                ⚙️
              </button>

              <button
                onClick={() => setView("HOME")}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
                aria-label="홈으로 이동"
              >
                <HomeIcon />
              </button>
            </div>
          </div>

          <section
            className={`rounded-[2.5rem] p-5 shadow-2xl ${
              session.isResting ? "bg-slate-900 text-white" : "bg-white"
            }`}
          >
            <p className={`text-sm font-bold ${session.isResting ? "text-slate-300" : "text-slate-500"}`}>
              {session.currentExerciseIndex + 1} / {session.exercises.length}
            </p>

            <h2 className={`mt-2 text-3xl font-black ${session.isResting ? "text-white" : "text-slate-900"}`}>
              {currentExercise.name}
            </h2>

            <p className={`mt-2 text-sm ${session.isResting ? "text-slate-300" : "text-slate-500"}`}>
              {currentExercise.category} | {currentExercise.subTarget} | {currentExercise.equipment}
            </p>

            <div className="mt-5 rounded-[2rem] border border-slate-200/30 bg-slate-50/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-400">현재 세트</p>
                  <p className="text-2xl font-black">
                    {session.currentSetIndex + 1}세트
                    <span className="ml-3 text-lg font-bold">
                      {currentSet.weight}kg / {currentSet.reps}개
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => setSwitchMenuOpen(true)}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white"
                >
                  다른 운동하기
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-300">현재 세트 kg</p>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => adjustCurrentSet("weight", -5)}
                      className="h-12 w-12 rounded-2xl bg-white/15 text-2xl font-black"
                    >
                      ←
                    </button>
                    <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-2xl font-black text-slate-900">
                      {currentSet.weight}
                    </div>
                    <button
                      onClick={() => adjustCurrentSet("weight", 5)}
                      className="h-12 w-12 rounded-2xl bg-white/15 text-2xl font-black"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-300">현재 세트 개수</p>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => adjustCurrentSet("reps", -1)}
                      className="h-12 w-12 rounded-2xl bg-white/15 text-2xl font-black"
                    >
                      ←
                    </button>
                    <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-2xl font-black text-slate-900">
                      {currentSet.reps}
                    </div>
                    <button
                      onClick={() => adjustCurrentSet("reps", 1)}
                      className="h-12 w-12 rounded-2xl bg-white/15 text-2xl font-black"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {currentExercise.sets.map((set, index) => {
                const isCurrent = index === session.currentSetIndex;
                return (
                  <div
                    key={set.id}
                    className={`grid grid-cols-[80px_1fr_24px_1fr] items-center gap-3 rounded-[1.5rem] p-4 ${
                      set.completed
                        ? "bg-emerald-500/20"
                        : isCurrent
                        ? "bg-blue-500/20"
                        : "bg-slate-100/10"
                    }`}
                  >
                    <div className="text-center text-sm font-black">SET {set.id}</div>

                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) => syncSetValue(index, "weight", Number(e.target.value || 0))}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-center text-lg font-bold text-slate-900"
                    />

                    <div className="text-center text-lg font-black">×</div>

                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => syncSetValue(index, "reps", Number(e.target.value || 0))}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-center text-lg font-bold text-slate-900"
                    />
                  </div>
                );
              })}
            </div>

            {!session.isResting ? (
              <div className="mt-5 grid gap-3">
                <button
                  onClick={completeCurrentSet}
                  className="rounded-[2rem] bg-slate-900 px-5 py-5 text-lg font-black text-white"
                >
                  DONE
                </button>

                <button
                  onClick={finishTodayEarly}
                  className="rounded-[2rem] bg-rose-500 px-5 py-4 text-base font-black text-white"
                >
                  오늘 운동 끝내기
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-[2rem] bg-white/10 p-5 text-center">
                <p className="text-sm font-bold text-slate-300">휴식 중</p>
                <p className="mt-2 text-5xl font-black">{session.timeLeft}</p>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold">
                    {isAdLoading ? "광고 불러오는 중..." : `+${REWARD_AMOUNT}P`}
                  </div>

                  <button
                    onClick={skipRest}
                    className="rounded-2xl bg-slate-900 px-5 py-4 text-lg font-bold text-white"
                  >
                    SKIP
                  </button>
                </div>

                {adFallbackVisible && (
                  <div className="mt-4 rounded-2xl bg-amber-400/20 p-4">
                    <p className="text-lg font-black">광고 없음</p>
                    <p className="mt-1 text-sm text-slate-200">
                      현재 표시 가능한 광고가 없습니다.
                    </p>
                    <button
                      onClick={() => {
                        setAdFallbackVisible(false);
                        skipRest();
                      }}
                      className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                    >
                      다음으로 진행
                    </button>
                  </div>
                )}

                <p className="mt-4 text-sm text-slate-300">
                  오늘 {userData.rewardStatus.count} / {DAILY_REWARD_LIMIT}
                </p>
              </div>
            )}
          </section>
        </div>

        {renderSettingsModal()}
        {renderSwitchMenu()}
      </main>
    );
  }

  function renderCheckView() {
    if (!session) return null;

    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">TODAY ROUTINE</h2>
            <button
              onClick={() => setView("WORKOUT")}
              className="text-sm font-semibold text-blue-600 underline"
            >
              BACK
            </button>
          </div>

          <div className="grid gap-3">
            {session.exercises.map((exercise, index) => {
              const isCurrent = index === session.currentExerciseIndex;

              return (
                <button
                  key={`${exercise.id}-${index}`}
                  onClick={() => changeCurrentExercise(index)}
                  className={`rounded-[2rem] p-5 text-left shadow-xl ${
                    isCurrent
                      ? "bg-blue-600 text-white"
                      : exercise.completed
                      ? "bg-emerald-50"
                      : "bg-white"
                  }`}
                >
                  <p
                    className={`text-sm font-bold ${
                      isCurrent
                        ? "text-blue-100"
                        : exercise.completed
                        ? "text-emerald-600"
                        : "text-slate-500"
                    }`}
                  >
                    {isCurrent
                      ? "현재 운동"
                      : exercise.completed
                      ? "완료"
                      : `${index + 1}번째 운동`}
                  </p>

                  <h3 className="mt-1 text-xl font-black">{exercise.name}</h3>

                  <p className={`mt-2 text-sm ${isCurrent ? "text-blue-100" : "text-slate-500"}`}>
                    {exercise.category} | {exercise.subTarget} | {exercise.defaultWeight}kg × {exercise.defaultReps}
                  </p>

                  <p className={`mt-2 text-sm font-bold ${isCurrent ? "text-white" : "text-slate-700"}`}>
                    {getExerciseProgressLabel(exercise)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  function renderFinishView() {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <section className="rounded-[2.5rem] bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold text-slate-500">운동 완료</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">Great Job</h2>
            <p className="mt-2 text-slate-600">오늘 운동이 저장되었습니다.</p>

            {lastSessionSummary && (
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-[2rem] bg-slate-100 p-4">
                  <p className="text-sm font-bold text-slate-500">총 운동 시간</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {formatTime(lastSessionSummary.durationSeconds)}
                  </p>
                </div>

                <div className="rounded-[2rem] bg-slate-100 p-4">
                  <p className="text-sm font-bold text-slate-500">총 볼륨</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {lastSessionSummary.totalVolume.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-[2rem] bg-slate-100 p-4">
                  <p className="text-sm font-bold text-slate-500">연속 운동일</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{streak}일</p>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-lg font-black text-slate-900">오늘 수행 운동</h3>
              <div className="mt-3 grid gap-3">
                {lastSessionSummary?.completedExercises.map((exercise) => (
                  <div
                    key={`${exercise.exerciseId}-${exercise.volume}`}
                    className="rounded-[2rem] bg-slate-50 p-4"
                  >
                    <p className="text-lg font-black text-slate-900">{exercise.exerciseName}</p>
                    <p className="mt-1 text-sm text-slate-500">{exercise.category}</p>
                    <p className="mt-2 text-base font-bold text-slate-800">
                      {exercise.volume.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-black text-slate-900">새로운 PR</h3>
              <div className="mt-3 grid gap-3">
                {newPRs.length > 0 ? (
                  newPRs.map((pr) => (
                    <div key={`${pr.exerciseName}-${pr.maxWeight}-${pr.maxReps}`} className="rounded-[2rem] bg-emerald-50 p-4">
                      <p className="text-lg font-black text-slate-900">{pr.exerciseName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        최고 중량 {pr.maxWeight}kg / 최고 반복 {pr.maxReps}회
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[2rem] bg-slate-50 p-4 text-sm text-slate-600">
                    이번 세션에서 갱신된 PR은 없습니다.
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setView("HOME")}
              className="mt-6 w-full rounded-[2rem] bg-slate-900 px-5 py-5 text-lg font-black text-white"
            >
              홈으로 돌아가기
            </button>
          </section>
        </div>
      </main>
    );
  }

  switch (view) {
    case "HOME":
      return renderHomeView();
    case "WORKOUT":
      return renderWorkoutView();
    case "CHECK":
      return renderCheckView();
    case "FINISH":
      return renderFinishView();
    default:
      return null;
  }
}
