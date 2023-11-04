/**
 * This function replaces the abbreviations of game conditions with their full forms in a given string.
 * It replaces 'be' with 'bon état' and 'tbe' with 'très bon état'.
 * 
 * @param str - The string in which the replacements are to be made.
 * @returns The string after making the replacements.
 */

export function replaceEtat(str: string): string {
  str = str.replace(/\b(be)\b/g, 'bon état');
  str = str.replace(/\b(tbe)\b/g, 'très bon état');
  return str;
}
