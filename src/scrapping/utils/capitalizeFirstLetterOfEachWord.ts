export function capitalizeFirstLetterOfEachWord(text) {
  const words = text.split(' ');

  const capitalizedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );

  const result = capitalizedWords.join(' ');

  return result;
}
