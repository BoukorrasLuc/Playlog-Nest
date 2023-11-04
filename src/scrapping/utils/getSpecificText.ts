/**
 * This function extracts a specific portion of a given text. It splits the text into words and iterates over them.
 * If a word is found to be empty (i.e., it is a space or multiple spaces), the function checks if the last word also had more than two spaces.
 * If it did, the function breaks the loop and stops adding words to the result. If it didn't, the function adds the current word to the result.
 * If a word is not empty, it is simply added to the result.
 * The function returns the resulting string, trimmed of any leading or trailing spaces.
 *
 * @param text - The text to be processed.
 * @returns The processed text.
 */

export function getSpecificText(text: string): string {
    const words = text.split(' ');

    let result = '';

    let lastWordHasMoreThanTwoSpaces = false;
    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];

      if (currentWord.trim().length > 0) {
        if (lastWordHasMoreThanTwoSpaces) {
          break;
        } else {
          result += `${currentWord} `;
        }
      } else if (
        currentWord.trim().length === 0 &&
        !lastWordHasMoreThanTwoSpaces
      ) {
        lastWordHasMoreThanTwoSpaces = true;
      }
    }

    return result.trim();
  }