export default {
  packageMode: {
    // @graphql-inspector/core@7.1.3 peers graphql ^14 || ^15 || ^16 only:
    // https://unpkg.com/@graphql-inspector/core@7.1.3/package.json. graphql@17 creates a nested
    // graphql@16 and inspector diff() fails with "another module or realm".
    graphql: 'ignore'
  }
}
