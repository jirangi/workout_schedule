"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXERCISE_DATABASE, ExerciseInfo } from "../data/exercises";

type View = "HOME" | "WORKOUT" | "CHECK" | "FINISH";
type RoutineType = "무분할" | "상체" | "하체";
type Intensity = "LIGHT" | "NORMAL" | "HARD";

interface UserPersistence {
  userPoints: number;
  rewardStatus: {
    date: string;
    count: number;
  };
  lastIndices: Record<string, number>;
}

interface RoutineExercise extends ExerciseInfo {
  setCount: number;
}

const STORAGE_KEY = "MINIMAL_FIT_DATA";
const DAILY_REWARD_LIMIT = 2;
const REWARD_AMOUNT = 30;

const INTENSITY_CONFIG: Record<
  Intensity,
  {
    label: string;
    exerciseCount: number;
    setCount: number;
    restSeconds: number;
  }
> = {
  LIGHT: {
    label: "Light",
    exerciseCount: 4,
    setCount: 2,
    restSeconds: 45,
  },
  NORMAL: {
    label: "Normal",
    exerciseCount: 6,
    setCount: 3,
    restSeconds: 60,
  },
  HARD: {
    label: "Hard",
    exerciseCount: 8,
    setCount: 4,
    restSeconds: 75,
  },
};

function getTodayKey() {
  return new Date().toLocaleDateString();
}

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatEstimatedMinutes(totalMinutes: number) {
  return `${Math.round(totalMinutes)} min`;
}

function getTargetCategories(type: RoutineType) {
  if (type === "상체") return ["가슴", "등", "어깨", "팔"];
  if (type === "하체") return ["하체", "복근"];
  return ["가슴", "등", "하체", "어깨", "복근"];
}

function estimateWorkoutMinutes(
  exercises: RoutineExercise[],
  intensity: Intensity
): number {
  const config = INTENSITY_CONFIG[intensity];
  const setSeconds = exercises.reduce((acc, ex) => {
    const estimatedSetTime = ex.defaultReps >= 15 ? 45 : 35;
    return acc + estimatedSetTime * ex.setCount;
  }, 0);

  const totalSets = exercises.reduce((acc, ex) => acc + ex.setCount, 0);
  const totalRestSeconds = Math.max(0, totalSets - 1) * config.restSeconds;

  return (setSeconds + totalRestSeconds) / 60;
}

