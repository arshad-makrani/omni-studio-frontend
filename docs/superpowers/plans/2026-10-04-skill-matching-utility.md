# Skill Matching Utility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a utility function that matches required skills from a job description against a list of skills using regex, stemming, fuzzy matching, and synonyms.

**Architecture:** Create a standalone utility module in `src/utils/skillMatcher.js` that exports a single function `matchRequiredSkills`. The function will use the `natural` Porter stemmer, `fast-levenshtein` for fuzzy matching, and a predefined synonym dictionary. Each skill is expected to have an `id` and a `keywords` array.

**Tech Stack:** JavaScript (ES6), natural, fast-levenshtein, Node.js test runner.

**Spec:** None (direct implementation from user-provided code snippet).

## Global Constraints

- The utility must be written in ES6 module syntax compatible with Vite.
- Dependencies: `natural`, `fast-levenshtein` (and optionally `fuse.js` though not used).
- The function must be exported and usable in other modules.
- No modifications to existing files are required; only new files will be added.

## Review Focus

- Ensure the utility handles edge cases: empty description, empty skills list, special characters in keywords.
- Ensure stemming works for plurals and variations.
- Ensure fuzzy matching works within a threshold of 2.
- Ensure synonym matching works as defined.
- Ensure regex matching respects word boundaries and allows flexible separators (spaces, hyphens, underscores).

---
### Task 1: Set up dependencies and create utils directory

**Files:**
- Create: `docs/superpowers/plans/2026-10-04-skill-matching-utility.md`
- Modify: `package.json` (to add dependencies)
- Create: `src/utils/skillMatcher.js`
- Create: `src/utils/skillMatcher.test.js`

**Interfaces:**
- Consumes: None
- Produces: The skillMatcher module and its test file.

- [ ] **Step 1: Install dependencies**
Run: `npm install natural fast-levenshtein`
Expected: Dependencies installed and added to package.json.

- [ ] **Step 2: Create utils directory**
Run: `mkdir -p src/utils`
Expected: Directory `src/utils` created.

- [ ] **Step 3: Create skillMatcher.js with skeleton**
Write the following to `src/utils/skillMatcher.js`:
```javascript
// TODO: Implement skill matcher
```
Expected: File created with placeholder.

- [ ] **Step 4: Commit**
```bash
git add package.json
git commit -m "chore: add natural and fast-levenshtein dependencies"
```

### Task 2: Implement skill matcher functions

**Files:**
- Modify: `src/utils/skillMatcher.js`

**Interfaces:**
- Consumes: None
- Produces: Fully implemented skill matcher.

- [ ] **Step 1: Write failing test for regexMatch**
Create test file `src/utils/skillMatcher.test.js` with a test that expects regexMatch to be defined and to match correctly.
Run: `node --test src/utils/skillMatcher.test.js`
Expected: FAIL with "regexMatch is not defined" or similar.

- [ ] **Step 2: Implement regexMatch, stemMatch, fuzzyMatch, synonymMatch, and matchRequiredSkills**
Replace the content of `src/utils/skillMatcher.js` with the full implementation.

- [ ] **Step 3: Run test to verify it passes**
Run: `node --test src/utils/skillMatcher.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add src/utils/skillMatcher.js src/utils/skillMatcher.test.js
git commit -m "feat: implement skill matcher utility"
```

### Task 3: Write comprehensive unit tests

**Files:**
- Modify: `src/utils/skillMatcher.test.js`

**Interfaces:**
- Consumes: The skillMatcher module.
- Produces: Test suite covering all matching strategies.

- [ ] **Step 1: Write failing tests for each matching strategy**
Add tests for regexMatch, stemMatch, fuzzyMatch, synonymMatch, and the main function.
Run: `node --test src/utils/skillMatcher.test.js`
Expected: Some tests fail.

- [ ] **Step 2: Implement tests to pass**
Ensure all tests pass by verifying the implementation.

- [ ] **Step 3: Run full test suite**
Run: `node --test`
Expected: All tests pass.

- [ ] **Step 4: Commit**
```bash
git add src/utils/skillMatcher.test.js
git commit -m "feat: add comprehensive tests for skill matcher"
```

### Task 4: Final verification and cleanup

**Files:**
- Modify: None (if all good)

**Interfaces:**
- Consumes: None
- Produces: Verified utility.

- [ ] **Step 1: Run linter to ensure no issues**
Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 2: Run test suite one more time**
Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**
```bash
git commit -am "final: verify skill matcher implementation"
```