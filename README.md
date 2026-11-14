# 런대시 (rundash) — 프론트 목업

로그인 → 닉네임 정하면 3D 캐릭터 생성 → km당 페이스·거리 설정 → 캐릭터가 코스를 자동으로 달림.
React + Vite + react-three-fiber. 아이콘은 react-icons(Lucide)만 사용, 이모지 금지. 데이터는 아직 `src/lib/api.js` 의 localStorage 목업.

```bash
npm install
npm run dev
```

## 화면 흐름
| 화면 | 파일 |
|---|---|
| 로그인 (이메일 / Google / 카카오 목업) | `src/screens/Login.jsx` |
| 캐릭터 생성 (닉네임·러닝복·피부톤·머리) | `src/screens/CharacterCreate.jsx` |
| 러닝 설정 (페이스 × 거리 = 시간 계산) | `src/screens/RunSetup.jsx` |
| 러닝 (3D + HUD) | `src/screens/RunScreen.jsx`, `src/components/Hud.jsx` |
| 결과 | `src/screens/Result.jsx` |

## 러닝 중 인터랙션 (목업)
- **체력** — 달린 거리만큼 소모(페이스 빠를수록 많이). 60 미만부터 점점 느려지고, 0이면 탈진 → 무릎 꿇고 60초 회복 후 체력 40으로 재출발
- **보급소** — 1km마다(600m, 1600m …). 물(+15)·탄수화물 젤(+25)을 클릭/하단 패널/E 로 챙김. 지나치면 끝
- **메달** — 코스 위에 떠 있는 점수 아이템. 콤보 배율 적용
- 밸런스 값은 `src/lib/stamina.js` 의 `STAMINA` 에서 조절
- **리듬 러닝** — 케이던스 기반 박자에 맞춰 Space. PERFECT/GOOD/MISS, 콤보
- **응원** — 18m 이내 러너에게 C. 상대 머리 위에 응원 아이콘
- **배속** — 목업 확인용 1x / 10x / 30x / 60x
- 1km마다 환경 변경: 공원 → 단풍길 → 도심 → 해변 → 야경

## Supabase 전환 메모 (초안)
```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text unique not null check (char_length(nickname) between 2 and 10),
  color text not null, skin text not null, hair text,
  created_at timestamptz default now()
);

create table runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  target_km numeric not null, distance_km numeric not null,
  pace_sec int not null, elapsed_sec int not null,
  score int default 0, collected int default 0, max_combo int default 0,
  completed boolean default false,
  started_at timestamptz, created_at timestamptz default now()
);
```

**같이 달리기(멀티)**: 페이스가 고정이라 위치를 매 프레임 보낼 필요가 없음.
Realtime Presence 채널(`room:{id}`)에 `{ userId, nickname, color, paceSec, startedAt, pausedMs }` 만 공유하면
각 클라이언트가 `거리 = (now - startedAt - pausedMs) × 속도` 로 다른 사람 위치를 계산 가능.
이벤트(응원, 아이템)만 Broadcast 로 전송.
