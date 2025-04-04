# Development Guide

## Setup

1. Clone the repository
```bash
git clone https://github.com/Virul360/google-image-search-mcp.git
cd google-image-search-mcp
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```bash
cp .env.example .env
# Edit .env and add your SERP_API_KEY
```

## Development Workflow

### Building
```bash
npm run build
```

### Running locally
```bash
npm run start
```

### Testing
```bash
npm run test
```

## Adding New Features

1. Update types in `src/types.ts` if needed
2. Add implementation in `src/api.ts`
3. Register new tools in `src/index.ts`
4. Update documentation in `/docs`
5. Update README.md if necessary

## Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## Pull Request Process

1. Create a feature branch
2. Implement changes
3. Run tests and ensure formatting is correct
4. Create a pull request with a clear description
5. Address review feedback