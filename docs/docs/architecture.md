# Minimal Fit Architecture

이 문서는 Minimal Fit 프로젝트의 코드 구조, 데이터 흐름, 상태 관리 방식, 모듈 분리를 정의한다.

## 목적

- 실제 코딩 시작 전 아키텍처 기준 확정
- 단일 파일 구조에서 확장 가능한 구조로 전환
- PRD / Design Spec / Roadmap과 코드 구조를 연결
- 기능 추가 시 파일 생성 우선순위 명확화

---

# 1. 아키텍처 원칙

Minimal Fit은 다음 원칙을 따른다.

1. PRD 중심 개발
2. Design Spec 기반 구현
3. MVP 우선
4. 단순한 구조 우선
5. 로컬 저장 기반 우선
6. 빠른 UX 우선

핵심 UX

- 고민 없는 시작
- 빠른 세트 기록
- 운동 지속 동기

---

# 2. 현재 구조 평가

현재 구조는 다음과 같은 초기 MVP 형태로 볼 수 있다.

- `app/page.tsx` 에 메인 화면 및 핵심 로직 집중
- `data/exercises.ts` 에 운동 메타데이터 저장
- `localStorage` 기반 사용자 상태 저장
- 단일 페이지 기반 흐름 제어

이 구조는 MVP 검증에는 빠르지만, 기능이 늘어날수록 다음 문제가 발생한다.

- 화면 로직과 도메인 로직 혼합
- 세트 기록 / 루틴 생성 / 보상 / 통계 로직 분리 부족
- 재사용 어려움
- 테스트 어려움
- REQ-04 ~ REQ-10 확장 시 유지보수 비용 증가

따라서 Minimal Fit은 **점진적 분리 구조**를 채택한다.

---

# 3. 목표 아키텍처

목표는 다음과 같다.

- 화면은 `app/`
- 데이터는 `data/`
- 타입은 `types/`
- 핵심 로직은 `lib/`
- 상태 제어는 `hooks/`
- 재사용 UI는 `components/`

---

# 4. 권장 폴더 구조

```text
app/
  globals.css
  layout.tsx
  page.tsx

components/
  home/
    start-workout-card.tsx
    today-routine-card.tsx
    fp-dashboard.tsx
  workout/
    workout-header.tsx
    exercise-card.tsx
    set-row.tsx
    set-editor.tsx
    workout-footer.tsx
  rest/
    rest-timer-card.tsx
    reward-card.tsx
  finish/
    workout-summary.tsx
    pr-badge.tsx
    streak-card.tsx
  calendar/
    workout-calendar.tsx
    weekly-summary.tsx
  common/
    primary-button.tsx
    section-card.tsx
    modal.tsx

data/
  exercises.ts
  starter-templates.ts
  reward-catalog.ts

types/
  exercise.ts
  persistence.ts
  routine.ts
  workout-session.ts
  analytics.ts
  reward.ts

lib/
  storage.ts
  rolling-routine.ts
  set-sync.ts
  reward-policy.ts
  timer.ts
  analytics.ts
  templates.ts
  date.ts

hooks/
  use-persistence.ts
  use-rolling-routine.ts
  use-workout-session.ts
  use-rest-timer.ts
  use-reward.ts
  use-analytics.ts

docs/
  prd.md
  designspec.md
  roadmap.md
  development-rules.md
  feature-map.md
  market-analysis.md
  architecture.md
```

---

# 5. 폴더별 역할

## app/

Next.js 라우팅 및 페이지 진입점

역할

- 페이지 렌더링
- 화면 조합
- 상위 상태 연결
- view 전환

원칙

- 도메인 계산 로직은 넣지 않는다
- `lib/`, `hooks/` 를 사용해 조합만 한다

---

## components/

재사용 UI 컴포넌트

역할

- 화면 블록 분리
- UI 단위 재사용
- 프레젠테이션 전용 컴포넌트 구성

원칙

- 계산보다 표시 중심
- props 기반 구성
- 비즈니스 로직 최소화

---

## data/

정적 데이터

역할

- 운동 메타데이터
- 시작 템플릿 기본 데이터
- FP 사용처 목록

원칙

- 정적 데이터만 둔다
- 사용자 상태는 넣지 않는다

---

## types/

TypeScript 타입 정의

역할

- 도메인 모델 표준화
- 화면/로직 간 타입 일관성 유지

---

## lib/

핵심 비즈니스 로직

역할

- Rolling Routine 계산
- 세트 자동 동기화
- FP 적립/차감 규칙
- PR / 볼륨 / 연속성 계산
- 날짜 처리
- LocalStorage 읽기/쓰기 래핑

원칙

- React 의존 최소화
- 순수 함수 우선
- 테스트 가능한 구조 우선

---

## hooks/

상태와 흐름 관리

역할

- 세션 상태 관리
- 휴식 타이머 상태 관리
- 사용자 데이터 동기화
- 분석 계산 연결

원칙

