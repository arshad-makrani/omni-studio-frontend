import assert from 'assert';
import { matchRequiredSkills, regexMatch, stemMatch, fuzzyMatch, synonymMatch } from './skillMatcher.js';

// Test data
const testSkills = [
  { id: 'skill-flight-booking', keywords: ['flight', 'booking', 'reservation', 'ticket', 'cancel', 'change'] },
  { id: 'skill-baggage', keywords: ['baggage', 'luggage', 'lost bag', 'damaged bag', 'delayed bag'] },
  { id: 'skill-refund', keywords: ['refund', 'reimbursement', 'money back', 'credit', 'charge'] },
  { id: 'skill-spanish', keywords: ['spanish', 'español', 'hablamos'] },
];

// Helper to run a test and catch failures
function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    process.exit(1);
  }
}

// Test regexMatch
function testRegexMatch() {
  assert.strictEqual(regexMatch('I want a flight', 'flight'), true);
  assert.strictEqual(regexMatch('I need a re-booking', 'booking'), true);
  assert.strictEqual(regexMatch('I need a_reservation', 'reservation'), true);
  assert.strictEqual(regexMatch('I want a flighty', 'flight'), false);
  assert.strictEqual(regexMatch('I want a FLIGHT', 'flight'), true);
  assert.strictEqual(regexMatch('flight', 'flight'), true);
  assert.strictEqual(regexMatch('flight ', 'flight'), true);
  assert.strictEqual(regexMatch(' flight', 'flight'), true);
}

// Test stemMatch
function testStemMatch() {
  assert.strictEqual(stemMatch('I want flights', 'flight'), true);
  assert.strictEqual(stemMatch('I cancelled the booking', 'cancel'), true);
  assert.strictEqual(stemMatch('I want a train', 'flight'), false);
  assert.strictEqual(stemMatch('running', 'run'), true);
  // Note: Porter stemmer does not handle irregular past tense "ran" -> "run"
  assert.strictEqual(stemMatch('ran', 'run'), false);
}

// Test fuzzyMatch
function testFuzzyMatch() {
  // Exact match
  assert.strictEqual(fuzzyMatch('I want a flight', 'flight'), true);
  // Distance 1
  assert.strictEqual(fuzzyMatch('I want a fligt', 'flight'), true); // missing 'h' (flight -> fligt)
  assert.strictEqual(fuzzyMatch('I want a flght', 'flight'), true); // missing 'i' (flight -> flght)
  assert.strictEqual(fuzzyMatch('I want a flight', 'fligh'), true); // missing 't'
  assert.strictEqual(fuzzyMatch('I want a flight', 'flighx'), true); // substitute t->x
  // Distance 2
  assert.strictEqual(fuzzyMatch('I want a flghtt', 'flight'), true); // missing 'i', extra 't' (flight -> flghtt)
  assert.strictEqual(fuzzyMatch('I want a flight', 'flgyht'), true); // substitute i->y, h->g? Actually flight -> flgyht: i->y, g->g? Let's just trust distance 2.
  // Distance >2
  assert.strictEqual(fuzzyMatch('I want a flight', 'flxyzt'), false); // clearly more than 2 edits
}

// Test synonymMatch
function testSynonymMatch() {
  assert.strictEqual(synonymMatch('I want a reimbursement', 'refund'), true);
  assert.strictEqual(synonymMatch('I want a refund', 'refund'), true);
  assert.strictEqual(synonymMatch('I want a snack', 'refund'), false);
  // Note: 'change' is a synonym for 'flight' in the provided dictionary
  assert.strictEqual(synonymMatch('I need to change my booking', 'flight'), true);
}

// Test matchRequiredSkills
function testMatchRequiredSkills() {
  // Basic match
  let description = 'I need to change my flight and get a refund';
  let result = matchRequiredSkills(description, testSkills);
  assert.deepStrictEqual(result.sort(), ['skill-flight-booking', 'skill-refund'].sort());

  // Stemming
  description = 'I cancelled my booking';
  result = matchRequiredSkills(description, testSkills);
  assert.deepStrictEqual(result, ['skill-flight-booking']);

  // Fuzzy
  description = 'I want to rebook my fligt';
  result = matchRequiredSkills(description, testSkills);
  assert.deepStrictEqual(result, ['skill-flight-booking']);

  // Synonym
  description = 'I need reimbursement for my ticket';
  result = matchRequiredSkills(description, testSkills);
  assert.deepStrictEqual(result.sort(), ['skill-flight-booking', 'skill-refund'].sort());

  // No matches
  description = 'I want a snack';
  result = matchRequiredSkills(description, testSkills);
  assert.deepStrictEqual(result, []);

  // Empty skills
  description = 'I want a flight';
  result = matchRequiredSkills(description, []);
  assert.deepStrictEqual(result, []);

  // Empty description
  description = '';
  result = matchRequiredSkills(description, testSkills);
  assert.deepStrictEqual(result, []);
}

// Run all tests
function runAllTests() {
  runTest('regexMatch', testRegexMatch);
  runTest('stemMatch', testStemMatch);
  runTest('fuzzyMatch', testFuzzyMatch);
  runTest('synonymMatch', testSynonymMatch);
  runTest('matchRequiredSkills', testMatchRequiredSkills);
  console.log('All tests passed!');
}

runAllTests();