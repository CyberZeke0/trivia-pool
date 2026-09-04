Perform a comprehensive audit of this codebase.

Your goal is to identify bugs, potential issues, inconsistencies, technical debt, security concerns, performance problems, and areas where the implementation does not follow best practices.

Audit the codebase across the following areas:

1. Code Quality & Maintainability
   - Identify duplicated, dead, unused, or overly complex code.
   - Look for poor naming, unclear abstractions, and inconsistent patterns.
   - Identify violations of DRY, SOLID, and separation of concerns where relevant.
   - Flag functions, classes, or modules that are doing too much.
   - Check for inconsistent error handling and logging.

2. Bugs & Logic Issues
   - Look for potential runtime errors, edge cases, race conditions, null/undefined issues, incorrect conditions, and broken assumptions.
   - Trace important flows end-to-end and identify places where data may be lost, corrupted, or handled incorrectly.
   - Check API validation, state transitions, and failure scenarios.

3. Security
   - Check for exposed secrets, insecure environment variable usage, authentication or authorization issues, insecure API endpoints, injection vulnerabilities, improper input validation, and sensitive data exposure.
   - Identify dependencies or patterns that may introduce security risks.

4. Performance & Scalability
   - Identify unnecessary database queries, N+1 query problems, inefficient loops, excessive API calls, memory leaks, blocking operations, and other performance bottlenecks.
   - Review database access patterns and opportunities for optimization.

5. Architecture & Project Structure
   - Review the overall structure and organization of the codebase.
   - Identify tightly coupled modules, circular dependencies, misplaced responsibilities, and architectural inconsistencies.
   - Check whether existing patterns are being followed consistently.

6. Type Safety & Validation
   - Identify unsafe type assertions, excessive use of `any`, missing validation, weak type definitions, and places where runtime validation is needed.
   - Ensure external inputs are properly validated.

7. Testing & Reliability
   - Review existing tests and identify critical areas with missing coverage.
   - Identify fragile tests or code that is difficult to test.
   - Suggest high-priority test cases for important business logic.

Important instructions:
- Do not make changes to the codebase unless explicitly asked.
- Do not guess. Base every finding on actual code.
- Inspect the relevant files and trace dependencies before reporting an issue.
- Avoid reporting minor stylistic preferences as critical issues.
- Prioritize findings based on real-world impact.
- For each issue, provide:
  - Severity: Critical / High / Medium / Low
  - Category
  - File path and relevant line(s)
  - Clear description of the issue
  - Why it is a problem
  - Potential impact
  - Recommended fix

At the end, provide:

1. An executive summary of the overall codebase health.
2. A prioritized list of the top 10 issues to address first.
3. A list of quick wins that can be fixed with minimal effort.
4. A list of larger architectural or technical debt improvements.
5. Any areas that were reviewed but had no significant issues.

Be thorough, but avoid noise. Focus on actionable findings that are supported by the actual implementation.
Pay particular attention to API design, authentication and authorization, database queries and transactions, concurrency, error handling, background jobs, caching, environment configuration, migrations, data integrity, and failure recovery.