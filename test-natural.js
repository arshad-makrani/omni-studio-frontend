import natural from 'natural';
console.log('natural:', typeof natural);
console.log('natural.PorterStemmer:', typeof natural.PorterStemmer);
console.log('natural.PorterStemmer.stem:', typeof natural.PorterStemmer.stem);

const stemmer = natural.PorterStemmer;
console.log('stemmer:', typeof stemmer);
console.log('stemmer.stem:', typeof stemmer.stem);

try {
  const result = stemmer.stem('testing');
  console.log('stem result:', result);
} catch (e) {
  console.error('Error calling stem:', e);
}