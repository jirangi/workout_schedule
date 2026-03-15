# 📐 [Minimal Fit] 설계서 v1.0.0 (Design Spec)

## 1. 프로젝트 구조 및 파일 시스템 (File System)

| 분류 | 파일/경로 | 역할 |
| :--- | :--- | :--- |
| **Config** | `/package.json` | 프로젝트 의존성 및 스크립트 정의 |
| **Config** | `/next.config.mjs` | 배포 경로(basePath) 및 정적 출력 설정 |
| **Config** | `/tailwind.config.ts` | UI 규격 및 40px 곡률 설정 |
| **Config** | `/tsconfig.json` | TypeScript 컴파일 옵션 설정 |
| **Data** | `/data/exercises.ts` | 150종 해부학적 운동 메타데이터 |
| **Logic** | `/app/layout.tsx` | Next.js 루트 레이아웃 및 폰트 설정 |
| **Logic** | `/app/page.tsx` | 메인 뷰 컨트롤러 및 상태 관리 로직 |
| **Style** | `/app/globals.css` | Tailwind CSS 및 프리미엄 카드 테마 정의 |
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

### 2.3 홈/루틴 제어 상태 (Home / Routine Control State)

`app/page.tsx` 내부에서 홈 프리뷰와 설정 모달 제어를 위해 사용하는 상태입니다.

```typescript
type RoutineType = "무분할" | "상체" | "하체";
type Intensity = "LIGHT" | "NORMAL" | "HARD";
type VolumeMode = "LOW" | "NORMAL" | "HIGH";

type PreviewOverride = Partial<
  Pick<RoutineExercise, "defaultWeight" | "defaultReps" | "setCount">
>;
### 2.4 진행 중 운동 세션 스키마 (WorkoutSession)

운동 도중 홈 화면 이동 후 복귀, 휴식 화면 전환, 조기 종료 저장을 위해
브라우저 localStorage 내 `MINIMAL_FIT_WORKOUT_SESSION` 키에 JSON 형태로 저장되는 구조입니다.

```typescript
interface WorkoutSet {
  id: number;
  weight: number;
  reps: number;
  completed: boolean;
  isEdited: boolean;
}

