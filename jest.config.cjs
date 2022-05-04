module.exports = {
    "testPathIgnorePatterns": [
        "<rootDir>/dist/",
        "<rootDir>/codegen/dist/",
        "<rootDir>/client/dist/"

    ],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
}
