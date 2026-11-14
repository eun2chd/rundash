# Run dash -

React + Vite + React Three Fiber. Pretendard 기반 크림/올리브 디자인.
이메일 로그인/회원가입 및 Supabase 익명 인증을 사용하며, 프로필과 러닝 기록은 실제 DB에 저장합니다.

## Supabase 설정

1. 프로젝트 `yjlebedgsktdxacpasgt`의 SQL Editor에서 `supabase/migrations/202611140001_initial.sql`을 실행합니다. 신규 테이블 기준이며 기존 테이블이 있으면 스키마를 먼저 비교하세요.
2. Authentication → Sign In / Providers에서 이메일과 Anonymous Sign-Ins를 활성화합니다.
3. URL Configuration의 Site URL에 운영 Vercel URL을, Redirect URLs에 운영 URL과 `http://localhost:5173`을 등록합니다.
4. `.env.example`을 `.env.local`로 복사해 Publishable key를 채웁니다. 현재 로컬에는 전달받은 공개 키를 설정했습니다.
5. `npm install`, `npm run dev`를 실행합니다.

브라우저에서는 Publishable key와 RLS를 사용합니다. DATABASE_URL, DB 비밀번호, service_role 키를 VITE_ 환경변수에 넣지 마세요.
익명 사용자도 authenticated 역할로 자신의 데이터만 접근합니다. 로그아웃/브라우저 데이터 삭제 후 익명 계정은 복구할 수 없습니다.
닉네임은 대소문자 구분 없이 고유하며 가용성 RPC는 다른 프로필 정보를 공개하지 않습니다.
러닝 결과의 모든 통계를 runs.details에 저장합니다. 점수는 클라이언트 계산값으로 경쟁용 검증은 별도 서버 구현이 필요합니다.
현재 코스의 다른 러너는 기존 시뮬레이션이며 실제 멀티플레이 연결은 별도입니다.

## Vercel 배포

Git 저장소를 Vercel에서 Import하고 Framework를 Vite로 선택합니다. vercel.json에 빌드 설정이 있습니다.
Environment Variables에 아래 두 값을 Production/Preview별로 등록하고 배포합니다.

- VITE_SUPABASE_URL: https://yjlebedgsktdxacpasgt.supabase.co
- VITE_SUPABASE_PUBLISHABLE_KEY: Supabase의 Publishable key

환경변수를 변경한 경우 재배포해야 합니다. `.env.local`은 Git에서 제외됩니다.

## 확인 순서

- 이메일 가입 → 이메일 인증 → 로그인 → 캐릭터 생성 → 새로고침 후 유지
- 익명 시작 → 캐릭터 생성 → 러닝 종료 → runs 저장 확인
- 계정 A/B 각각 로그인 후 상대 profiles/runs가 조회되지 않고 상대 ID 쓰기가 거부되는지 확인
- 로그아웃한 클라이언트의 테이블 접근이 거부되는지 확인
- 저장 실패 시 다시 저장 버튼으로 기록 재시도

`npm run build`로 프로덕션 빌드를 확인합니다.
