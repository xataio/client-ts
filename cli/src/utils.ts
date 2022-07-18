export function pluralize(word: string, count: number) {
  return `${word}${count === 1 ? '' : 's'}`;
}
