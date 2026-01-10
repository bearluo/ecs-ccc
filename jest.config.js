/**
 * Jest 配置文件
 * 支持 ES 模块（@bl-framework/ecs）
 */

module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts', '**/?(*.)+(spec|test).ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            useESM: true,
            tsconfig: 'tsconfig.test.json',
            isolatedModules: false,
        }],
        '^.+\\.js$': ['ts-jest', {
            useESM: true,
        }],
    },
    collectCoverageFrom: [
        'assets/scripts/**/*.ts',
        '!assets/scripts/**/*.d.ts',
        '!assets/scripts/**/index.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/assets/scripts/$1',
        '^@bl-framework/ecs$': '<rootDir>/../bl-framework-demo/packages/ecs',
        '^db://(.*)$': '<rootDir>/$1',
        '^cc$': '<rootDir>/tests/__mocks__/cc.ts',
    },
    transformIgnorePatterns: [
        'node_modules/(?!@bl-framework)',
    ],
};
