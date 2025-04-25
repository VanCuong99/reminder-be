# Contributing to Momento Backend

We love your input! We want to make contributing to Momento Backend as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [project maintainers].

### Our Standards

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Pull Request Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

### Pull Request Requirements

1. Update the README.md with details of changes to the interface, if applicable.
2. Update the version numbers in any examples files and the README.md to the new version that this Pull Request would represent.
3. The PR must be approved by at least one maintainer before being merged.

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker]

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](); it's that easy!

### Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
    - Be specific!
    - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

## Commit Guidelines

### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

fix(user): resolve email validation issue
Update email validation regex to handle all valid email formats
Previous validation was rejecting some valid email addresses
Closes #456

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries

### Scope

The scope should be the name of the module affected (as perceived by the person reading the changelog generated from commit messages).

Examples:

- auth
- user
- database
- config

### Subject

The subject contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize the first letter
- no dot (.) at the end

### Body

Just as in the **subject**, use the imperative, present tense. The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

### Examples

### Revert

If the commit reverts a previous commit, it should begin with `revert:`, followed by the header of the reverted commit. In the body, it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

### Git Workflow Best Practices

1. **Keep commits atomic**:

    - Each commit should represent a single logical change
    - Don't mix unrelated changes in the same commit

2. **Branch naming convention**:

    - feature/Idtask-feature-name
    - fix/Idtask-bug-name
    - docs/Idtask-documentation-change
    - refactor/Idtask-refactor-name

3. **Regular commits**:

    - Commit early and often
    - Don't wait until you have large changes
    - Each commit should be a checkpoint where the code works

4. **Pull Request size**:

    - Keep PRs small and focused
    - Large PRs are harder to review and more likely to contain errors

5. **Commit history**:
    - Use `git rebase` to keep commit history clean
    - Squash commits when appropriate
    - Never rewrite history on main/master branch
