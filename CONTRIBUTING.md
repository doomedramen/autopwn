# Contributing to AutoPWN

Thank you for considering contributing to AutoPWN! We welcome contributions from the community.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Environment details** (OS, Node version, Docker version, GPU type)
- **Logs** from `docker logs` or console output
- **Screenshots** if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Use case** - why this would be useful
- **Proposed solution** or implementation approach
- **Alternative solutions** you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the existing code style**:
   - TypeScript for all new code
   - ESM modules (not CommonJS)
   - Functional components for React
   - Tailwind CSS for styling
3. **Test your changes**:
   - Test locally with `npm run dev:worker` and `npm run dev:web`
   - Test Docker build with `docker-compose build`
   - Ensure existing functionality still works
4. **Write clear commit messages**:
   - Use present tense ("Add feature" not "Added feature")
   - First line: brief summary (50 chars or less)
   - Detailed description if needed
5. **Update documentation** if you change functionality
6. **Submit the pull request**

## Development Setup

### Prerequisites

- Node.js 24.x
- npm or pnpm
- Docker and Docker Compose (for full stack testing)
- hashcat and hcxpcapngtool (for local testing)

### Local Development

```bash
# Clone your fork
git clone https://github.com/DoomedRamen/autopwn.git
cd autopwn

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Create required directories
mkdir -p volumes/{input,intermediate,completed,failed,hashes,db,dictionaries}

# Run worker (in one terminal)
npm run dev:worker

# Run web dashboard (in another terminal)
npm run dev:web
```

### Project Structure

```
autopwn/
├── packages/
│   ├── shared/          # Shared TypeScript types and schemas
│   ├── worker/          # File watcher and hashcat processor
│   └── web/             # Next.js dashboard
└── volumes/             # Data directories
```

### Coding Guidelines

**TypeScript**
- Use strict type checking
- Avoid `any` types
- Export interfaces from `packages/shared/src/types.ts`

**React Components**
- Use functional components with hooks
- Keep components focused and small
- Use TypeScript interfaces for props

**Styling**
- Use Tailwind CSS utility classes
- Keep consistent dark theme (gray-900, gray-800)
- Maintain responsive design

**Database**
- All schema changes go in `packages/shared/src/schema.ts`
- Update types in `packages/shared/src/types.ts`
- Use WAL mode for SQLite
- Test with concurrent reads/writes

## Feature Requests

We track feature requests in [GitHub Issues](https://github.com/DoomedRamen/autopwn/issues). Before submitting:

1. **Search existing issues** to avoid duplicates
2. **Describe the problem** you're trying to solve
3. **Propose a solution** if you have one in mind
4. **Consider backwards compatibility**

## Release Process

Maintainers will:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create GitHub release with notes
4. Build and push Docker images

## Questions?

Feel free to open an issue with the `question` label if you need help or clarification.

## Recognition

Contributors will be recognized in:
- GitHub contributors page
- Release notes for significant contributions
- README acknowledgments for major features

Thank you for contributing to AutoPWN! 🔐
