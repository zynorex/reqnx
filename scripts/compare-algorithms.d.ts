import { type Decision } from '@reqnx/core';
export interface TrafficScenario {
    readonly name: string;
    readonly description: string;
    readonly steps: readonly {
        readonly tMs: number;
        readonly cost: number;
    }[];
}
export declare const SCENARIOS: readonly TrafficScenario[];
export interface RunResult {
    readonly scenarioName: string;
    readonly stepIndex: number;
    readonly tMs: number;
    readonly cost: number;
    readonly fw: Decision;
    readonly tb: Decision;
    readonly lb: Decision;
    readonly swl: Decision;
    readonly swc: Decision;
}
export declare function runAllScenarios(): RunResult[];
export declare function generateMarkdown(results: RunResult[]): string;
export declare function writeComparisonDoc(): void;
//# sourceMappingURL=compare-algorithms.d.ts.map