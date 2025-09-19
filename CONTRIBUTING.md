# Contributing to CVR Bus Tracker 🤝

First off, thank you for considering contributing to CVR Bus Tracker! It's people like you that make this project better for CVR College students. 🚌

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Testing](#testing)
- [Community](#community)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [your-email@domain.com](mailto:your-email@domain.com).

## 🚀 Getting Started

### What Can You Contribute?

- 🐛 **Bug fixes** - Help us squash those pesky bugs
- ✨ **New features** - Add functionality that benefits CVR students
- 📚 **Documentation** - Improve or add to our documentation
- 🎨 **UI/UX improvements** - Make the app more user-friendly
- 🧪 **Tests** - Help us improve test coverage
- 🔧 **Performance optimizations** - Make the app faster and more efficient
- 🌐 **Accessibility** - Make the app accessible to all users

### Good First Issues

Look for issues labeled `good first issue` or `help wanted`. These are perfect for newcomers!

## 🛠️ Development Setup

### Prerequisites

Make sure you have these installed:
- **Node.js** >= 20.0.0
- **npm** or **yarn**
- **React Native CLI**
- **Android Studio** with Android SDK
- **Git**

### Setup Steps

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/CVRBusTracker.git
   cd CVRBusTracker
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/Shaik-Faizan-Ahmed/CVRBusTracker.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Set up environment**
   ```bash
   # Copy example environment file
   cp .env.example .env

   # Add your API keys (get from project maintainers for testing)
   # GOOGLE_MAPS_API_KEY=your_key_here
   ```

6. **Start development**
   ```bash
   # Start Metro bundler
   npm start

   # In another terminal, run the app
   npm run android
   ```

## 🔄 How to Contribute

### 1. Pick an Issue

- Check our [Issues](https://github.com/Shaik-Faizan-Ahmed/CVRBusTracker/issues) page
- Comment on the issue to let others know you're working on it
- Ask questions if anything is unclear

### 2. Create a Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create a new branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. Make Your Changes

- Write clean, readable code
- Follow our coding standards
- Add tests for new functionality
- Update documentation if needed

### 4. Test Your Changes

```bash
# Run tests
npm test

# Run linting
npm run lint

# Test on device/emulator
npm run android
```

### 5. Commit and Push

```bash
# Add your changes
git add .

# Commit with a good message
git commit -m "feat: add bus arrival notifications"

# Push to your fork
git push origin feature/your-feature-name
```

### 6. Create Pull Request

- Go to your fork on GitHub
- Click "New Pull Request"
- Fill out the PR template
- Link any related issues

## 📝 Code Style Guidelines

We use **ESLint** and **Prettier** to maintain consistent code style.

### TypeScript Guidelines

```typescript
// ✅ Good - Explicit types
interface BusLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// ✅ Good - Descriptive function names
const calculateDistanceToCollege = (location: BusLocation): number => {
  // Implementation
};

// ❌ Bad - Any types
const updateLocation = (data: any) => {
  // Avoid 'any' types
};
```

### React Native Guidelines

```typescript
// ✅ Good - Functional components with hooks
const MapViewScreen: React.FC<MapViewScreenProps> = ({navigation, route}) => {
  const [busLocation, setBusLocation] = useState<Location | null>(null);

  useEffect(() => {
    // Setup logic
  }, []);

  return (
    <View style={styles.container}>
      {/* JSX */}
    </View>
  );
};

// ✅ Good - StyleSheet usage
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
```

### File Naming Conventions

```
src/
├── screens/
│   ├── HomeScreen.tsx              # PascalCase for components
│   └── BusInputScreen.tsx
├── services/
│   ├── FirebaseService.ts          # PascalCase for classes
│   └── locationUtils.ts            # camelCase for utilities
├── types/
│   └── index.ts                    # Type definitions
└── constants/
    └── config.ts                   # Configuration constants
```

### Code Formatting

We use **Prettier** for automatic formatting:

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

## 📏 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

### Examples

```bash
# New feature
git commit -m "feat(maps): add real-time bus location updates"

# Bug fix
git commit -m "fix(tracker): resolve race condition in tracker assignment"

# Documentation
git commit -m "docs: update installation instructions"

# Breaking change
git commit -m "feat(api): change location update interval

BREAKING CHANGE: Location updates now occur every 10 seconds instead of 30 seconds"
```

## 🔍 Pull Request Process

### Before Submitting

- [ ] Code follows our style guidelines
- [ ] Self-review of your code completed
- [ ] Tests added for new functionality
- [ ] Documentation updated if needed
- [ ] All tests pass locally
- [ ] No console errors or warnings
- [ ] App builds successfully

### PR Template

When creating a PR, please fill out our template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Tested on Android device
- [ ] Unit tests added/updated
- [ ] Manual testing completed

## Screenshots
(If applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass
- [ ] Documentation updated
```

### Review Process

1. **Automatic Checks**: GitHub Actions will run tests and linting
2. **Code Review**: Maintainers will review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, your PR will be merged

## 🐛 Issue Guidelines

### Bug Reports

Use our bug report template and include:

- **Clear title** describing the issue
- **Steps to reproduce** the bug
- **Expected behavior** vs actual behavior
- **Device information** (Android version, device model)
- **App version** and relevant logs
- **Screenshots** if applicable

### Feature Requests

Use our feature request template and include:

- **Clear description** of the feature
- **Use case** - why is this needed?
- **Proposed solution** if you have one
- **Alternatives considered**
- **Additional context** or mockups

### Security Issues

**DO NOT** create public issues for security vulnerabilities. Instead:

1. Email [your-email@domain.com](mailto:your-email@domain.com)
2. Include "SECURITY" in the subject line
3. Provide detailed description
4. We'll respond within 48 hours

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- HomeScreen.test.tsx
```

### Writing Tests

```typescript
// Example test file: __tests__/HomeScreen.test.tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import HomeScreen from '../src/screens/HomeScreen';

describe('HomeScreen', () => {
  test('renders track bus button', () => {
    const {getByText} = render(<HomeScreen />);
    expect(getByText('Track Bus')).toBeTruthy();
  });

  test('navigates to bus input on track bus press', () => {
    const mockNavigate = jest.fn();
    const {getByText} = render(
      <HomeScreen navigation={{navigate: mockNavigate}} />
    );

    fireEvent.press(getByText('Track Bus'));
    expect(mockNavigate).toHaveBeenCalledWith('BusInput', {mode: 'track'});
  });
});
```

### Testing Guidelines

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user flows (future)
- **Manual Testing**: Test on real devices

## 🏗️ Architecture Guidelines

### File Organization

```
src/
├── screens/           # React Native screens
├── components/        # Reusable UI components
├── services/          # Business logic and API calls
├── utils/            # Helper functions
├── types/            # TypeScript type definitions
├── constants/        # App constants and configuration
├── navigation/       # Navigation configuration
└── __tests__/        # Test files
```

### State Management

- Use **React Hooks** for local component state
- Use **Context API** for app-wide state (if needed)
- Keep Firebase as the source of truth for real-time data

### Error Handling

```typescript
// ✅ Good - Proper error handling
try {
  const result = await firebaseService.updateLocation(location);
  setLocation(result);
} catch (error) {
  console.error('Failed to update location:', error);
  showErrorMessage('Unable to update location. Please try again.');
}

// ✅ Good - User-friendly error messages
const showErrorMessage = (message: string) => {
  Alert.alert('Error', message, [
    {text: 'OK', style: 'default'}
  ]);
};
```

## 🌟 Recognition

Contributors will be recognized in:

- **README.md** - All contributors listed
- **Release Notes** - Major contributors highlighted
- **GitHub** - Contributor badges and stats

## 📞 Community

### Getting Help

- **GitHub Discussions**: For general questions and ideas
- **Issues**: For bug reports and feature requests
- **Email**: [your-email@domain.com](mailto:your-email@domain.com) for direct contact

### Communication Guidelines

- Be respectful and professional
- Ask questions if something is unclear
- Provide context when asking for help
- Be patient - this is a volunteer project

## 🎯 Roadmap

Check our [project roadmap](https://github.com/Shaik-Faizan-Ahmed/CVRBusTracker/projects) to see what we're working on and where you can help.

### Upcoming Features

- iOS support
- Route optimization
- Push notifications
- Offline support improvements
- Accessibility enhancements

## 📚 Resources

### Learning Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Maps Platform](https://developers.google.com/maps/documentation)

### Development Tools

- **VS Code Extensions**:
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint
  - React Native Tools

---

## 🙏 Thank You

Thank you for taking the time to contribute! Your efforts help make bus tracking easier for all CVR College students. Every contribution, no matter how small, makes a difference.

**Happy Coding!** 🚌✨