interface SessionExercise extends ExerciseInfo {
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

### 3.4 [F24] 홈 프리뷰 생성 로직
* **목적**: 홈 화면에서 오늘의 루틴을 운동 목록 표 형태로 즉시 미리보기.
* **입력값**: `routineType`, `intensity`, `volumeMode`, `activeCategories`, `lastIndices`, `previewOverrides`
* **출력값**: `previewRoutine`
* **규칙**:
  1. `routineType`에 따라 기본 부위 목록을 결정한다.
  2. `activeCategories`에 포함된 부위만 오늘 루틴 후보에 포함한다.
  3. `volumeMode`에 따라 부위별 추천 종목 수를 조절한다.
  4. 추천 종목은 Rolling Index를 기준으로 순환 선택한다.
  5. `previewOverrides`가 존재하면 기본 중량/세트/반복 값을 덮어쓴다.

### 3.5 [F25] 운동 볼륨 설정 로직
* **목적**: 부위별 추천 종목 수를 줄이거나 늘려 운동량을 조절.
* **동작 원리**:
  - `LOW`: 부위별 추천 종목 수 축소
  - `NORMAL`: 기본 추천 종목 수 적용
  - `HIGH`: 부위별 추천 종목 수 확대
* **순환 정책**: 이번 회차에서 제외된 종목은 다음 회차 Rolling Routine에서 다시 추천 대상이 된다.

### 3.6 [F26] 운동 종목 토글 로직
* **목적**: 오늘 루틴에 포함할 부위를 사용자가 직접 켜고 끌 수 있도록 지원.
* **동작 원리**:
  - `activeCategories` 배열에 부위명을 추가/제거하여 토글 처리
  - 토글 OFF 된 부위는 홈 프리뷰와 실제 루틴 생성에서 제외

### 3.7 [F27] 프리뷰 직접 수정 로직
* **목적**: 홈 화면 프리뷰에서 각 운동의 kg / set / rep를 직접 수정.
* **동작 원리**:
  - 사용자가 숫자를 클릭하면 prompt 또는 입력 UI를 통해 값을 수정
  - 수정값은 `previewOverrides`에 저장
  - 실제 운동 시작 시 override가 반영된 루틴으로 세트가 생성됨

### 3.8 [F28] 공통 설정 모달 로직
* **목적**: 홈 화면과 운동 화면에서 동일한 설정 UI 제공.
* **설정 항목**:
  - 루틴 분할
  - 운동 강도
  - 운동 볼륨
  - 운동 종목
  - 휴식 시간
* **적용 방식**:
  - 홈 화면에서는 프리뷰에 즉시 반영
  - 운동 화면에서는 현재 루틴에 재적용

### 복붙 내용 2 — 비즈니스 로직
```md
### 3.9 [F29] 진행 세션 복귀 로직

* **목적**: 운동 도중 홈 화면 또는 앱 재진입 시 이전 위치에서 즉시 이어서 시작할 수 있도록 지원.
* **복원 대상**:
  - `currentExerciseIndex`
  - `currentSetIndex`
  - `elapsedSeconds`
  - `isResting`
  - `timeLeft`
  - 현재 세트의 중량/반복값
* **동작 원리**:
  1. 앱 초기 진입 시 `MINIMAL_FIT_WORKOUT_SESSION` 존재 여부를 확인한다.
  2. 저장된 세션이 있으면 홈 화면에 '진행 중인 운동 이어하기' 진입점을 표시한다.
  3. 복귀 시 마지막 저장 위치로 즉시 이동한다.

### 3.10 [F30] 운동 전환 로직

* **목적**: 사용자가 운동 기구 사용 불가, 혼잡, 컨디션 변화 등에 대응할 수 있도록 현재 운동을 전환.
* **전환 방식**:
  - `Next Exercise`: 현재 순서 기준 다음 운동으로 이동
  - `Next Muscle Group`: 다음 카테고리의 미완료 운동으로 이동
  - `Same Muscle Alternative`: 동일한 `category + subTarget`을 가지는 다른 운동으로 교체
* **진행 규칙**:
  1. 사용자가 선택한 운동이 현재 운동으로 설정된다.
  2. 해당 운동 수행 후에는 미완료 상태인 원래 순서 운동부터 다시 이어서 진행한다.

### 3.11 [F31] 조기 종료 저장 로직

* **목적**: 루틴 전체를 다 끝내지 못한 경우에도 오늘 운동 기록을 유효하게 저장.
* **저장 규칙**:
  1. 완료된 세트가 1개 이상인 운동만 기록 대상으로 본다.
  2. 통계(PR / 볼륨 / 연속성)는 완료된 세트 기준으로 계산한다.
  3. 미완료 운동은 결과 기록에서 제외한다.
  4. Rolling Index는 마지막으로 완료된 운동 기준으로 갱신한다.

### 3.12 [F32] 휴식 전용 화면 로직

* **목적**: DONE 이후 휴식 상태를 별도 화면으로 분리해 집중도를 높인다.
* **동작 원리**:
  1. 세트 완료 시 `view`는 `REST`로 전환된다.
  2. 광고 표시 가능 시 광고 UI를 우선 노출한다.
  3. 광고가 없을 경우 남은 휴식 시간을 중앙에 크게 표시한다.
  4. 사용자가 '휴식 완료하기'를 누르거나 타이머가 종료되면 다음 위치로 이동한다.

### 3.13 [F33] 현재 세트 집중 입력 로직

* **목적**: 운동 중 입력 피로도를 줄이고 현재 세트 수행에만 집중하도록 지원.
* **표시 규칙**:
  - 이전 세트 목록 미표시
  - 남은 세트 목록 미표시
  - 현재 세트만 표시
  - 진행도는 `(현재세트/총세트)` 형식 사용
* **조작 규칙**:
  - 중량은 5kg 단위 증감 버튼 제공
  - 반복 수는 1회 단위 증감 버튼 제공
---

## 4. UI/UX 컴포넌트 및 인터랙션 규격

### 4.1 시각적 아이덴티티 (Visual Identity)
* **Corner Radius**: 모든 메인 카드 및 버튼은 rounded-[2.5rem] (40px) 곡률 적용.
* **Shadows**: 프리미엄 입체감을 위해 shadow-2xl 적용, 클릭 시 active:scale-95 피드백.
* **Layout Grid**: 홈 화면 기능 버튼은 grid-cols-2를 사용하여 가로 50:50 대칭 유지.

### 4.2 상태 기반 UI 처리
* **Rest Mode**: 휴식 진입 시 배경을 bg-slate-950으로 변경하고 타이머 시인성 극대화.
* **Reward Feedback**: 포인트 적립 성공 시 상단 FP 대시보드에 animate-bounce 애니메이션 적용.

### 4.3 홈 화면 규격 (Home Screen Rule)
* **상단 헤더**: `오늘의 루틴` + `포인트`
* **루틴 요약 영역**: 루틴명 / 예상 운동시간 / 메인 부위 / 총 세트 수 / 설정 버튼
* **루틴 프리뷰 표**: 운동명, kg, set, rep를 한 화면에서 스캔 가능해야 함
* **하단 CTA**: `내 루틴 시작하기` 버튼은 항상 화면 하단에 고정
* **설정 진입 방식**: 홈 화면의 분할/강도/휴식은 별도 카드가 아니라 설정 버튼으로 진입
### 4.4 운동 화면 규격 (Workout Screen Rule)

* **표시 원칙**: 운동 화면은 현재 운동과 현재 세트 정보만 강조 표시한다.
* **진행도 표시**: `(현재세트/총세트)` 형식으로 표시한다.
* **세트 편집 UI**:
  - 중량 좌/우 버튼: 5kg 단위 감소/증가
  - 반복 좌/우 버튼: 1회 단위 감소/증가
* **운동 전환 UI**: `다른 운동하기` 버튼을 통해 운동 전환 메뉴를 연다.

### 4.5 휴식 화면 규격 (Rest Screen Rule)

* **화면 전환**: DONE 직후 `WORKOUT` 화면이 아닌 `REST` 화면으로 전환한다.
* **상단 영역**: 설정 버튼 배치, 휴식 시간 변경 가능
* **중앙 영역**:
  - 광고 가능 시 광고 UI 노출
  - 광고 미노출 시 남은 휴식 시간 중앙 표시
* **하단 영역**: `휴식 완료하기` 버튼을 크게 고정 배치