export default function Home() {
  const [view, setView] = useState<View>("HOME");
  const [selectedRoutine, setSelectedRoutine] = useState<{
    name: string;
    exercises: RoutineExercise[];
  } | null>(null);

  const [userPoints, setUserPoints] = useState(0);
  const [rewardStatus, setRewardStatus] = useState({
    date: getTodayKey(),
    count: 0,
  });
  const [lastIndices, setLastIndices] = useState<Record<string, number>>({});

  const [routineType, setRoutineType] = useState<RoutineType>("무분할");
  const [intensity, setIntensity] = useState<Intensity>("NORMAL");

  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [sets, setSets] = useState<
    { id: number; weight: number; reps: number; isEdited: boolean }[]
  >([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTempoOn, setIsTempoOn] = useState(false);

  const speechRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed: UserPersistence = JSON.parse(saved);
      setUserPoints(parsed.userPoints ?? 0);
      setLastIndices(parsed.lastIndices || {});

      const today = getTodayKey();
      setRewardStatus(
        parsed.rewardStatus?.date === today
          ? parsed.rewardStatus
          : { date: today, count: 0 }
      );
    }

    if (typeof window !== "undefined") {
      speechRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    const dataToSave: UserPersistence = {
      userPoints,
      rewardStatus,
      lastIndices,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [userPoints, rewardStatus, lastIndices]);

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

  const previewRoutine = useMemo(() => {
    const config = INTENSITY_CONFIG[intensity];
    const targetCategories = getTargetCategories(routineType);
    const picked: RoutineExercise[] = [];

    targetCategories.forEach((cat) => {
      const categoryExercises = EXERCISE_DATABASE.filter(
        (exercise) => exercise.category === cat
      );

      if (categoryExercises.length === 0) return;

      const lastIdx = lastIndices[cat] ?? -1;
      const nextIdx = (lastIdx + 1) % categoryExercises.length;
      const nextExercise = categoryExercises[nextIdx];

      picked.push({
        ...nextExercise,
        setCount: config.setCount,
      });
    });

    return picked.slice(0, config.exerciseCount);
  }, [intensity, routineType, lastIndices]);

  const estimatedMinutes = useMemo(() => {
    return estimateWorkoutMinutes(previewRoutine, intensity);
  }, [previewRoutine, intensity]);

  const currentExercise = selectedRoutine?.exercises[currentExIndex];

  const generateRollingRoutine = () => {
    const config = INTENSITY_CONFIG[intensity];
    const targetCategories = getTargetCategories(routineType);

    const newExercises: RoutineExercise[] = [];
    const updatedIndices = { ...lastIndices };

    targetCategories.forEach((cat) => {
      const categoryExercises = EXERCISE_DATABASE.filter(
        (exercise) => exercise.category === cat
      );

      if (categoryExercises.length === 0) return;

      const lastIdx = updatedIndices[cat] ?? -1;
      const nextIdx = (lastIdx + 1) % categoryExercises.length;
      const nextExercise = categoryExercises[nextIdx];

      newExercises.push({
        ...nextExercise,
        setCount: config.setCount,
      });

      updatedIndices[cat] = nextIdx;
    });

    const finalExercises = newExercises.slice(0, config.exerciseCount);

    setLastIndices(updatedIndices);
    setSelectedRoutine({
      name: `${routineType} ${config.label}`,
      exercises: finalExercises,
    });
    setWorkoutStartTime(Date.now());
    setElapsedTime(0);
    setCurrentExIndex(0);
    setCurrentSetIndex(0);
    setIsResting(false);
    setTimeLeft(config.restSeconds);

    if (finalExercises[0]) {
      setupExercise(finalExercises[0]);
    }

    setView("WORKOUT");
  };

  const setupExercise = (exercise: RoutineExercise) => {
    setSets(
      Array(exercise.setCount)
        .fill(null)
        .map((_, i) => ({
          id: i + 1,
          weight: exercise.defaultWeight,
          reps: exercise.defaultReps,
          isEdited: false,
        }))
    );
  };

  const updateSetValue = (
    index: number,
    field: "weight" | "reps",
    value: number
  ) => {
    const newSets = [...sets];
    newSets[index][field] = value;
    newSets[index].isEdited = true;

    if (index === 0) {
      for (let i = 1; i < newSets.length; i++) {
        if (!newSets[i].isEdited) {
          newSets[i][field] = value;
        }
      }
    }

    setSets(newSets);
  };

  const handleSkipRest = () => {
    if (rewardStatus.count < DAILY_REWARD_LIMIT) {
      setUserPoints((prev) => prev + REWARD_AMOUNT);
      setRewardStatus((prev) => ({
        ...prev,
        count: prev.count + 1,
      }));
    }

    setIsResting(false);
    setTimeLeft(INTENSITY_CONFIG[intensity].restSeconds);

    if (currentSetIndex < sets.length - 1) {
      setCurrentSetIndex((prev) => prev + 1);
    } else if (
      selectedRoutine &&
      currentExIndex < selectedRoutine.exercises.length - 1
    ) {
      const nextIndex = currentExIndex + 1;
      setCurrentExIndex(nextIndex);
      setCurrentSetIndex(0);
      setupExercise(selectedRoutine.exercises[nextIndex]);
    } else {
      setView("FINISH");
    }
  };

  if (view === "HOME") {
    return (
      <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl space-y-5">
          <section className="premium-card overflow-hidden bg-white">
            <div className="grid gap-0 md:grid-cols-[1.5fr_0.9fr]">
              <div className="p-5 md:p-7">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      Today Routine
                    </p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                      {previewRoutine.length} exercises
                    </h1>
                  </div>

                  <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white shadow-lg">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Points
                    </div>
                    <div className="text-2xl font-black">{userPoints}P</div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1fr)_64px_56px_56px] bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    <div>Exercise</div>
                    <div className="text-center">kg</div>
                    <div className="text-center">set</div>
                    <div className="text-center">rep</div>
                  </div>

                  <div className="divide-y divide-slate-100 bg-white">
                    {previewRoutine.map((exercise) => (
                      <div
                        key={exercise.id}
                        className="grid grid-cols-[minmax(0,1fr)_64px_56px_56px] items-center px-4 py-3"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="truncate text-[15px] font-semibold text-slate-900 md:text-base">
                            {exercise.name}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {exercise.category} · {exercise.subTarget}
                          </div>
                        </div>

                        <div className="text-center text-sm font-bold text-slate-800">
                          {exercise.defaultWeight === 0 ? "-" : exercise.defaultWeight}
                        </div>
                        <div className="text-center text-sm font-bold text-slate-800">
                          {exercise.setCount}
                        </div>
                        <div className="text-center text-sm font-bold text-slate-800">
                          {exercise.defaultReps}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between border-t border-slate-100 bg-slate-50 p-5 md:border-l md:border-t-0 md:p-7">
                <div className="space-y-5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Type
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(["무분할", "상체", "하체"] as RoutineType[]).map((item) => (
                        <button
                          key={item}
                          onClick={() => setRoutineType(item)}
                          className={`rounded-2xl px-3 py-3 text-sm font-bold transition ${
                            routineType === item
                              ? "bg-slate-900 text-white shadow-lg"
                              : "bg-white text-slate-600 shadow-sm"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Intensity
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(Object.keys(INTENSITY_CONFIG) as Intensity[]).map((key) => (
                        <button
                          key={key}
                          onClick={() => setIntensity(key)}
                          className={`rounded-2xl px-3 py-3 text-sm font-bold transition ${
                            intensity === key
                              ? "bg-blue-600 text-white shadow-lg"
                              : "bg-white text-slate-600 shadow-sm"
                          }`}
                        >
                          {INTENSITY_CONFIG[key].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Estimated
                    </div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-slate-900">
                      {formatEstimatedMinutes(estimatedMinutes)}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-500">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                          Exercises
                        </div>
                        <div className="mt-1 font-bold text-slate-900">
                          {previewRoutine.length}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                          Rest
                        </div>
                        <div className="mt-1 font-bold text-slate-900">
                          {INTENSITY_CONFIG[intensity].restSeconds}s
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <button
                    onClick={generateRollingRoutine}
                    className="w-full rounded-[1.75rem] bg-slate-900 px-5 py-5 text-lg font-black tracking-tight text-white shadow-2xl transition hover:translate-y-[-1px] active:scale-[0.99]"
                  >
                    START
                  </button>

                  <button
                    onClick={() => generateRollingRoutine()}
                    className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    다른 루틴 시작하기
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (view === "WORKOUT" && selectedRoutine && currentExercise) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setView("CHECK")}
                className="text-sm font-semibold text-blue-600 underline"
              >
                ROUTINE LIST
              </button>

              <div className="text-lg font-bold">{formatTime(elapsedTime)}</div>

              <button
                onClick={() => setView("HOME")}
                className="text-sm font-semibold text-rose-500"
              >
                EXIT
              </button>
            </div>

            <div className="mt-5">
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
                        updateSetValue(currentSetIndex, "weight", Number(e.target.value))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-3 text-center text-lg font-bold"
                    />

                    <div className="text-center text-lg font-black">×</div>

                    <input
                      type="number"
                      value={set.reps}
                      disabled={!isCurrent || isResting}
                      onChange={(e) =>
                        updateSetValue(currentSetIndex, "reps", Number(e.target.value))
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
              onClick={() => setIsResting(true)}
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
                  onClick={handleSkipRest}
                  className="rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-bold text-white"
                >
                  +30P
                </button>
                <button
                  onClick={() => {
                    setIsResting(false);
                    setTimeLeft(INTENSITY_CONFIG[intensity].restSeconds);
                  }}
                  className="rounded-2xl bg-slate-900 px-5 py-4 text-lg font-bold text-white"
                >
                  SKIP
                </button>
              </div>
              <div className="mt-4 text-center text-xs text-slate-400">
                {rewardStatus.count} / {DAILY_REWARD_LIMIT}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (view === "CHECK" && selectedRoutine) {
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

  if (view === "FINISH") {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-lg">
          <div className="text-sm text-slate-500">운동 완료</div>
          <h2 className="mt-3 text-4xl font-black">Great Job</h2>
          <div className="mt-3 text-slate-500">오늘 운동이 저장되었습니다.</div>

          <button
            onClick={() => setView("HOME")}
            className="mt-8 w-full rounded-[2rem] bg-slate-900 py-5 text-xl font-black text-white shadow-xl"
          >
            HOME
          </button>
        </div>
      </main>
    );
  }

  return null;
}
