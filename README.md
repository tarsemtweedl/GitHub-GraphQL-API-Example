# IssueReader

A small app to demonstrate how to load and paginate some issues from a repo, and their comments, using GitHub's GraphQL API, with Apollo Client.

### Running

1. Copy `config.default.js` into `config.js` and add your username and password (please send a PR to add better login!)
2. `npm install`
3. `react-native run-ios`

### Features

1. Sending login token to GitHub API
2. Navigating between two views and loading different queries
3. Infinite scroll pagination

### Screenshot

Here's the home page:

<img src="screenshot.png" width="300" />
