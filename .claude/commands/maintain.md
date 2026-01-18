# Maintenance Update

Perform a maintenance update for this project.

## Steps

1. **Update dependencies**
   - Run `npm upgrade` to update all dependencies
   - Run `npm audit fix` if there are vulnerabilities

2. **Update Node.js support**
   - Check the current Node.js LTS versions
   - Update `.github/workflows/build-and-test.yml` matrix to include latest LTS version
   - Remove any EOL Node.js versions from the matrix
   - Update `engines` field in `package.json` if minimum version changed

3. **Fix issues**
   - Run `npm run build` and fix any TypeScript errors
   - Run `npm run dev:postgres` to start the local Postgres instance for tests
   - Run `npm test` and fix any test or linting failures

4. **Clean up ignored files**
   - Review `.gitignore` - ensure build artifacts are excluded
   - Review `.npmignore` - ensure only necessary files are published (use `npm pack --dry-run` to verify)

5. **Version bump**
   - Suggest a version bump based on changes (patch for fixes, minor for new features/updates)
   - Ask the user to confirm or override: "Suggested bump: patch. Confirm or choose: major/minor/patch?"
   - Run `npm version <type> --no-git-tag-version`

6. **Create PR**
   - Create a descriptive branch name (e.g., `maintenance-YYYY-MM`)
   - Commit all changes with a clear message summarizing the updates
   - Push the branch and create a PR with a summary of changes

7. **Merge PR**
   - Ask the user before proceeding: "Ready to merge the PR?"
   - Squash merge the PR into main (use `--admin` flag if branch protection blocks)
   - Keep the commit message clean - do not include co-author lines
   - Checkout main and pull latest

8. **Create release**
   - Ask the user before proceeding: "Ready to create the GitHub release?"
   - Create a GitHub release with tag matching the npm version (e.g., if package.json is `3.1.4`, create release `v3.1.4`)

9. **Publish to npm**
   - Ask the user: "Ready to publish to npm? (requires 2FA)"
   - Run `npm run build && npm publish`
