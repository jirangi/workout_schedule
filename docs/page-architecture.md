# Minimal Fit Page Architecture

이 문서는 `app/page.tsx`를 **분리하지 않고 유지하는 전제**에서,  
단일 파일 내부 구조와 상태 흐름, 액션 구조, 렌더링 규칙을 정의한다.

## 목적

- `app/page.tsx`를 하나의 메인 페이지로 유지
- 파일 분리 없이도 유지보수 가능한 내부 구조 확립
- PRD / Design Spec / Architecture와 충돌하지 않는 페이지 설계 기준 정의
- 이후 필요 시 `lib/`, `hooks/`, `components/`로 자연스럽게 확장 가능한 형태 유지

---

# 1. 문서 역할

이 문서는 다음을 정의한다.

- `app/page.tsx` 내부 섹션 구조
- 상태 그룹 분리 원칙
- 액션 함수 책임 분리
- 렌더링 구조
- 저장 상태와 계산 상태 구분
- 단일 파일에서 지켜야 할 구현 규칙

이 문서는 다음 문서와 역할이 다르다.

- `docs/prd.md`: 제품 요구사항
- `docs/designspec.md`: 데이터 구조 및 로직 설계
- `docs/architecture.md`: 전체 폴더 / 모듈 구조
- `docs/page-architecture.md`: `app/page.tsx` 단일 파일 내부 구조

---

# 2. page.tsx의 역할 정의

`app/page.tsx`는 다음 역할만 담당한다.

- 앱의 메인 엔트리 페이지
- 상위 화면 전환 컨트롤러
- 현재 운동 세션 상태 보관
- `data/exercises.ts` 와 `localStorage` 연결
- 사용자 입력을 화면 상태와 영속 상태로 연결

즉, `app/page.tsx`는 **모든 계산을 수행하는 파일**이 아니라  
**상태와 화면을 조정하는 오케스트레이터**로 본다.

---

# 3. page.tsx 내부 고정 섹션 구조

`app/page.tsx`는 반드시 아래 순서를 유지한다.

```tsx
"use client";

// 1. imports
// 2. local types
// 3. constants
// 4. component state
// 5. refs
// 6. persistence effects
// 7. timer effects
// 8. derived values
// 9. routine actions
// 10. set actions
// 11. reward actions
// 12. session actions
// 13. render helpers
// 14. main return
```

예시 구조

```tsx
"use client"

import ...
import ...

type View = ...
interface SelectedRoutine = ...
interface SetLog = ...

const STORAGE_KEY = "MINIMAL_FIT_DATA"
const DEFAULT_REST_SECONDS = 60
const DAILY_REWARD_LIMIT = 2
const REWARD_AMOUNT = 30

export default function Home() {
  // 1) state
  ...

  // 2) refs
  ...

  // 3) effects
  ...

  // 4) derived values
  ...

  // 5) actions
  ...

  // 6) render helpers
  const renderHomeView = () => ...
  const renderWorkoutView = () => ...
  const renderCheckView = () => ...
  const renderFinishView = () => ...

  // 7) main return
  switch (view) {
    case "HOME":
      return renderHomeView()
    case "WORKOUT":
      return renderWorkoutView()
    case "CHECK":
      return renderCheckView()
    case "FINISH":
      return renderFinishView()
    default:
      return null
  }
}
```

---

# 4. 상태 설계 원칙

상태는 반드시 **도메인 기준으로 그룹화**한다.

## A. 앱 뷰 상태

```tsx
const [view, setView] = useState<"HOME" | "WORKOUT" | "CHECK" | "FINISH">("HOME")
```

역할

- 현재 어떤 화면을 보여줄지 결정

---

## B. 사용자 영속 상태

```tsx
const [userPoints, setUserPoints] = useState(0)
const [rewardStatus, setRewardStatus] = useState({ date: "", count: 0 })
const [lastIndices, setLastIndices] = useState<Record<string, number>>({})
```

역할

- 앱 종료 후에도 유지되는 사용자 상태

확장 예정 상태

```tsx
const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([])
const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
const [rewardLedger, setRewardLedger] = useState<RewardLedgerItem[]>([])
```

