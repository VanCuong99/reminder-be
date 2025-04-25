module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/$1',
    },
    roots: ['<rootDir>'],
    modulePaths: ['<rootDir>'],
    coveragePathIgnorePatterns: [
        'node_modules',
        'src/infrastructure/database/migrations',
        'src/shared/types/graphql/outputs',
        'src/shared/types/graphql/inputs',
        'src/presentation/graphql/types',
    ],
};
