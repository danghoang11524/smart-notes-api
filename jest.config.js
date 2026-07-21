/**
 * Jest configuration.
 * Project uses native ES Modules, so Jest is run with:
 *   NODE_OPTIONS=--experimental-vm-modules jest
 * (see the "test" script in package.json)
 */
export default {
  testEnvironment: "node",
  transform: {},
  collectCoverageFrom: [
    "src/repositories/**/*.js",
    "src/services/**/*.js",
    "src/controllers/**/*.js",
  ],
  coverageDirectory: "coverage",
  verbose: true,
};
