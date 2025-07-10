---
applyTo: '**/*.ts'
---

Coding standards, domain knowledge, and preferences that AI should follow.

# Coding Standards and Preferences

## General Coding Standards

- Use TypeScript for all code.
- Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).
- Use `const` for variables that are not reassigned, and `let` for those that are.
- Use `async/await` for asynchronous code.
- Use arrow functions for function expressions.
- Use template literals for string interpolation.
- Use JSDoc comments for function documentation.
- Use `export` statements for module exports.
- Use `interface` for type definitions.
- Use `enum` for enumerations.
- Use `type` for type aliases.
- Use `any` type sparingly, prefer specific types.
- Use `unknown` type for values that could be of any type but need to be checked before use.
- Use `never` type for functions that never return.
- Use `void` type for functions that do not return a value.
- Use `Record<string, unknown>` for objects with string keys and unknown values.
- Use `Promise<T>` for asynchronous functions that return a value of type `T`.

## Domain Knowledge

- The code is part of a TypeScript project that interacts with a database.
- The code is part of a web application that uses a REST API.
- The code is part of a TypeScript library that provides utility functions.

## Preferences

- Use `lodash` for utility functions.
- Use `axios` for HTTP requests.
- Use `jest` for unit testing.
- Use `ts-jest` for TypeScript support in Jest.
- Use `eslint` for linting.
- Use `prettier` for code formatting.
- Use `dotenv` for environment variable management.

## Error Handling

- Use `try/catch` blocks for error handling in asynchronous code.
