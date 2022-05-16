# @xata.io/client

## 0.8.0

### Patch Changes

- bde908e: Refactor client builder
- ea3eef8: Make records returned by the API readonly

## 0.7.2

### Patch Changes

- 4803b6f: Memoize ApiClient namespaces
- 1f268d7: Add search in XataClient
- d58c3d9: Hide private helper utilities
- f3b731b: Expose branch resolution API

## 0.7.1

### Patch Changes

- 01aef78: Fix bundle for browsers
- 56be1fd: Allow sending updates with link object
- fc51771: Add includes operator helper methods

## 0.7.0

### Minor Changes

- 6ce5512: Add bulk operations for all methods
- 2a1fa4f: Introduced automatic branch resolution mechanism

### Patch Changes

- d033f3a: Improve column selection output type with non-nullable columns
- b1e92db: Include stack trace with errors
- deed570: Improve sorting with multiple properties
- 80b5417: Improve filtering types

## 0.6.0

### Minor Changes

- 084f5df: Add type inference for columns
- bb73c89: Unify create and insert in a single method overload

### Patch Changes

- 716c487: Forward nullable types on links
- bb66bb2: Fix error handling with createMany
- 084f5df: Fix circular dependencies on selectable column

## 0.5.1

### Patch Changes

- 12729ab: Make API client fetch implementation optional

## 0.5.0

### Patch Changes

- 14ec7d1: Fix in Selectable type

## 0.4.0

### Patch Changes

- b951331: Add support for new float column
- d470610: Add new getAll() method
- eaf92a8: Expose pagination constants (size and offset limits)
- 57fde77: Reduce subrequests for createMany
- eaf92a8: Implement schema-less client
- 97a3caa: Make createBranch from optional with empty branch

## 0.3.0

### Minor Changes

- 1c0a454: Add API Client and internally use it

### Patch Changes

- 122321c: Fix client in CF workers and Deno
- a2671b5: Allow cancel or resend workspace invites
- e73d470: Split insert and create