---

## C. 현재 루틴 상태

```tsx
const [selectedRoutine, setSelectedRoutine] = useState<SelectedRoutine | null>(null)
const [currentExIndex, setCurrentExIndex] = useState(0)
```

역할

- 오늘 진행 중인 루틴
- 현재 몇 번째 운동인지 추적

---

## D. 현재 운동 세션 상태

```tsx
const [sets, setSets] = useState<SetLog[]>([])
const [currentSetIndex, setCurrentSetIndex] = useState(0)
const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null)
const [elapsedTime, setElapsedTime] = useState(0)
```

역할

- 현재 운동 세트
- 현재 세트 위치
- 세션 시간 추적

---

## E. 휴식 / 보조 상태

```tsx
const [isResting, setIsResting] = useState(false)
const [timeLeft, setTimeLeft] = useState(60)
const [isTempoOn, setIsTempoOn] = useState(false)
```

역할

- 휴식 타이머
- 템포 가이드 상태

---

# 5. 저장 상태와 계산 상태 구분

## localStorage에 저장할 상태

- `userPoints`
- `rewardStatus`
- `lastIndices`
- `workoutHistory`
- `personalRecords`
- `rewardLedger`

## 계산으로 만들 상태

- `currentExercise`
- `canEarnReward`
- `isLastSet`
- `isLastExercise`
- `sessionDuration`
- `todayKey`

예시

```tsx
const currentExercise = selectedRoutine?.exercises[currentExIndex] ?? null

const canEarnReward = rewardStatus.count < DAILY_REWARD_LIMIT

const isLastSet = currentSetIndex === sets.length - 1

const isLastExercise =
  !!selectedRoutine && currentExIndex === selectedRoutine.exercises.length - 1
```

원칙

- 저장 가능한 값만 상태로 둔다
- 파생 가능한 값은 `derived value`로 계산한다

---

# 6. 액션 구조 설계

액션은 역할별로 분리한다.

## A. 루틴 액션

```tsx
startRoutine(level: string, splitType: string): void
buildRollingRoutine(level: string, splitType: string): SelectedRoutine
moveToNextExercise(): void
exitRoutine(): void
```

역할

- 루틴 생성
- 루틴 시작
- 다음 운동 이동
- 루틴 종료

---

## B. 세트 액션

```tsx
initializeSets(exercise: ExerciseInfo): void
updateSetValue(index: number, field: "weight" | "reps", value: number): void
completeCurrentSet(): void
duplicateSet(index: number): void
```

역할

- 운동 시작 시 세트 준비
- 세트 수정
- 세트 완료
- 세트 복제

---

## C. 휴식 액션

```tsx
startRest(): void
skipRest(): void
tickRestTimer(): void
resetRest(): void
```

역할

- 휴식 시작
- 휴식 건너뛰기
- 타이머 감소
- 타이머 초기화

---

## D. 리워드 액션

```tsx
canEarnRewardToday(): boolean
earnReward(): void
spendReward(amount: number, reason: string): void
```

역할

- 보상 가능 여부 확인
- FP 적립
- FP 사용

---

## E. 세션 액션

```tsx
finishWorkout(): void
saveWorkoutSession(): void
resetWorkoutState(): void
```

역할

- 운동 종료
- 세션 저장
- 상태 초기화

---

# 7. effect 설계

## Persistence Effect

역할

- 앱 시작 시 localStorage 로드
- 저장 상태 변경 시 localStorage 반영

예시

```tsx
useEffect(() => {
  // storage load
}, [])

useEffect(() => {
  // storage save
}, [userPoints, rewardStatus, lastIndices, workoutHistory, personalRecords, rewardLedger])
```

---

## Timer Effect

역할

- `isResting === true` 일 때 휴식 타이머 감소
- 종료 시 자동 상태 전환

예시

```tsx
useEffect(() => {
  if (!isResting) return

  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer)
        return 0
      }
      return prev - 1
    })
  }, 1000)

  return () => clearInterval(timer)
}, [isResting])
```

---

# 8. 렌더링 구조 설계

렌더링은 반드시 **view helper 함수**로 분리한다.