- React 상태 orchestration 담당
- 계산 자체는 `lib/` 사용
- 페이지가 비대해지지 않도록 분리

---

# 6. 핵심 타입 구조

## ExerciseInfo

```ts
export interface ExerciseInfo {
  id: string
  category: string
  subTarget: string
  name: string
  equipment: string
  defaultWeight: number
  defaultReps: number
}
```

## UserPersistence

```ts
export interface UserPersistence {
  userPoints: number
  rewardStatus: {
    date: string
    count: number
  }
  lastIndices: Record<string, number>
  workoutHistory?: WorkoutSession[]
  rewardLedger?: RewardLedgerItem[]
  personalRecords?: PersonalRecord[]
}
```

## SetLog

```ts
export interface SetLog {
  id: number
  weight: number
  reps: number
  isEdited: boolean
  isDone: boolean
  completedAt?: string
}
```

## WorkoutExercise

```ts
export interface WorkoutExercise {
  exerciseId: string
  name: string
  category: string
  subTarget: string
  equipment: string
  sets: SetLog[]
}
```

## WorkoutSession

```ts
export interface WorkoutSession {
  id: string
  startedAt: string
  finishedAt?: string
  routineName: string
  exercises: WorkoutExercise[]
  totalVolume: number
  durationSeconds: number
}
```

## PersonalRecord

```ts
export interface PersonalRecord {
  exerciseId: string
  maxWeight: number
  maxReps: number
  estimatedVolume: number
  updatedAt: string
}
```

## RewardLedgerItem

```ts
export interface RewardLedgerItem {
  id: string
  type: "earn" | "spend"
  amount: number
  reason: string
  createdAt: string
}
```

## RoutineTemplate

```ts
export interface RoutineTemplate {
  id: string
  name: string
  categories: string[]
}
```

## WeeklySummary

```ts
export interface WeeklySummary {
  totalVolume: number
  totalSessions: number
  streak: number
}
```

---

# 7. 핵심 로직 모듈

## lib/storage.ts

역할

- persistence 로드
- persistence 저장
- 기본값 보정
- 날짜 변경 시 rewardStatus 초기화

예상 함수

```ts
loadPersistence(): UserPersistence
savePersistence(data: UserPersistence): void
getTodayKey(): string
normalizePersistence(data: Partial<UserPersistence>): UserPersistence
```

## lib/rolling-routine.ts

역할

- 다음 운동 선택
- 루틴 자동 생성
- 마지막 운동 인덱스 순환 처리

예상 함수

```ts
generateRollingRoutine(params: {
  template?: RoutineTemplate
  lastIndices: Record<string, number>
}): WorkoutExercise[]

getNextExerciseIndex(lastIndex: number, length: number): number
```

## lib/set-sync.ts

역할

- 세트 자동 동기화
- 세트 복제
- 세트 완료 처리

예상 함수

```ts
syncFollowingSets(
  sets: SetLog[],
  index: number,
  field: "weight" | "reps",
  value: number
): SetLog[]

duplicateSet(sets: SetLog[], index: number): SetLog[]
completeSet(sets: SetLog[], index: number): SetLog[]
```

## lib/reward-policy.ts

역할

- FP 적립
- FP 사용
- 하루 보상 제한
- Reward Ledger 기록

예상 함수

```ts
canEarnReward(
  rewardStatus: UserPersistence["rewardStatus"],
  today: string
): boolean

earnReward(data: UserPersistence, amount: number): UserPersistence
spendReward(data: UserPersistence, amount: number, reason: string): UserPersistence
```

## lib/timer.ts

역할

- 휴식 타이머
- 자동 시작 / 건너뛰기

예상 함수

```ts
getDefaultRestSeconds(): number
tick(seconds: number): number
isTimerFinished(seconds: number): boolean
```

## lib/analytics.ts

역할

- 볼륨 계산
- PR 계산
- 연속 운동일 계산
- 주간 요약 계산

예상 함수

```ts
calculateSessionVolume(session: WorkoutSession): number

detectPersonalRecords(
  session: WorkoutSession,
  previousPRs: PersonalRecord[]
): PersonalRecord[]

calculateStreak(history: WorkoutSession[]): number

buildWeeklySummary(history: WorkoutSession[]): WeeklySummary
```

## lib/templates.ts

역할

- 시작 템플릿 생성
- 숙련도 / 장비 / 목표 기반 분기

예상 함수

```ts
getStarterTemplate(
  level: string,
  equipment: string,
  goal: string
): RoutineTemplate
```

---

# 8. Hook 설계

## use-persistence.ts

역할

- persistence 상태 로드
- persistence 업데이트
- localStorage 저장 연결

반환 예시

```ts
{
  persistence,
  setPersistence,
  save,
  reload
}
```

## use-rolling-routine.ts

역할

- 루틴 생성
- 시작 템플릿과 Rolling Routine 연결

반환 예시

```ts
{
  selectedRoutine,
  generateRoutine,
  clearRoutine
}
```

