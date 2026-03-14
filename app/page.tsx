"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXERCISE_DATABASE, ExerciseInfo } from "../data/exercises";

type View = "HOME" | "WORKOUT" | "CHECK" | "FINISH";
type RoutineType = "무분할" | "상체" | "하체";
type Intensity = "LIGHT" | "NORMAL" | "HARD";
type VolumeMode = "LOW" | "NORMAL" | "HIGH";

interface SetLog {
  id: number;
  weight: number;
  reps: number;
  isEdited: boolean;
  isDone: boolean;
  completedAt?: string;
}

interface RoutineExercise extends ExerciseInfo {
  setCount: number;
}

interface WorkoutExercise extends RoutineExercise {
  sets: SetLog[];
}

interface SelectedRoutine {
  name: string;
  level: string;
  type: RoutineType;
  intensity: Intensity;
  volumeMode: VolumeMode;
  activeCategories: string[];
  exercises: WorkoutExercise[];
}

interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxReps: number;
  updatedAt: string;
}

interface WorkoutSession {
  id: string;
  routineName: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  totalVolume: number;
  completedExercises: Array<{
    exerciseId: string;
    exerciseName: string;
    category: string;
    volume: number;
  }>;
}

interface RewardStatus {
  date: string;
  count: number;
}

interface UserPersistence {
  userPoints: number;
  rewardStatus: RewardStatus;
  lastIndices: Record<string, number>;
  workoutHistory: WorkoutSession[];
  personalRecords: PersonalRecord[];
}

type PreviewOverride = Partial<
  Pick<RoutineExercise, "defaultWeight" | "defaultReps" | "setCount">
>;

const STORAGE_KEY = "MINIMAL_FIT_DATA";
const DAILY_REWARD_LIMIT = 2;
const REWARD_AMOUNT = 30;

const INTENSITY_CONFIG: Record<
  Intensity,
  {
    displayLabel: string;
    setCount: number;
    restSeconds: number;
  }
> = {
  LIGHT: {
    displayLabel: "가볍게",
    setCount: 2,
    restSeconds: 45,
  },
  NORMAL: {
    displayLabel: "보통",
    setCount: 3,
    restSeconds: 60,
  },
  HARD: {
    displayLabel: "강하게",
    setCount: 4,
    restSeconds: 75,
  },
};

const VOLUME_CONFIG: Record<
  VolumeMode,
  {
    displayLabel: string;
    perCategory: number;
  }
> = {
  LOW: {
    displayLabel: "낮음",
    perCategory: 1,
  },
  NORMAL: {
    displayLabel: "보통",
    perCategory: 2,
  },
  HIGH: {
    displayLabel: "높음",
    perCategory: 3,
  },
};

function getTodayKey() {
  return new Date().toLocaleDateString();
}

function normalizePersistence(data: Partial<UserPersistence> | null): UserPersistence {
  const today = getTodayKey();
  const rewardStatus =
    data?.rewardStatus?.date === today
      ? data.rewardStatus
      : {
          date: today,
          count: 0,
        };

  return {
    userPoints: data?.userPoints ?? 0,
    rewardStatus,
    lastIndices: data?.lastIndices ?? {},
    workoutHistory: data?.workoutHistory ?? [],
    personalRecords: data?.personalRecords ?? [],
  };
}

function createInitialSets(
  exercise: Pick<ExerciseInfo, "defaultWeight" | "defaultReps">,
  setCount: number
): SetLog[] {
  return Array.from({ length: setCount }, (_, i) => ({
    id: i + 1,
    weight: exercise.defaultWeight,
    reps: exercise.defaultReps,
    isEdited: false,
    isDone: false,
  }));
}

