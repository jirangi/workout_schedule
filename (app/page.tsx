"use client";
import { useState, useEffect, useRef } from "react";
import { EXERCISE_DATABASE, ExerciseInfo } from "../data/exercises";

// [Design Spec 2.2] 사용자 영구 상태 인터페이스
interface UserPersistence {
  userPoints: number;
  rewardStatus: { date: string; count: number };
  lastIndices: Record<string, number>;
}

export default function Home() {
  // --- [State Management] ---
  const [view, setView] = useState("HOME");
  const [selectedRoutine, setSelectedRoutine] = useState<any>(null);
  const [userPoints, setUserPoints] = useState(0);
  const [rewardStatus, setRewardStatus] = useState({ date: new Date().toLocaleDateString(), count: 0 });
  const [lastIndices, setLastIndices] = useState<Record<string, number>>({});
  
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [sets, setSets] = useState<any[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTempoOn, setIsTempoOn] = useState(false);
  const speechRef = useRef<any>(null);

  // --- [Persistence: Load & Save] ---
  useEffect(() => {
    const saved = localStorage.getItem("MINIMAL_FIT_DATA");
    if (saved) {
      const parsed: UserPersistence = JSON.parse(saved);
      setUserPoints(parsed.userPoints);
      setLastIndices(parsed.lastIndices || {});
      const today = new Date().toLocaleDateString();
      setRewardStatus(parsed.rewardStatus.date === today ? parsed.rewardStatus : { date: today, count: 0 });
    }
    if (typeof window !== "undefined") {
      speechRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    const dataToSave: UserPersistence = { userPoints, rewardStatus, lastIndices };
    localStorage.setItem("MINIMAL_FIT_DATA", JSON.stringify(dataToSave));
  }, [userPoints, rewardStatus, lastIndices]);

  // --- [Technical Logic] ---

  // [F23] 순환형 알고리즘 (Modular Arithmetic)
  const generateRollingRoutine = (level: string, type: string) => {
    const count = level === "초급" ? 4 : level === "중급" ? 6 : 9;
    let targetCats = type === "상체" ? ["가슴", "등", "어깨", "팔"] : type === "하체" ? ["하체", "복근"] : ["가슴", "등", "하체", "어깨"];
    
    let newExercises: ExerciseInfo[] = [];
    let updatedIndices = { ...lastIndices };

    targetCats.forEach(cat => {
      const catExs = EXERCISE_DATABASE.filter(e => e.category === cat);
      if (catExs.length > 0) {
        const lastIdx = updatedIndices[cat] ?? -1;
        const nextIdx = (lastIdx + 1) % catExs.length; // 설계서 3.2 수식 적용
        newExercises.push(catExs[nextIdx]);
        updatedIndices[cat] = nextIdx;
      }
    });

    setLastIndices(updatedIndices);
    setSelectedRoutine({ name: `${level} ${type}`, exercises: newExercises.slice(0, count) });
    setWorkoutStartTime(Date.now());
    setupExercise(newExercises[0]);
    setView("WORKOUT");
  };

  const setupExercise = (ex: any) => {
    setSets(Array(3).fill(null).map((_, i) => ({
      id: i + 1, weight: ex.defaultWeight, reps: ex.defaultReps, isEdited: false
    })));
  };

  // [F1] Zero-Click 세트 동기화
  const updateSetValue = (index: number, field: "weight" | "reps", value: number) => {
    const newSets = [...sets];
    newSets[index][field] = value;
    newSets[index].isEdited = true;
    if (index === 0) {
      for (let i = 1; i < newSets.length; i++) {
        if (!newSets[i].isEdited) newSets[i][field] = value;
      }
    }
    setSets(newSets);
  };

  const handleSkipRest = () => {
    // [REQ-02] 리워드 정책 적용
    if (rewardStatus.count < 2) {
      setUserPoints(p => p + 30);
      setRewardStatus(prev => ({ ...prev, count: prev.count + 1 }));
    }
    setIsResting(false); setTimeLeft(60);
    if (currentSetIndex < sets.length - 1) setCurrentSetIndex(p => p + 1);
    else if (currentExIndex < selectedRoutine.exercises.length - 1) {
      const next = currentExIndex + 1;
      setCurrentExIndex(next); setCurrentSetIndex(0); setupExercise(selectedRoutine.exercises[next]);
    } else setView("FINISH");
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // --- [Views] ---
  if (view === "HOME") {
    return (
      <div className="flex flex-col items-center min-h-screen p-6 bg-slate-50">
        <header className="w-full flex justify-between items-center py-6">
          <h1 className="text-2xl font-black italic tracking-tighter">MINIMAL FIT</h1>
          <button className="bg-white px-4 py-2 rounded-2xl shadow-sm border font-black text-sm">💎 {userPoints.toLocaleString()} FP</button>
        </header>
        <div className="w-full max-w-[400px] mt-10 space-y-4">
          <button onClick={() => generateRollingRoutine("초급", "무분할")} 
            className="w-full aspect-[16/9] bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-10 text-left text-white shadow-2xl active:scale-95 transition-all">
            <h2 className="text-3xl font-black italic">내 루틴 시작하기</h2>
            <p className="opacity-70 mt-1 italic text-sm">지난 운동 다음 종목부터 시작 →</p>
          </button>
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white p-8 rounded-[2.2rem] border-2 border-slate-100 shadow-sm font-black text-sm active:scale-95">⚡ 루틴 변경</button>
            <button className="bg-white p-8 rounded-[2.2rem] border-2 border-slate-100 shadow-sm font-black text-sm active:scale-95">🛍️ 리워드 샵</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "WORKOUT") {
    const ex = selectedRoutine.exercises[currentExIndex];
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-center">
        <header className="absolute top-12 w-full px-10 flex justify-between items-center font-black text-xs text-slate-400">
          <button onClick={() => setView("CHECK")} className="text-blue-600 underline">ROUTINE LIST</button>
          <span>{formatTime(elapsedTime)}</span>
          <button onClick={() => setView("HOME")}>EXIT</button>
        </header>
        <span className="text-blue-600 font-black text-4xl uppercase tracking-tighter italic">{ex.name}</span>
        <p className="text-slate-400 font-bold text-[10px] mt-2 mb-10 tracking-widest uppercase">{ex.subTarget} | {ex.equipment}</p>
        <div className="flex items-center space-x-6 mb-20 text-8xl font-black">
           <input type="number" value={sets[currentSetIndex].weight} onChange={(e) => updateSetValue(currentSetIndex, "weight", Number(e.target.value))} className="w-32 text-center border-none p-0 focus:ring-0" />
           <span className="text-slate-100 font-light">×</span>
           <input type="number" value={sets[currentSetIndex].reps} onChange={(e) => updateSetValue(currentSetIndex, "reps", Number(e.target.value))} className="w-32 text-center border-none p-0 focus:ring-0" />
        </div>
        <button onClick={() => setIsResting(true)} className="w-full max-w-[400px] py-10 bg-slate-900 text-white rounded-[2.5rem] text-4xl font-black shadow-2xl active:scale-95 transition-all">DONE</button>
      </div>
    );
  }

  return null;
}
