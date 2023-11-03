export function getSpecificText(text) {
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