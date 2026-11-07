/** 받침에 맞는 조사: josa('병원', '을', '를') → '병원을' */
export function josa(word: string, withFinal: string, without: string): string {
  const c = word.charCodeAt(word.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  return word + (has ? withFinal : without);
}
