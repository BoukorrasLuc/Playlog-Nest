export function replaceEtat(str) {
  str = str.replace(/\b(be)\b/g, 'bon état');
  str = str.replace(/\b(tbe)\b/g, 'très bon état');
  return str;
}
