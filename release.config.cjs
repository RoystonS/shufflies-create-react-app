// semantic-release's exec plugin interpolates `${nextRelease.channel}` itself when
// it builds the publish command, so these are not JavaScript template literals and
// `eslint/no-template-curly-in-string` is a false positive here.
/* oxlint-disable eslint/no-template-curly-in-string */

module.exports = {
  branches: ["main", { name: "next", prerelease: true }],
  plugins: [
    // Analyze commit messages to determine the type of release
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          // Dependency chores change what newly scaffolded projects are generated
          // with, so they should still reach consumers as a release.
          { type: "chore", scope: "deps", release: "patch" },
        ],
      },
    ],

    // Generate release notes based on commit messages
    "@semantic-release/release-notes-generator",

    // Publish the package to npm, staged
    ["@semantic-release/npm", { npmPublish: false }],
    [
      "@semantic-release/exec",
      {
        // @semantic-release/exec parses this command's stdout as JSON release
        // information. npm writes its lifecycle banners and the packed tarball name to
        // stdout, so `1>&2` sends that output to stderr instead, where the plugin
        // expects logging. Without it the plugin logs a JSONError that looks like a
        // failed publish but is not.
        publishCmd: "npm stage publish --provenance --access public --tag ${nextRelease.channel || 'latest'} 1>&2",
      },
    ],

    // Create a GitHub release
    "@semantic-release/github",
  ],
};
