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
        publishCmd:
          "npm stage publish --provenance --access public --tag ${nextRelease.channel || 'latest'}",
      },
    ],

    // Create a GitHub release
    "@semantic-release/github",
  ],
};
