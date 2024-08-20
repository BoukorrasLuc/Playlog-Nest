/**
 * This regular expression is used to delete certain elements from the game title.
 * It matches and removes the following patterns: 'nintendo', 'super nintendo', 'Black Label', 'complete', 'complet', '-', 'jeux', 'jeu', 'pal', 'nus', 'ntsc-j', 'japan', 'fah', '[]', 'fra', 'boîte', 'notice', 'Sony', 'Gb', 'Game Boy', 'Pour', 'Xbox', 'n64', 'Ps1', 'Ps2', '64', 'ovp', 'fr', '32x', 'cib', '32 x', '(', ')', ',', 'retrogaming', 'Sega Megadrive', 'Game Cube', 'Playstation', 'tbe', 'euro', 'version', 'neu', 'japon', 'jap', 'limited edition', 'collector', 'deluxe', 'en boite', 'boite', any year from 1980 to 2000, and '/'.
 * 
 * @constant {RegExp} regexDeleteElementOfTitle - The regular expression for deleting certain elements from the game title.
 */
export const regexDeleteElementOfTitle = 
/nintendo|super nintendo|Black Label|(?:complete|complet)|-|jeux|jeu|pal|nus|ntsc-j|japan|fah|\[\]|fra|boîte|notice|Sony|Gb|Game Boy|Pour|Xbox|n64|Ps1|Ps2|64|ovp|fr|32x|cib|32 x|[-(),]|retrogaming|Sega Megadrive|Game Cube|Playstation|tbe|euro|version|neu|japon|jap|limited edition|collector|deluxe|en boite|boite|\b(19[89]\d|2000)\b|\/+/gi;