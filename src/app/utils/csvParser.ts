export interface Review {
  username: string;
  stars: number;
  time: string;
  text: string;
  images: string[];
}

/**
 * Parses raw CSV content into a 2D array of strings.
 * Handles double-quoted cells, escaped double quotes (""), and cells containing internal newlines.
 */
export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" inside quotes becomes "
          cell += '"';
          i++; // Skip the second quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n' || char === '\r') {
        row.push(cell);
        cell = '';
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          result.push(row);
        }
        row = [];
        // Skip subsequent \n if it's \r\n
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        cell += char;
      }
    }
  }

  // Handle trailing elements
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    result.push(row);
  }

  return result;
}

/**
 * Parses raw CSV string and converts it into a list of Review objects,
 * mapping headers "Username,Stars,Time,Text,Images" to the correct properties.
 */
export function parseReviews(csvText: string): Review[] {
  if (!csvText || csvText.trim() === '') return [];

  const rawRows = parseCSV(csvText);
  if (rawRows.length <= 1) return []; // Header only or empty

  // Confirm columns from header: Username,Stars,Time,Text,Images
  const header = rawRows[0].map(h => h.trim().toLowerCase());
  const usernameIdx = header.indexOf('username');
  const starsIdx = header.indexOf('stars');
  const timeIdx = header.indexOf('time');
  const textIdx = header.indexOf('text');
  const imagesIdx = header.indexOf('images');

  const reviews: Review[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    // Skip empty lines or malformed rows (at least need Username or Text)
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

    const username = row[usernameIdx] || 'Anonymous';
    const stars = parseInt(row[starsIdx] || '5', 10) || 5;
    const time = row[timeIdx] || '';
    const text = row[textIdx] || '';
    
    let images: string[] = [];
    if (imagesIdx !== -1 && row[imagesIdx]) {
      images = row[imagesIdx]
        .split(',')
        .map(url => url.trim())
        .filter(url => url !== '');
    }

    reviews.push({
      username,
      stars,
      time,
      text,
      images,
    });
  }

  return reviews;
}
