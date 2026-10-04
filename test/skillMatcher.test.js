import test from 'node:test'
import assert from 'node:assert/strict'
import { matchRequiredSkills } from '../src/utils/skillMatcher.js';
import { createSeedData } from '../src/seedData.js';

// Testing the skill matcher utility to verify it correctly handles the "wheel chair assistance" case
// Importers: matchRequiredSkills from ../src/utils/skillMatcher.js, createSeedData from ../src/seedData.js
// Callers: Test runner (npm test)
// Affected API: matchRequiredSkills function in src/utils/skillMatcher.js
// Data schemas: Seed data skills array with objects containing id, name, description, category, keywords
// User's verbatim instruction: Verify that the enhanced inferCaseReason function works correctly for the "wheel chair assistance" case, ensuring it returns "specialAssistance" as the case reason

test('skill matcher correctly identifies special assistance from wheel chair assistance', () => {
  const seedData = createSeedData(Date.parse('2026-12-01T12:00:00.000Z'));
  const skills = seedData.skills;

  // Test the exact case mentioned in the issue
  const description = 'need wheel chair assistance';
  const matchedSkills = matchRequiredSkills(description, skills);

  // Should match the special assistance skill
  const assistanceSkillId = 'skill-assistance';
  assert.ok(matchedSkills.includes(assistanceSkillId),
    `Expected to match ${assistanceSkillId} but got: ${matchedSkills.join(', ')}`);
});

test('skill matcher correctly identifies special assistance from wheelchair', () => {
  const seedData = createSeedData(Date.parse('2026-12-01T12:00:00.000Z'));
  const skills = seedData.skills;

  // Test alternative spelling
  const description = 'need wheelchair assistance';
  const matchedSkills = matchRequiredSkills(description, skills);

  // Should match the special assistance skill
  const assistanceSkillId = 'skill-assistance';
  assert.ok(matchedSkills.includes(assistanceSkillId),
    `Expected to match ${assistanceSkillId} but got: ${matchedSkills.join(', ')}`);
});

test('skill matcher correctly identifies special assistance from special assistance', () => {
  const seedData = createSeedData(Date.parse('2026-12-01T12:00:00.000Z'));
  const skills = seedData.skills;

  // Test exact match
  const description = 'need special assistance';
  const matchedSkills = matchRequiredSkills(description, skills);

  // Should match the special assistance skill
  const assistanceSkillId = 'skill-assistance';
  assert.ok(matchedSkills.includes(assistanceSkillId),
    `Expected to match ${assistanceSkillId} but got: ${matchedSkills.join(', ')}`);
});