"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXERCISE_DATABASE, ExerciseInfo } from "../data/exercises";

type View = "HOME" | "WORKOUT" | "CHECK" | "FINISH";

interface SetLog {
  id: number;
  weight: number;
  reps: number;
  isEdited: boolean;
  isDone: boolean;
  completedAt?: string;
}

interface WorkoutExercise {
  exerciseId: string;
  name: string;
  category: string;
  subTarget: string;
  equipment: string;
  defaultWeight: number;
  defaultReps: number;
  sets: SetLog[];
}

interface SelectedRoutine {
  name: string;
  level: string;
  type: string;
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

const STORAGE_KEY = "MINIMAL_FIT_DATA";
const DEFAULT_REST_SECONDS = 60;
const DAILY_REWARD_LIMIT = 2;
const REWARD_AMOUNT = 30;

const DEFAULT_PERSISTENCE: UserPersistence = {
  userPoints: 0,
  rewardStatus: {
    date: "",
    count: 0,
  },
  lastIndices: {},
  workoutHistory: [],
  personalRecords: [],
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

function createInitialSets(exercise: Pick<ExerciseInfo, "defaultWeight" | "defaultReps">): SetLog[] {
  return Array.from({ length: 3 }, (_, i) => ({
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

export default function Home() {
  // 1) View state
  const [view, setView] = useState<View>("HOME");

  // 2) Persistence state
  const [userPoints, setUserPoints] = useState(0);
  const [rewardStatus, setRewardStatus] = useState<RewardStatus>({
    date: getTodayKey(),
    count: 0,
  });
  const [lastIndices, setLastIndices] = useState<Record<string, number>>({});
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);

  // 3) Routine/session state
  const [selectedRoutine, setSelectedRoutine] = useState<SelectedRoutine | null>(null);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 4) Rest/support state
  const [isResting, setIsResting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_REST_SECONDS);
  const [isTempoOn, setIsTempoOn] = useState(false);

  // 5) Finish/report state
  const [lastSessionSummary, setLastSessionSummary] = useState<WorkoutSession | null>(null);
  const [newPRs, setNewPRs] = useState<PersonalRecord[]>([]);

  const speechRef = useRef<SpeechSynthesis | null>(null);

  // Persistence load
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

  // Persistence save
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

  // Workout elapsed timer
  useEffect(() => {
    if (view !== "WORKOUT" || !workoutStartTime) return;

    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [view, workoutStartTime]);

  // Rest timer
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

  // Auto move when rest ends
  useEffect(() => {
    if (!isResting || timeLeft > 0) return;
    moveAfterRest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isResting]);

  const currentExercise = useMemo(() => {
    if (!selectedRoutine) return null;
    return selectedRoutine.exercises[currentExIndex] ?? null;
  }, [selectedRoutine, currentExIndex]);

  const canEarnReward = rewardStatus.count < DAILY_REWARD_LIMIT;
  const isLastSet = currentSetIndex === sets.length - 1;
  const isLastExercise =
    !!selectedRoutine && currentExIndex === selectedRoutine.exercises.length - 1;
  const todayRoutineLabel = selectedRoutine?.name ?? "아직 시작하지 않음";
  const streak = useMemo(() => calculateStreak(workoutHistory), [workoutHistory]);

  function buildWorkoutExercise(exercise: ExerciseInfo): WorkoutExercise {
    return {
      exerciseId: exercise.id,
      name: exercise.name,
      category: exercise.category,
      subTarget: exercise.subTarget,
      equipment: exercise.equipment,
      defaultWeight: exercise.defaultWeight,
      defaultReps: exercise.defaultReps,
      sets: createInitialSets(exercise),
    };
  }

  function generateRollingRoutine(level: string, type: string) {
    const count = level === "초급" ? 4 : level === "중급" ? 6 : 8;

    const targetCats =
      type === "상체"
        ? ["가슴", "등", "어깨", "팔"]
        : type === "하체"
        ? ["하체", "복근"]
        : ["가슴", "등", "하체", "어깨"];

    const updatedIndices = { ...lastIndices };
    const pickedExercises: WorkoutExercise[] = [];

    targetCats.forEach((cat) => {
      const catExercises = EXERCISE_DATABASE.filter((exercise) => exercise.category === cat);
      if (catExercises.length === 0) return;

      const lastIdx = updatedIndices[cat] ?? -1;
      const nextIdx = (lastIdx + 1) % catExercises.length;
      const nextExercise = catExercises[nextIdx];

      pickedExercises.push(buildWorkoutExercise(nextExercise));
      updatedIndices[cat] = nextIdx;
    });

    const finalExercises = pickedExercises.slice(0, count);

    if (finalExercises.length === 0) return;

    setLastIndices(updatedIndices);
    setSelectedRoutine({
      name: `${level} ${type}`,
      level,
      type,
      exercises: finalExercises,
    });
    setCurrentExIndex(0);
    setCurrentSetIndex(0);
    setSets(finalExercises[0].sets);
    setWorkoutStartTime(Date.now());
    setElapsedTime(0);
    setIsResting(false);
    setTimeLeft(DEFAULT_REST_SECONDS);
    setNewPRs([]);
    setLastSessionSummary(null);
    setView("WORKOUT");
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

      return next;
    });
  }

  function markCurrentSetDone() {
    setSets((prev) =>
      prev.map((set, index) =>
        index === currentSetIndex
          ? {
              ...set,
              isDone: true,
              completedAt: new Date().toISOString(),
            }
          : set
      )
    );
    setIsResting(true);
    setTimeLeft(DEFAULT_REST_SECONDS);
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

    setIsResting(false);
    setTimeLeft(DEFAULT_REST_SECONDS);

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
      const prevRecord = nextRecords.find((record) => record.exerciseId === exercise.exerciseId);

      const isWeightPR = !prevRecord || maxWeight > prevRecord.maxWeight;
      const isRepsPR = !prevRecord || maxReps > prevRecord.maxReps;

      if (isWeightPR || isRepsPR) {
        const updatedRecord: PersonalRecord = {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          maxWeight: Math.max(prevRecord?.maxWeight ?? 0, maxWeight),
          maxReps: Math.max(prevRecord?.maxReps ?? 0, maxReps),
          updatedAt: new Date().toISOString(),
        };

        const existingIndex = nextRecords.findIndex(
          (record) => record.exerciseId === exercise.exerciseId
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
      exerciseId: exercise.exerciseId,
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
  }

  function resetWorkoutState() {
    setSelectedRoutine(null);
    setCurrentExIndex(0);
    setCurrentSetIndex(0);
    setSets([]);
    setWorkoutStartTime(null);
    setElapsedTime(0);
    setIsResting(false);
    setTimeLeft(DEFAULT_REST_SECONDS);
    setIsTempoOn(false);
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

  function renderHomeView() {
    const latestSession = workoutHistory[0];

    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between rounded-[2rem] bg-white p-6 shadow-lg">
            <div>
              <h1 className="text-3xl font-black tracking-tight">MINIMAL FIT</h1>
              <p className="mt-2 text-sm text-slate-500">고민 없이 바로 시작하는 운동 앱</p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white">
              <div className="text-xs text-slate-300">보유 포인트</div>
              <div className="text-2xl font-black">{userPoints.toLocaleString()} FP</div>
            </div>
          </div>

          <button
            onClick={() => generateRollingRoutine("초급", "무분할")}
            className="w-full rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-left text-white shadow-2xl transition active:scale-[0.99]"
          >
            <div className="text-sm font-medium opacity-90">오늘의 루틴</div>
            <div className="mt-3 text-3xl font-black">내 루틴 시작하기</div>
            <div className="mt-3 text-base opacity-90">지난 운동 다음 종목부터 시작 →</div>
          </button>

          <div className="grid gap-6 md:grid-cols-3">
            <button
              onClick={() => generateRollingRoutine("초급", "상체")}
              className="rounded-[2rem] bg-white p-6 text-left shadow-lg transition hover:-translate-y-0.5"
            >
              <div className="text-sm text-slate-500">빠른 시작</div>
              <div className="mt-2 text-xl font-bold">상체 루틴</div>
            </button>

            <button
              onClick={() => generateRollingRoutine("초급", "하체")}
              className="rounded-[2rem] bg-white p-6 text-left shadow-lg transition hover:-translate-y-0.5"
            >
              <div className="text-sm text-slate-500">빠른 시작</div>
              <div className="mt-2 text-xl font-bold">하체 루틴</div>
            </button>

            <div className="rounded-[2rem] bg-white p-6 shadow-lg">
              <div className="text-sm text-slate-500">오늘 적립 가능</div>
              <div className="mt-2 text-xl font-bold">
                {Math.max(0, DAILY_REWARD_LIMIT - rewardStatus.count)}회 남음
              </div>
              <div className="mt-2 text-sm text-slate-400">1일 최대 2회 / 회당 30FP</div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[2rem] bg-white p-6 shadow-lg">
              <div className="text-sm text-slate-500">최근 루틴</div>
              <div className="mt-2 text-xl font-bold">{todayRoutineLabel}</div>
              <div className="mt-4 text-sm text-slate-400">
                스트릭: <span className="font-semibold text-slate-700">{streak}일</span>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-lg">
              <div className="text-sm text-slate-500">최근 운동</div>
              {latestSession ? (
                <>
                  <div className="mt-2 text-xl font-bold">{latestSession.routineName}</div>
                  <div className="mt-3 text-sm text-slate-500">
                    총 볼륨 {latestSession.totalVolume.toLocaleString()} / 시간{" "}
                    {formatTime(latestSession.durationSeconds)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-400">아직 운동 기록이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  function renderWorkoutView() {
    if (!selectedRoutine || !currentExercise) return null;

    const currentSet = sets[currentSetIndex];

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
              <div className="text-lg font-bold">{formatTime(elapsedTime)}</div>
              <button
                onClick={exitToHome}
                className="text-sm font-semibold text-rose-500"
              >
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

            {currentSet && (
              <div className="mt-6 text-sm text-slate-500">
                현재 진행: {currentSet.id}세트 / {sets.length}세트
              </div>
            )}
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
                  광고 보고 +30FP
                </button>
                <button
                  onClick={() => moveAfterRest(false)}
                  className="rounded-2xl bg-slate-900 px-5 py-4 text-lg font-bold text-white"
                >
                  휴식 건너뛰기
                </button>
              </div>
              <div className="mt-4 text-center text-xs text-slate-400">
                오늘 {rewardStatus.count} / {DAILY_REWARD_LIMIT}회 적립
              </div>
            </div>
          )}
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
                key={`${exercise.exerciseId}-${index}`}
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
                  {exercise.category} | {exercise.subTarget} | {exercise.equipment}
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