function formatTime(totalSeconds: number) {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatHourMin(totalMinutes: number) {
  const rounded = Math.round(totalMinutes);
  const hour = Math.floor(rounded / 60);
  const min = rounded % 60;
  if (hour <= 0) return `${min}분`;
  return `${hour}시간 ${min}분`;
}

function calculateExerciseVolume(sets: SetLog[]) {
  return sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
}

function calculateStreak(history: WorkoutSession[]) {
  if (history.length === 0) return 0;

  const uniqueDays = Array.from(
    new Set(
      history.map((session) => {
        const date = new Date(session.finishedAt);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      })
    )
  ).sort((a, b) => b - a);

  const today = new Date();
  const todayStamp = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (uniqueDays[0] !== todayStamp && uniqueDays[0] !== todayStamp - oneDay) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = uniqueDays[i - 1];
    const current = uniqueDays[i];
    if (prev - current === oneDay) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function getDefaultCategories(type: RoutineType) {
  if (type === "상체") return ["가슴", "등", "어깨", "팔"];
  if (type === "하체") return ["하체", "복근"];
  return ["가슴", "등", "하체", "어깨", "복근"];
}

function getMainCategory(exercises: RoutineExercise[]) {
  if (exercises.length === 0) return "-";

  const counts = exercises.reduce<Record<string, number>>((acc, exercise) => {
    acc[exercise.category] = (acc[exercise.category] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
}

function estimateWorkoutMinutes(exercises: RoutineExercise[], restSeconds: number) {
  const setSeconds = exercises.reduce((acc, ex) => {
    const estimatedSetTime = ex.defaultReps >= 15 ? 45 : 35;
    return acc + estimatedSetTime * ex.setCount;
  }, 0);

  const totalSets = exercises.reduce((acc, ex) => acc + ex.setCount, 0);
  const totalRestSeconds = Math.max(0, totalSets - 1) * restSeconds;

  return (setSeconds + totalRestSeconds) / 60;
}

export default function Home() {
  const [view, setView] = useState<View>("HOME");

  const [userPoints, setUserPoints] = useState(0);
  const [rewardStatus, setRewardStatus] = useState<RewardStatus>({
    date: getTodayKey(),
    count: 0,
  });
  const [lastIndices, setLastIndices] = useState<Record<string, number>>({});
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);

  const [routineType, setRoutineType] = useState<RoutineType>("상체");
  const [intensity, setIntensity] = useState<Intensity>("NORMAL");
  const [volumeMode, setVolumeMode] = useState<VolumeMode>("NORMAL");
  const [activeCategories, setActiveCategories] = useState<string[]>(
    getDefaultCategories("상체")
  );
  const [restSeconds, setRestSeconds] = useState(INTENSITY_CONFIG.NORMAL.restSeconds);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [previewOverrides, setPreviewOverrides] = useState<Record<string, PreviewOverride>>({});

  const [selectedRoutine, setSelectedRoutine] = useState<SelectedRoutine | null>(null);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [isResting, setIsResting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTempoOn, setIsTempoOn] = useState(false);

  const [lastSessionSummary, setLastSessionSummary] = useState<WorkoutSession | null>(null);
  const [newPRs, setNewPRs] = useState<PersonalRecord[]>([]);

  const speechRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    setActiveCategories(getDefaultCategories(routineType));
  }, [routineType]);

  useEffect(() => {
    setRestSeconds(INTENSITY_CONFIG[intensity].restSeconds);
  }, [intensity]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as Partial<UserPersistence>) : null;
    const normalized = normalizePersistence(parsed);

    setUserPoints(normalized.userPoints);
    setRewardStatus(normalized.rewardStatus);
    setLastIndices(normalized.lastIndices);
    setWorkoutHistory(normalized.workoutHistory);
    setPersonalRecords(normalized.personalRecords);

    if (typeof window !== "undefined") {
      speechRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    const dataToSave: UserPersistence = {
      userPoints,
      rewardStatus,
      lastIndices,
      workoutHistory,
      personalRecords,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [userPoints, rewardStatus, lastIndices, workoutHistory, personalRecords]);

  useEffect(() => {
    if (view !== "WORKOUT" || !workoutStartTime) return;

    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [view, workoutStartTime]);

  useEffect(() => {
    if (!isResting) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isResting]);

  function buildGeneratedRoutine(baseIndices: Record<string, number>) {
    const updatedIndices = { ...baseIndices };
    const exercises: RoutineExercise[] = [];
    const perCategory = VOLUME_CONFIG[volumeMode].perCategory;

    activeCategories.forEach((category) => {
      const categoryExercises = EXERCISE_DATABASE.filter(
        (exercise) => exercise.category === category
      );
      if (categoryExercises.length === 0) return;

      const lastIdx = updatedIndices[category] ?? -1;
      const pickedCount = Math.min(perCategory, categoryExercises.length);

      for (let i = 1; i <= pickedCount; i++) {
        const nextIdx = (lastIdx + i) % categoryExercises.length;
        const baseExercise = categoryExercises[nextIdx];
        const override = previewOverrides[baseExercise.id] ?? {};

        exercises.push({
          ...baseExercise,
          defaultWeight: override.defaultWeight ?? baseExercise.defaultWeight,
          defaultReps: override.defaultReps ?? baseExercise.defaultReps,
          setCount: override.setCount ?? INTENSITY_CONFIG[intensity].setCount,
        });
      }

      updatedIndices[category] = (lastIdx + pickedCount) % categoryExercises.length;
    });

    return {
      exercises,
      updatedIndices,
    };
  }

  const previewRoutine = useMemo(() => {
    return buildGeneratedRoutine(lastIndices).exercises;
  }, [lastIndices, intensity, volumeMode, activeCategories, previewOverrides]);

  const estimatedMinutes = useMemo(
    () => estimateWorkoutMinutes(previewRoutine, restSeconds),
    [previewRoutine, restSeconds]
  );

  const totalSets = useMemo(
    () => previewRoutine.reduce((acc, item) => acc + item.setCount, 0),
    [previewRoutine]
  );

  const mainCategory = useMemo(() => getMainCategory(previewRoutine), [previewRoutine]);

  const currentExercise = useMemo(() => {
    if (!selectedRoutine) return null;
    return selectedRoutine.exercises[currentExIndex] ?? null;
  }, [selectedRoutine, currentExIndex]);

  const canEarnReward = rewardStatus.count < DAILY_REWARD_LIMIT;
  const isLastSet = currentSetIndex === sets.length - 1;
  const isLastExercise =
    !!selectedRoutine && currentExIndex === selectedRoutine.exercises.length - 1;
  const streak = useMemo(() => calculateStreak(workoutHistory), [workoutHistory]);

  useEffect(() => {
    if (!isResting || timeLeft > 0) return;
    moveAfterRest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isResting]);

  function buildWorkoutExercise(exercise: RoutineExercise): WorkoutExercise {
    return {
      ...exercise,
      sets: createInitialSets(exercise, exercise.setCount),
    };
  }

  function persistCurrentExerciseSets(updatedSets: SetLog[]) {
    setSelectedRoutine((prev) => {
      if (!prev) return prev;

      const nextExercises = [...prev.exercises];
      const current = nextExercises[currentExIndex];
      if (!current) return prev;

      nextExercises[currentExIndex] = {
        ...current,
        sets: updatedSets,
      };

      return {
        ...prev,
        exercises: nextExercises,
      };
    });
  }

  function toggleCategory(category: string) {
    setActiveCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }
      return [...prev, category];
    });
  }

  function handlePreviewValueEdit(
    exerciseId: string,
    label: string,
    field: keyof PreviewOverride,
    currentValue: number
  ) {
    const input = window.prompt(`${label} 값을 입력하세요`, String(currentValue));
    if (input === null) return;

    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setPreviewOverrides((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: parsed,
      },
    }));
  }

  function generateRollingRoutine(level: string, type: RoutineType, selectedIntensity: Intensity) {
    const { exercises, updatedIndices } = buildGeneratedRoutine(lastIndices);
    if (exercises.length === 0) return;

    const workoutExercises = exercises.map(buildWorkoutExercise);

    setLastIndices(updatedIndices);
    setSelectedRoutine({
      name: `${type} ${INTENSITY_CONFIG[selectedIntensity].displayLabel}`,
      level,
      type,
      intensity: selectedIntensity,
      volumeMode,
      activeCategories,
      exercises: workoutExercises,
    });
    setCurrentExIndex(0);
    setCurrentSetIndex(0);
    setSets(workoutExercises[0].sets);
    setWorkoutStartTime(Date.now());
    setElapsedTime(0);
    setIsResting(false);
    setTimeLeft(restSeconds);
    setNewPRs([]);
    setLastSessionSummary(null);
    setView("WORKOUT");
    setIsSettingsOpen(false);
  }

  function applySettingsToCurrentWorkout() {
    if (!selectedRoutine) {
      setIsSettingsOpen(false);
      return;
    }

    const current = selectedRoutine.exercises[currentExIndex];
    const completed = selectedRoutine.exercises.slice(0, currentExIndex);
    const { exercises } = buildGeneratedRoutine(lastIndices);

    const rebuilt = exercises
      .filter(
        (exercise) =>
          !completed.some((done) => done.id === exercise.id) && exercise.id !== current.id
      )
      .map(buildWorkoutExercise);

    const currentWithSets: WorkoutExercise = {
      ...current,
      setCount: current.setCount,
      sets,
    };

    setSelectedRoutine({
      ...selectedRoutine,
      name: `${routineType} ${INTENSITY_CONFIG[intensity].displayLabel}`,
      type: routineType,
      intensity,
      volumeMode,
      activeCategories,
      exercises: [...completed, currentWithSets, ...rebuilt],
    });

    setTimeLeft(restSeconds);
    setIsSettingsOpen(false);
  }

  function syncSetValue(index: number, field: "weight" | "reps", value: number) {
    setSets((prev) => {
      const next = prev.map((set) => ({ ...set }));
      next[index][field] = value;
      next[index].isEdited = true;

      if (index === 0) {
        for (let i = 1; i < next.length; i++) {
          if (!next[i].isEdited) {
            next[i][field] = value;
          }
        }
      }

      persistCurrentExerciseSets(next);
      return next;
    });
  }

  function markCurrentSetDone() {
    setSets((prev) => {
      const next = prev.map((set, index) =>
        index === currentSetIndex
          ? {
              ...set,
              isDone: true,
              completedAt: new Date().toISOString(),
            }
          : set
      );

      persistCurrentExerciseSets(next);
      return next;
    });

    setIsResting(true);
    setTimeLeft(restSeconds);
  }

  function earnReward() {
    if (!canEarnReward) return;

    setUserPoints((prev) => prev + REWARD_AMOUNT);
    setRewardStatus((prev) => ({
      date: getTodayKey(),
      count: prev.count + 1,
    }));
  }

  function moveAfterRest(withReward: boolean) {
    if (withReward) {
      earnReward();
    }

    persistCurrentExerciseSets(sets);
    setIsResting(false);
    setTimeLeft(restSeconds);

    if (!isLastSet) {
      setCurrentSetIndex((prev) => prev + 1);
      return;
    }

    if (!isLastExercise) {
      const nextExerciseIndex = currentExIndex + 1;
      const nextExercise = selectedRoutine?.exercises[nextExerciseIndex];
      if (!nextExercise) return;

      setCurrentExIndex(nextExerciseIndex);
      setCurrentSetIndex(0);
      setSets(nextExercise.sets);
      return;
    }

    finishWorkout();
  }

  function detectNewPRs(sessionExercises: WorkoutExercise[]) {
    const detected: PersonalRecord[] = [];
    const nextRecords = [...personalRecords];

    sessionExercises.forEach((exercise) => {
      const maxWeight = Math.max(...exercise.sets.map((set) => set.weight));
      const maxReps = Math.max(...exercise.sets.map((set) => set.reps));
      const prevRecord = nextRecords.find((record) => record.exerciseId === exercise.id);

      const isWeightPR = !prevRecord || maxWeight > prevRecord.maxWeight;
      const isRepsPR = !prevRecord || maxReps > prevRecord.maxReps;

      if (isWeightPR || isRepsPR) {
        const updatedRecord: PersonalRecord = {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          maxWeight: Math.max(prevRecord?.maxWeight ?? 0, maxWeight),
          maxReps: Math.max(prevRecord?.maxReps ?? 0, maxReps),
          updatedAt: new Date().toISOString(),
        };

        const existingIndex = nextRecords.findIndex(
          (record) => record.exerciseId === exercise.id
        );

        if (existingIndex >= 0) {
          nextRecords[existingIndex] = updatedRecord;
        } else {
          nextRecords.push(updatedRecord);
        }

        detected.push(updatedRecord);
      }
    });

    setPersonalRecords(nextRecords);
    setNewPRs(detected);
  }

  function finishWorkout() {
    if (!selectedRoutine || !workoutStartTime) return;

    const mergedExercises = selectedRoutine.exercises.map((exercise, index) => {
      if (index !== currentExIndex) return exercise;
      return {
        ...exercise,
        sets,
      };
    });

    const completedExercises = mergedExercises.map((exercise) => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      volume: calculateExerciseVolume(exercise.sets),
    }));

    const totalVolume = completedExercises.reduce((sum, item) => sum + item.volume, 0);

    const session: WorkoutSession = {
      id: `${Date.now()}`,
      routineName: selectedRoutine.name,
      startedAt: new Date(workoutStartTime).toISOString(),
      finishedAt: new Date().toISOString(),
      durationSeconds: Math.floor((Date.now() - workoutStartTime) / 1000),
      totalVolume,
      completedExercises,
    };

    setWorkoutHistory((prev) => [session, ...prev]);
    setLastSessionSummary(session);
    detectNewPRs(mergedExercises);
    setView("FINISH");
    setIsResting(false);
    setIsSettingsOpen(false);
  }

  function resetWorkoutState() {
    setSelectedRoutine(null);
    setCurrentExIndex(0);
    setCurrentSetIndex(0);
    setSets([]);
    setWorkoutStartTime(null);
    setElapsedTime(0);
    setIsResting(false);
    setTimeLeft(restSeconds);
    setIsTempoOn(false);
    setIsSettingsOpen(false);
  }

  function exitToHome() {
    resetWorkoutState();
    setView("HOME");
  }

  function speakTempo() {
    if (!isTempoOn || !speechRef.current || !currentExercise) return;
    const utterance = new SpeechSynthesisUtterance(`${currentExercise.name}, 템포 시작`);
    speechRef.current.cancel();
    speechRef.current.speak(utterance);
  }

  useEffect(() => {
    if (view === "WORKOUT" && currentExercise && isTempoOn) {
      speakTempo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExIndex, isTempoOn, view]);

  function renderSettingsModal() {
    if (!isSettingsOpen) return null;

    const categoryOptions = getDefaultCategories(routineType);

    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/40">
        <div className="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">운동 설정</h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
            >
              닫기
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-bold text-slate-500">루틴 분할</p>
              <div className="grid grid-cols-3 gap-2">
                {(["무분할", "상체", "하체"] as RoutineType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setRoutineType(type)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                      routineType === type
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-500">운동 강도 설정</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(INTENSITY_CONFIG) as Intensity[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setIntensity(key)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                      intensity === key
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {INTENSITY_CONFIG[key].displayLabel}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-500">운동 볼륨 설정</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(VOLUME_CONFIG) as VolumeMode[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setVolumeMode(key)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                      volumeMode === key
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {VOLUME_CONFIG[key].displayLabel}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                볼륨을 낮추면 같은 부위의 추천 종목 수가 줄어들고, 빠진 종목은 다음 회차에
                추천됩니다.
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-500">운동 종목 설정</p>
              <div className="grid grid-cols-3 gap-2">
                {categoryOptions.map((category) => {
                  const isOn = activeCategories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                        isOn ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-500">휴식 시간</p>
              <div className="grid grid-cols-5 gap-2">
                {[30, 45, 60, 75, 90].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setRestSeconds(sec)}
                    className={`rounded-2xl px-3 py-3 text-sm font-bold ${
                      restSeconds === sec
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {view === "WORKOUT" && (
            <button
              onClick={applySettingsToCurrentWorkout}
              className="mt-5 w-full rounded-[1.5rem] bg-slate-900 px-5 py-4 text-base font-black text-white"
            >
              현재 루틴에 적용
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderHomeView() {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900">
        <div className="mx-auto flex w-full max-w-md flex-col gap-0">
          <section className="rounded-t-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Today Preview
                </p>
                <h1 className="mt-2 text-3xl font-black leading-none">오늘의 루틴</h1>
              </div>

              <div className="rounded-[1.75rem] bg-white/10 px-4 py-3 text-right backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Points
                </p>
                <p className="mt-1 text-2xl font-black">{userPoints}P</p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-b-[2.5rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {routineType} {INTENSITY_CONFIG[intensity].displayLabel}
                  </h2>
                </div>

                <div className="flex items-start gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="min-w-[72px] rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] font-semibold tracking-tight text-slate-400">
                        예상 운동시간
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-800">
                        {formatHourMin(estimatedMinutes)}
                      </p>
                    </div>
                
                    <div className="min-w-[72px] rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] font-semibold tracking-tight text-slate-400">
                        메인 부위
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-800">
                        {mainCategory}
                      </p>
                    </div>
                
                    <div className="min-w-[72px] rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] font-semibold tracking-tight text-slate-400">
                        총 세트 수
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-800">
                        {totalSets}
                      </p>
                    </div>
                  </div>
                
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xl shadow-sm"
                    aria-label="설정 열기"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            </div>

            <div className="px-3 pb-3 pt-2">
              <div className="grid grid-cols-[40px_minmax(0,1fr)_64px_52px_52px] gap-2 rounded-[1.25rem] bg-slate-100 px-3 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                <div className="text-center">No</div>
                <div>Exercise</div>
                <div className="text-center">kg</div>
                <div className="text-center">set</div>
                <div className="text-center">rep</div>
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {previewRoutine.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className="grid grid-cols-[40px_minmax(0,1fr)_64px_52px_52px] gap-2 rounded-[1.35rem] border border-slate-200 px-3 py-3"
                  >
                    <div className="flex items-center justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                        {index + 1}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-black text-slate-900">
                        {exercise.name}
                      </p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
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
            </div>
          </section>

          <div className="h-28" />

          <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-100/95 px-4 pb-4 pt-3 backdrop-blur">
            <div className="mx-auto w-full max-w-md">
              <button
                onClick={() => generateRollingRoutine("초급", routineType, intensity)}
                disabled={previewRoutine.length === 0}
                className="w-full rounded-[2.5rem] bg-slate-900 px-5 py-5 text-lg font-black text-white shadow-2xl transition active:scale-[0.99] disabled:bg-slate-400"
              >
                내 루틴 시작하기
              </button>
            </div>
          </div>

          {renderSettingsModal()}
        </div>
      </main>
    );
  }

  function renderWorkoutView() {
    if (!selectedRoutine || !currentExercise) return null;

    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setView("CHECK")}
                className="text-sm font-semibold text-blue-600 underline"
              >
                ROUTINE LIST
              </button>

              <div className="flex items-center gap-2">
                <div className="text-lg font-bold">{formatTime(elapsedTime)}</div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg"
                  aria-label="운동 설정 열기"
                >
                  ⚙️
                </button>
              </div>

              <button onClick={exitToHome} className="text-sm font-semibold text-rose-500">
                EXIT
              </button>
            </div>

            <div className="mt-6">
              <div className="text-sm text-slate-500">
                {currentExIndex + 1} / {selectedRoutine.exercises.length}
              </div>
              <h2 className="mt-2 text-3xl font-black">{currentExercise.name}</h2>
              <div className="mt-2 text-sm text-slate-500">
                {currentExercise.subTarget} | {currentExercise.equipment}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold">현재 세트</div>
              <button
                onClick={() => setIsTempoOn((prev) => !prev)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  isTempoOn ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                템포 {isTempoOn ? "ON" : "OFF"}
              </button>
            </div>

            <div className="space-y-3">
              {sets.map((set, index) => {
                const isCurrent = index === currentSetIndex;
                return (
                  <div
                    key={set.id}
                    className={`grid grid-cols-[60px_1fr_40px_1fr] items-center gap-3 rounded-2xl border p-4 ${
                      isCurrent ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="text-center text-sm font-bold">SET {set.id}</div>

                    <input
                      type="number"
                      value={set.weight}
                      disabled={!isCurrent || isResting}
                      onChange={(e) =>
                        syncSetValue(index, "weight", Number(e.target.value || 0))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-3 text-center text-lg font-bold"
                    />

                    <div className="text-center text-lg font-black">×</div>

                    <input
                      type="number"
                      value={set.reps}
                      disabled={!isCurrent || isResting}
                      onChange={(e) =>
                        syncSetValue(index, "reps", Number(e.target.value || 0))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-3 text-center text-lg font-bold"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {!isResting ? (
            <button
              onClick={markCurrentSetDone}
              className="w-full rounded-[2.5rem] bg-slate-900 py-8 text-3xl font-black text-white shadow-2xl transition active:scale-[0.99]"
            >
              DONE
            </button>
          ) : (
            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl">
              <div className="text-center text-sm text-slate-500">휴식 중</div>
              <div className="mt-3 text-center text-5xl font-black">{timeLeft}</div>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => moveAfterRest(true)}
                  disabled={!canEarnReward}
                  className={`rounded-2xl px-5 py-4 text-lg font-bold ${
                    canEarnReward
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  +30P
                </button>
                <button
                  onClick={() => moveAfterRest(false)}
                  className="rounded-2xl bg-slate-900 px-5 py-4 text-lg font-bold text-white"
                >
                  SKIP
                </button>
              </div>
              <div className="mt-4 text-center text-xs text-slate-400">
                오늘 {rewardStatus.count} / {DAILY_REWARD_LIMIT}
              </div>
            </div>
          )}

          {renderSettingsModal()}
        </div>
      </main>
    );
  }

  function renderCheckView() {
    if (!selectedRoutine) return null;

    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">TODAY ROUTINE</h2>
            <button
              onClick={() => setView("WORKOUT")}
              className="text-sm font-semibold text-blue-600 underline"
            >
              BACK
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {selectedRoutine.exercises.map((exercise, index) => (
              <div
                key={`${exercise.id}-${index}`}
                className={`rounded-2xl border p-4 ${
                  index === currentExIndex
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="text-sm text-slate-500">
                  {index === currentExIndex ? "현재 운동" : `${index + 1}번째 운동`}
                </div>
                <div className="mt-1 text-lg font-bold">{exercise.name}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {exercise.category} | {exercise.subTarget} | {exercise.defaultWeight}kg ×{" "}
                  {exercise.defaultReps}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  function renderFinishView() {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-lg">
            <div className="text-sm text-slate-500">운동 완료</div>
            <h2 className="mt-3 text-4xl font-black">Great Job</h2>
            <div className="mt-4 text-slate-500">오늘 운동이 저장되었습니다.</div>
          </div>

          {lastSessionSummary && (
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-[2rem] bg-white p-6 shadow-lg">
                <div className="text-sm text-slate-500">총 운동 시간</div>
                <div className="mt-2 text-2xl font-black">
                  {formatTime(lastSessionSummary.durationSeconds)}
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-6 shadow-lg">
                <div className="text-sm text-slate-500">총 볼륨</div>
                <div className="mt-2 text-2xl font-black">
                  {lastSessionSummary.totalVolume.toLocaleString()}
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-6 shadow-lg">
                <div className="text-sm text-slate-500">연속 운동일</div>
                <div className="mt-2 text-2xl font-black">{streak}일</div>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[2rem] bg-white p-6 shadow-lg">
              <div className="text-lg font-bold">오늘 수행 운동</div>
              <div className="mt-4 space-y-3">
                {lastSessionSummary?.completedExercises.map((exercise) => (
                  <div
                    key={exercise.exerciseId}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <div className="font-semibold">{exercise.exerciseName}</div>
                      <div className="text-xs text-slate-400">{exercise.category}</div>
                    </div>
                    <div className="text-sm font-bold">
                      {exercise.volume.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-lg">
              <div className="text-lg font-bold">새로운 PR</div>
              <div className="mt-4 space-y-3">
                {newPRs.length > 0 ? (
                  newPRs.map((pr) => (
                    <div
                      key={pr.exerciseId}
                      className="rounded-2xl bg-emerald-50 px-4 py-3"
                    >
                      <div className="font-semibold">{pr.exerciseName}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        최고 중량 {pr.maxWeight}kg / 최고 반복 {pr.maxReps}회
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    이번 세션에서 갱신된 PR은 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={exitToHome}
            className="w-full rounded-[2.5rem] bg-slate-900 py-6 text-2xl font-black text-white shadow-2xl"
          >
            홈으로 돌아가기
          </button>
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