```tsx
const renderHomeView = () => { ... }
const renderWorkoutView = () => { ... }
const renderCheckView = () => { ... }
const renderFinishView = () => { ... }
```

메인 반환은 switch 기반으로 고정한다.

```tsx
switch (view) {
  case "HOME":
    return renderHomeView()
  case "WORKOUT":
    return renderWorkoutView()
  case "CHECK":
    return renderCheckView()
  case "FINISH":
    return renderFinishView()
  default:
    return null
}
```

원칙

- JSX 내부에 계산 로직을 넣지 않는다
- 화면 전환은 `view` 하나로 제어한다
- 한 화면의 마크업이 커져도 render helper 함수 안에서 유지한다

---

# 9. 각 화면의 책임

## HOME

포함 요소

- 내 루틴 시작하기
- 오늘 루틴 요약
- FP 표시
- 시작 템플릿 선택 진입
- 리워드 샵 진입

목적

- 사용자가 고민 없이 바로 운동을 시작하도록 만든다

---

## WORKOUT

포함 요소

- 현재 운동명
- 세트 입력 UI
- Done 버튼
- 현재 진행 상태
- 템포 on/off
- 루틴 전체 보기 진입

목적

- 최소 입력으로 운동을 기록하게 한다

---

## CHECK

포함 요소

- 오늘 루틴 전체 목록
- 현재 운동 위치 표시

목적

- 사용자가 오늘 해야 할 전체 루틴을 확인하게 한다

---

## REST

포함 요소

- 남은 시간
- 광고 시청 / 보상
- 건너뛰기

목적

- 휴식 흐름 유지
- FP 보상 제공

---

## FINISH

포함 요소

- 총 운동 시간
- 총 볼륨
- PR 여부
- streak
- 홈으로 이동

목적

- 성과를 보여주고 운동 완료 경험을 강화한다

---

# 10. page.tsx 안에서 금지할 것

다음 로직은 JSX 내부에 직접 넣지 않는다.

- Rolling Routine 계산식
- PR 계산식
- 총 볼륨 계산식
- reward 지급 조건
- localStorage 직렬화 로직

원칙

- 계산은 action / helper / derived value 영역에서 처리
- JSX는 표시와 이벤트 연결만 담당

---

# 11. 단일 파일 유지 기준

`app/page.tsx`는 아래 조건에서는 **분리하지 않고 유지 가능**하다.

- 화면 수가 현재 범위 안에 있음
- 계산 로직이 helper 함수 수준으로 제어 가능
- 상태가 도메인별로 명확히 그룹화됨
- 렌더링이 view helper 함수로 분리됨

반대로 아래 상황이면 분리 검토

- `renderXxxView` 함수가 과도하게 비대해짐
- 상태 종류가 급격히 증가
- action 함수가 너무 많아짐
- PRD 확장 범위가 page 단일 파일 한계를 넘김

---

# 12. page.tsx 상단에 둘 개발 규칙

`app/page.tsx` 작업 시 아래 순서를 따른다.

1. `docs/prd.md` 확인
2. `docs/designspec.md` 확인
3. `docs/architecture.md` 확인
4. `docs/page-architecture.md` 확인
5. 코드 수정
6. REQ 충족 여부 역분석
7. 문서 수정 필요 여부 확인

---

# 13. 관련 문서 참조 규칙

- 전체 폴더 구조 / 모듈 구조 → `docs/architecture.md`
- 단일 파일 `page.tsx` 내부 구조 → `docs/page-architecture.md`
- 요구사항 기준 → `docs/prd.md`
- 데이터 구조 / 저장 구조 / 알고리즘 기준 → `docs/designspec.md`

---

# 14. 최종 원칙

`app/page.tsx`는 지금 단계에서 **쪼개지지 않아도 된다.**

대신 아래 네 가지를 반드시 지킨다.

1. 상태를 도메인별로 그룹화한다
2. 렌더링을 view helper 함수로 분리한다
3. 계산 로직을 JSX 밖으로 뺀다
4. 저장 상태와 계산 상태를 구분한다

핵심 문장

**한 파일로 유지하되, 내부 구조는 다중 모듈처럼 설계한다**
