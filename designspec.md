# 📐 [Minimal Fit] 설계서 v1.0.0 (Design Spec)

## 1. 프로젝트 구조 및 파일 시스템 (File System)
소스 코드의 가독성과 유지보수성을 위해 관심사 분리(SoC) 원칙을 준수합니다.

| 분류 | 파일/경로 | 역할 |
| :--- | :--- | :--- |
| **Config** | `/next.config.mjs` | GitHub Pages 배포 경로(basePath) 및 정적 출력(export) 설정 |
| **Data** | `/data/exercises.ts` | 150종 해부학적 운동 메타데이터 (정적 JSON DB) |
| **Logic** | `/app/page.tsx` | 메인 뷰 컨트롤러, 전역 상태 관리(State), 라우팅 로직 |
| **Persistence** | `LocalStorage` | 포인트, 루틴 인덱스, 리워드 한도 정보의 브라우저 영구 저장 |
| **Style** | `/app/globals.css` | Tailwind CSS 기반 프리미엄 카드 UI(곡률, 그림자) 테마 정의 |

---

## 2. 핵심 데이터 스키마 (Core Data Schema)

### 2.1 운동 메타데이터 (ExerciseInfo)
`data/exercises.ts`에 정의되는 개별 운동 객체의 인터페이스입니다.

```typescript
interface ExerciseInfo {
  id: string;         // 고유 식별자 (예: 'ch_u_1')
  category: string;   // 근육 대분류 (가슴, 등, 하체, 어깨, 팔, 복근)
  subTarget: string;  // 해부학적 소분류 (상부, 중부, 하부, 너비, 두께 등)
  name: string;       // 운동 정식 명칭
  equipment: string;  // 사용 기구 (바벨, 덤벨, 머신, 맨몸)
  defaultWeight: number; // 초기 추천 중량 (kg)
  defaultReps: number;   // 초기 추천 횟수 (reps)
}
```

### 2.2 사용자 영구 상태 (UserPersistence) 
브라우저 localStorage 내 'MINIMAL_FIT_DATA' 키에 JSON 형태로 저장되는 구조입니다.

| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| **userPoints** | `number` | 유저가 보유한 총 포인트 (기본값: 0) |
| **rewardStatus** | `object` | { date: 'YYYY-MM-DD', count: 적립횟수 } (Max 2회) |
| **lastIndices** | `object` | { '가슴': 3, '등': 5, ... } 각 부위별 마지막 수행 인덱스 |

**[저장 규칙]**
1. 앱 실행 시 해당 데이터를 로드하여 전역 상태(State)에 주입한다.
2. 상태가 변할 때마다(포인트 획득, 운동 완료 등) 즉시 LocalStorage에 덮어쓴다.
3. 날짜가 바뀌어 접속할 경우 rewardStatus.count는 자동으로 0으로 초기화한다.

---

## 3. 핵심 비즈니스 로직 설계 (Technical Logic)

### 3.1 [F1] Zero-Click 세트 동기화 로직
* **트리거**: 사용자가 1세트(sets[0])의 무게나 횟수를 수정할 때 발생.
* **작동 원리**: sets 배열을 순회하며 isEdited 속성이 false인 후속 세트들을 탐색하여 1세트의 값과 동일하게 일괄 업데이트.
* **보호 기제**: 이미 수동 수정된 세트(isEdited: true)는 동기화에서 제외함.

### 3.2 [F23] 순환형 루틴 알고리즘 (Rolling Algorithm)
* **목적**: 150종의 운동을 편중 없이 순서대로 수행.
* **공식**: 
  $nextIndex = (lastIndex + 1) \pmod{categoryList.length}$
* **저장 정책**: SESSION_FINISH 단계에서 최종 수행된 종목의 인덱스를 로컬 스토리지에 갱신.

### 3.3 [F2] AI 템포 가이드 엔진
* **기술**: 브라우저 내장 Web Speech Synthesis API (window.speechSynthesis) 활용.
* **동작**: isTempoOn 상태 및 view === "WORKOUT" 조건 충족 시 1초 간격 음성 카운트 실행.
* **최적화**: 음성 출력 전 기존 대기열을 초기화(cancel())하여 중첩 방지.

---

## 4. UI/UX 컴포넌트 및 인터랙션 규격

### 4.1 시각적 아이덴티티 (Visual Identity)
* **Corner Radius**: 모든 메인 카드 및 버튼은 rounded-[2.5rem] (40px) 곡률 적용.
* **Shadows**: 프리미엄 입체감을 위해 shadow-2xl 적용, 클릭 시 active:scale-95 피드백.
* **Layout Grid**: 홈 화면 기능 버튼은 grid-cols-2를 사용하여 가로 50:50 대칭 유지.

### 4.2 상태 기반 UI 처리
* **Rest Mode**: 휴식 진입 시 배경을 bg-slate-950으로 변경하고 타이머 시인성 극대화.
* **Reward Feedback**: 포인트 적립 성공 시 상단 FP 대시보드에 animate-bounce 애니메이션 적용.
