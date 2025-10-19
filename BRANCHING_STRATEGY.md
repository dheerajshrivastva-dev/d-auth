# Branching & Release Strategy

## Branch Structure

```
main (protected)           → Production releases only
  ↓
develop (integration)      → Active development
  ↓
feature/* (features)       → New features
release/* (releases)       → Release preparation
hotfix/* (urgent fixes)    → Critical bug fixes
```

## Workflow

### 1. Feature Development
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/add-oauth-provider

# Work on feature, commit changes
git add .
git commit -m "feat: add OAuth provider support"

# Push and create PR to develop
git push origin feature/add-oauth-provider
```

**PR Labels**: Use `feature`, `enhancement`, `bug`, `docs`, etc.

### 2. Release Process

```bash
# Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v3.1.0

# Update version and changelog
npm version minor  # or patch/major
# Update CHANGELOG.md manually or use standard-version

# Commit changes
git add .
git commit -m "chore: prepare v3.1.0 release"

# Push release branch
git push origin release/v3.1.0
```

**Create PR**: `release/v3.1.0` → `main`

### 3. Finalize Release

Once PR is merged to `main`:

```bash
# Tag the release
git checkout main
git pull origin main
git tag -a v3.1.0 -m "Release v3.1.0"
git push origin v3.1.0

# Merge back to develop
git checkout develop
git merge main
git push origin develop

# Delete release branch
git branch -d release/v3.1.0
git push origin --delete release/v3.1.0
```

**GitHub Actions automatically**:
- Builds the package
- Runs tests
- Publishes to NPM
- Creates GitHub Release with auto-generated notes

### 4. Hotfix (Emergency)

```bash
# Create from main
git checkout main
git checkout -b hotfix/v3.0.1

# Fix bug
git add .
git commit -m "fix: critical security issue"

# Merge to main
git checkout main
git merge --no-ff hotfix/v3.0.1
git tag -a v3.0.1 -m "Hotfix v3.0.1"
git push origin main v3.0.1

# Merge to develop
git checkout develop
git merge --no-ff hotfix/v3.0.1
git push origin develop

# Cleanup
git branch -d hotfix/v3.0.1
```

## Commit Message Convention

Use conventional commits for auto-changelog generation:

```
feat: add new feature
fix: bug fix
docs: documentation changes
chore: maintenance tasks
refactor: code refactoring
test: adding tests
perf: performance improvements
ci: CI/CD changes

BREAKING CHANGE: description (for major version bumps)
```

## Auto-Changelog Setup (Optional)

Install standard-version:
```bash
npm install -D standard-version
```

Add to package.json:
```json
{
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major"
  }
}
```

Usage:
```bash
npm run release  # Auto-bump version + generate changelog
```

## NPM Publishing

### Setup (One-time)

1. Create NPM token at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add to GitHub Secrets: `Settings → Secrets → NPM_TOKEN`

### Automatic Publishing

Pushing tag `v*` to main triggers:
- `.github/workflows/release.yml`
- Runs build & tests
- Publishes to NPM
- Creates GitHub Release

## Branch Protection Rules

### Recommended Settings on GitHub:

**main branch**:
- ✅ Require pull request reviews (1 approver)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

**develop branch**:
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ⬜ Allow force pushes (for rebasing)

## Quick Reference

| Action | Command |
|--------|---------|
| Start feature | `git checkout -b feature/name develop` |
| Start release | `git checkout -b release/vX.Y.Z develop` |
| Start hotfix | `git checkout -b hotfix/vX.Y.Z main` |
| Create tag | `git tag -a vX.Y.Z -m "Release vX.Y.Z"` |
| Push tag | `git push origin vX.Y.Z` |
