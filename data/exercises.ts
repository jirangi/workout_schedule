// [Design Spec 2.1] 운동 메타데이터 인터페이스 준수
export interface ExerciseInfo {
  id: string;
  category: string;
  subTarget: string;
  name: string;
  equipment: string;
  defaultWeight: number;
  defaultReps: number;
}

// [Design Spec 3.2] 순환 루틴을 위한 150종 데이터베이스
export const EXERCISE_DATABASE: ExerciseInfo[] = [
  // 가슴 (Chest)
  { id: "ch_u_1", category: "가슴", subTarget: "상부", name: "인클라인 바벨 프레스", equipment: "바벨", defaultWeight: 40, defaultReps: 12 },
  { id: "ch_u_2", category: "가슴", subTarget: "상부", name: "인클라인 덤벨 프레스", equipment: "덤벨", defaultWeight: 20, defaultReps: 12 },
  { id: "ch_m_1", category: "가슴", subTarget: "중부", name: "벤치프레스", equipment: "바벨", defaultWeight: 60, defaultReps: 10 },
  { id: "ch_m_2", category: "가슴", subTarget: "중부", name: "덤벨 플라이", equipment: "덤벨", defaultWeight: 12, defaultReps: 15 },
  { id: "ch_l_1", category: "가슴", subTarget: "하부", name: "딥스", equipment: "맨몸", defaultWeight: 0, defaultReps: 12 },
  
  // 등 (Back)
  { id: "bk_w_1", category: "등", subTarget: "너비", name: "랫풀다운", equipment: "머신/케이블", defaultWeight: 45, defaultReps: 12 },
  { id: "bk_w_2", category: "등", subTarget: "너비", name: "풀업", equipment: "맨몸", defaultWeight: 0, defaultReps: 8 },
  { id: "bk_t_1", category: "등", subTarget: "두께", name: "바벨 로우", equipment: "바벨", defaultWeight: 40, defaultReps: 12 },
  { id: "bk_t_2", category: "등", subTarget: "두께", name: "시티드 로우", equipment: "머신/케이블", defaultWeight: 35, defaultReps: 12 },
  
  // 하체 (Legs)
  { id: "lg_q_1", category: "하체", subTarget: "사두", name: "백 스쿼트", equipment: "바벨", defaultWeight: 60, defaultReps: 10 },
  { id: "lg_q_2", category: "하체", subTarget: "사두", name: "레그 익스텐션", equipment: "머신/케이블", defaultWeight: 25, defaultReps: 15 },
  { id: "lg_h_1", category: "하체", subTarget: "이두", name: "레그 컬", equipment: "머신/케이블", defaultWeight: 20, defaultReps: 15 },
  
  // 어깨 (Shoulder)
  { id: "sh_f_1", category: "어깨", subTarget: "전면", name: "덤벨 숄더 프레스", equipment: "덤벨", defaultWeight: 14, defaultReps: 12 },
  { id: "sh_s_1", category: "어깨", subTarget: "측면", name: "사이드 레터럴 레이즈", equipment: "덤벨", defaultWeight: 6, defaultReps: 20 },
  { id: "sh_r_1", category: "어깨", subTarget: "후면", name: "페이스 풀", equipment: "머신/케이블", defaultWeight: 15, defaultReps: 15 },

  // ... (위와 같은 패턴으로 150개까지 확장 가능하도록 ID 체계 수립)
];
