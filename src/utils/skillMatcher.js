//import { PorterStemmer } from 'natural';
import levenshtein from 'fast-levenshtein';
// const fuse = require('fuse.js'); // not used

// Stemmer for plurals/variations
import PorterStemmer from 'natural/lib/natural/stemmers/porter_stemmer.js';
const stemmer = PorterStemmer;

// Example synonym dictionary (expand as needed)
const synonyms = {
  refund: ['refund', 'reimbursement', 'money back', 'credit', 'charge'],
  flight: ['flight', 'booking', 'reservation', 'ticket', 'cancel', 'change'],
  baggage: ['baggage', 'luggage', 'lost bag', 'damaged bag', 'delayed bag'],
  spanish: ['spanish', 'español', 'hablamos']
};

// Regex exact match (ASCII-only boundaries for simplicity) with enhanced whitespace handling
export function regexMatch(text, keyword) {
  // Original approach: handle flexible separators in keyword (e.g., "special assistance" matches "special-assistance")
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexible = escaped.replace(/\s+/g, '[\\s-_]+');
  const pattern1 = `(?:^|[^a-zA-Z0-9])${flexible}(?:$|[^a-zA-Z0-9])`;
  const regex1 = new RegExp(pattern1, 'i');

  // Enhanced approach: handle flexible separators in text for single/multi-word keywords
  // e.g., "wheelchair" matches text containing "wheel chair" or "wheel-chair" as separate words
  // Split text into words and check consecutive sequences
  const textWords = text.split(/\W+/).filter(word => word.length > 0);
  const normKeyword = keyword.replace(/\s+/g, '');

  // Only proceed if keyword is substantial enough to avoid false matches
  if (normKeyword.length >= 3) {
    const maxSeqLength = Math.min(5, textWords.length); // Reasonable limit to avoid excessive computation
    for (let start = 0; start < textWords.length; start++) {
      let concatenated = '';
      for (let end = start; end < Math.min(start + maxSeqLength, textWords.length); end++) {
        concatenated += textWords[end];
        const normConcatenated = concatenated.replace(/\s+/g, '');
        if (normConcatenated === normKeyword) {
          return true;
        }
        // Optimization: if concatenated (without spaces) is already longer than keyword,
        // adding more words will only make it longer
        if (normConcatenated.length > normKeyword.length) {
          break;
        }
      }
    }
  }

  return regex1.test(text);
}

// Stem match (handles plurals/variations)
export function stemMatch(text, keyword) {
  const words = text.split(/\W+/).map(w => stemmer.stem(w.toLowerCase()));
  return words.includes(stemmer.stem(keyword.toLowerCase()));
}

// Fuzzy match (handles typos) - made more conservative to avoid false positives
export function fuzzyMatch(text, keyword, threshold = 2) {
  return text.split(/\W+/).some(word => {
    const wordLen = word.length;
    const keywordLen = keyword.length;
    const lenDiff = Math.abs(wordLen - keywordLen);
    const maxLen = Math.max(wordLen, keywordLen);

    // For very short words, require exact match to avoid false positives
    if (maxLen <= 3) {
      return levenshtein.get(word, keyword) === 0;
    }

    // For words of equal length, be more conservative to avoid matching different words
    if (wordLen === keywordLen) {
      // For short equal-length words, require exact match
      if (maxLen <= 6) {
        return levenshtein.get(word, keyword) === 0;
      }
      // For longer equal-length words, allow small distance
      else {
        return levenshtein.get(word, keyword) <= 1;
      }
    }

    // For words of different lengths, allow more flexibility (likely typos)
    if (lenDiff === 1) {
      return levenshtein.get(word, keyword) <= 1;
    }

    // For longer length differences, use standard threshold
    return levenshtein.get(word, keyword) <= threshold;
  });
}

// Synonym match
export function synonymMatch(text, keyword) {
  const group = synonyms[keyword.toLowerCase()] || [keyword];
  return group.some(k => regexMatch(text, k));
}

// Unified matcher
export function matchRequiredSkills(description, skills) {
  const text = description.toLowerCase();
  return skills.filter(skill =>
    skill.keywords.some(keyword =>
      regexMatch(text, keyword) ||
      stemMatch(text, keyword) ||
      fuzzyMatch(text, keyword) ||
      synonymMatch(text, keyword)
    )
  ).map(skill => skill.id);
}