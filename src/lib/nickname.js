const ADJECTIVES = ['신나는', '빛나는', '씩씩한', '즐거운', '용감한', '힘찬', '날쌘', '멋진']
const ANIMALS = ['토끼', '수달', '다람쥐', '여우', '사슴', '판다', '펭귄', '고양이']

export function randomNickname() {
  const values = crypto.getRandomValues(new Uint32Array(3))
  return `${ADJECTIVES[values[0] % ADJECTIVES.length]}${ANIMALS[values[1] % ANIMALS.length]}${String(values[2] % 10000).padStart(4, '0')}`
}