## use-workout-session.ts

역할

- 현재 운동 상태 관리
- 현재 운동 / 현재 세트 / 완료 상태 제어

반환 예시

```ts
{
  session,
  currentExercise,
  currentSetIndex,
  updateSet,
  completeSet,
  goNextExercise,
  finishSession
}
```

## use-rest-timer.ts

역할

- 휴식 타이머 관리
- 시작 / 종료 / skip 처리

반환 예시

```ts
{
  isResting,
  timeLeft,
  startRest,
  skipRest,
  resetRest
}
```

## use-reward.ts

역할

- FP 적립 / 차감
- 사용 가능 여부 판정

반환 예시

```ts
{
  userPoints,
  canEarn,
  earn,
  spend
}
```

## use-analytics.ts

역할

- 결과 통계 계산
- 세션 요약 / PR / streak 생성

반환 예시

```ts
{
  summary,
  personalRecords,
  streak,
  weeklySummary
}
```

---

# 9. 화면 단위 구성

## Home

- StartWorkoutCard
- TodayRoutineCard
- FPDashboard

목적

- 앱 진입 후 즉시 운동 시작

## Workout Session

- WorkoutHeader
- ExerciseCard
- SetEditor
- WorkoutFooter

목적

- 최소 입력 운동 기록

## Rest

- RestTimerCard
- RewardCard

목적

- 휴식 흐름 제어
- FP 보상 제공

## Finish

- WorkoutSummary
- PRBadge
- StreakCard

목적

- 결과 요약
- 성취감 제공

## Calendar

- WorkoutCalendar
- WeeklySummary

목적

- 달력 및 주간 기록 확인

---

# 10. 데이터 흐름

## 앱 시작

1. `storage.ts` 로 persistence 로드
2. `normalizePersistence()` 실행
3. Home 화면 렌더링

## 루틴 시작

1. Start Workout 클릭
2. Rolling Routine 생성
3. Workout Session 시작

## 세트 기록

1. 중량 / 반복 입력
2. `set-sync.ts` 로 자동 세트 동기화
3. 세트 완료 처리
4. 휴식 타이머 시작

## 휴식 보상

1. 보상 요청
2. `reward-policy.ts` 에서 가능 여부 판단
3. FP 적립 후 persistence 저장

## 세션 종료

1. `analytics.ts` 계산
2. WorkoutSession 저장
3. 결과 화면 표시

---

# 11. 개발 순서

## Step 1

```text
types/exercise.ts
types/persistence.ts
lib/storage.ts
lib/rolling-routine.ts
```

## Step 2

```text
types/workout-session.ts
lib/set-sync.ts
hooks/use-workout-session.ts
components/workout/set-editor.tsx
```

## Step 3

```text
lib/reward-policy.ts
lib/timer.ts
hooks/use-rest-timer.ts
hooks/use-reward.ts
components/rest/rest-timer-card.tsx
```

## Step 4

```text
types/analytics.ts
lib/analytics.ts
hooks/use-analytics.ts
components/finish/workout-summary.tsx
components/finish/pr-badge.tsx
```

## Step 5

```text
types/routine.ts
data/starter-templates.ts
lib/templates.ts
data/reward-catalog.ts
components/calendar/workout-calendar.tsx
```

---

# 12. 컴포넌트 분리 기준

다음 조건이면 분리한다.

- 두 번 이상 재사용
- UI 코드가 길어짐
- 조건문이 많아짐
- props 로 의미가 명확히 분리됨

다음은 분리하지 않아도 된다.

- 단일 화면 전용 짧은 마크업
- 아직 구조 검증 전 MVP 코드

---

# 13. 상태 관리 기준

우선순위

1. local state
2. custom hooks
3. localStorage
4. 전역 상태는 필요 시 이후 검토

원칙

- 초기에는 전역 상태 라이브러리 사용하지 않음
- MVP 범위에서는 구조 단순성 우선
- 디버깅이 쉬운 흐름 유지

---

# 14. 테스트 기준

우선 테스트 대상

- Rolling Routine 계산
- 세트 자동 동기화
- FP 적립 제한
- PR 계산
- 연속 운동일 계산

원칙

- UI보다 `lib/` 순수 함수 우선 테스트

---

# 15. 문서 동기화 기준

## PRD 업데이트

- REQ 변경
- UX 변경
- 기능 범위 변경

## Design Spec 업데이트

- 타입 변경
- 데이터 구조 변경
- 알고리즘 변경
- 저장 구조 변경

## Roadmap 업데이트

- 개발 순서 변경
- MVP 범위 변경

---

# 16. 최종 아키텍처 방향

1. 빠른 MVP 구현
2. 핵심 로직을 `lib/` 로 분리
3. 상태는 `hooks/` 로 관리
4. UI 는 `components/` 로 분리
5. 확장 기능은 타입과 데이터 구조부터 먼저 정리

핵심 문장

**빠르게 만들되 무너지지 않게 설계한다**
