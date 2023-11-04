/**
 * This function capitalizes the first letter of each word in a given text.
 * @param text - The text to be capitalized.
 * @returns The capitalized text.
 */

export function capitalizeFirstLetterOfEachWord(text: string): string {
  const words = text.split(' ');

  const capitalizedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );

  const result = capitalizedWords.join(' ');

  return result;
}
