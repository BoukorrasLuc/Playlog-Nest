// This regular expression is used to match the condition of the game in the title. 
// It matches the following patterns: 'très bon état', 'tres bon etat', 'tbe', 'be', 'mint', 'cib'.
export const regexCondition =
/(très bon état|tres bon etat|tbe|be|mint|cib)/i;