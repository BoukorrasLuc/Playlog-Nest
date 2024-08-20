/**
 * This regular expression is used to match the completeness of the game in the title.
 * It matches the following patterns: 'complet', 'loose', 'hs'.
 * 
 * @constant {RegExp} regexCompleteness - The regular expression for matching game completeness.
 */
export const regexCompleteness = /(complet|loose|hs)/i;