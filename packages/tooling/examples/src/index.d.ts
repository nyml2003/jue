export interface ExampleAppDefinition {
    readonly id: string;
    readonly appRoot: string;
    readonly componentPath: string;
    readonly generatedModulePath: string;
    readonly runtimeEntryPath: string;
    readonly unitTestPath: string;
    readonly errorTestPath: string;
    readonly e2eTestPath: string;
    readonly cssPath: string;
    readonly indexHtmlPath: string;
    readonly mainPath: string;
    readonly distRoot: string;
}
export declare const DEFAULT_WEB_PLAYGROUND_APPS_ROOT: string;
export declare function createExampleAppDefinition(appRoot: string): ExampleAppDefinition;
export declare function listExampleApps(appsRoot?: string): Promise<readonly ExampleAppDefinition[]>;
export declare function getExampleAppDefinition(exampleId: string, appsRoot?: string): Promise<ExampleAppDefinition | null>;
//# sourceMappingURL=index.d.ts.map