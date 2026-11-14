// Never show raw PostgREST, SQL, network, or implementation errors to players.
const FRIENDLY_ERRORS = [
  '정식 계정으로 이용해 주세요.', '닉네임을 2~10자로 입력해 주세요.',
  '초대할 수 없는 러너예요.', '이미 동행 중이에요.', '잠시 후 다시 초대해 주세요.',
  '이미 초대를 보냈어요.', '초대를 찾을 수 없어요.', '이미 처리된 초대예요.',
  '상대방만 초대를 수락할 수 있어요.', '상대가 연결을 종료했거나 초대를 껐어요.',
  '두 러너가 러닝 화면에 접속해 있고 상대가 초대를 허용해야 해요.',
  '이용이 제한된 계정이에요. 문의하기로 연락해 주세요.',
]
export function socialErrorMessage(error) {
  return FRIENDLY_ERRORS.includes(error?.message) ? error.message : '지금은 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}
