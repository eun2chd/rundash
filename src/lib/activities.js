export const ACTIVITY_GROUPS = [
  { id: 'relax', label: '휴식', items: [
    ['rest', '쉬기', '잠깐 쉬는 중'], ['loafing', '루팡', '루팡중'],
    ['coffee', '커피', '커피 한 잔 중'], ['nap', '낮잠', '꿈나라 여행중'],
    ['daydream', '멍때리기', '멍때리는 중'], ['music', '음악', '음악 듣는 중'],
    ['meditate', '명상', '마음 비우는 중'],
  ] },
  { id: 'work', label: '업무', items: [
    ['coding', '코딩', '코딩중'], ['design', '디자인', '디자인중'],
    ['work', '일', '열일중'], ['meeting', '회의', '회의중'],
    ['planning', '기획', '기획중'], ['writing', '문서 작성', '문서 쓰는 중'],
    ['debugging', '디버깅', '버그 잡는 중'], ['editing', '영상 편집', '편집중'],
  ] },
  { id: 'learn', label: '공부', items: [
    ['study', '공부', '공부중'], ['reading', '독서', '책 읽는 중'],
    ['lecture', '강의', '강의 듣는 중'], ['language', '외국어', '외국어 공부중'],
    ['exam', '시험 준비', '시험 준비중'], ['homework', '과제', '과제 하는 중'],
    ['research', '자료 조사', '자료 찾는 중'],
  ] },
  { id: 'hobby', label: '취미', items: [
    ['gaming', '게임', '게임중'], ['watching', '영상 보기', '영상 보는 중'],
    ['drawing', '그림', '그림 그리는 중'], ['instrument', '악기', '연주중'],
    ['craft', '만들기', '무언가 만드는 중'], ['journal', '일기', '하루 기록중'],
    ['photo', '사진 정리', '추억 정리중'],
  ] },
  { id: 'daily', label: '일상', items: [
    ['meal', '식사', '밥 먹는 중'], ['cooking', '요리', '요리중'],
    ['cleaning', '청소', '청소중'], ['commute', '이동', '이동중'],
    ['chat', '수다', '수다 떠는 중'], ['pet', '반려동물', '집사 업무중'],
    ['waiting', '기다리기', '기다리는 중'], ['offwork', '퇴근 대기', '퇴근 기다리는 중'],
  ] },
]
export const ACTIVITIES = ACTIVITY_GROUPS.flatMap((group) => group.items.map(([id, label, status]) => ({ id, label, status, group: group.id })))
export const getActivity = (id) => ACTIVITIES.find((activity) => activity.id === id) || ACTIVITIES[0]
