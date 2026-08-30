import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

// Build the real dependency graph so shared imports contribute their signatures,
// while keeping this gate accountable only for production sources owned by SeqFX.
const seqFxRoot = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(seqFxRoot, "tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) {
    console.error(ts.formatDiagnosticsWithColorAndContext([configFile.error], diagnosticHost()));
    process.exitCode = 1;
} else {
    const config = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        seqFxRoot,
        undefined,
        configPath,
    );
    const program = ts.createProgram({
        rootNames: config.fileNames,
        options: config.options,
    });
    const projectSources = program.getSourceFiles().filter((sourceFile) => (
        !sourceFile.isDeclarationFile
        && isInsideDirectory(sourceFile.fileName, seqFxRoot)
    ));
    const diagnostics = [
        ...config.errors,
        ...program.getConfigFileParsingDiagnostics(),
        ...program.getOptionsDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...projectSources.flatMap((sourceFile) => [
            ...program.getSyntacticDiagnostics(sourceFile),
            ...program.getSemanticDiagnostics(sourceFile),
        ]),
    ];

    if (diagnostics.length > 0) {
        console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost()));
        process.exitCode = 1;
    } else {
        console.log(`SeqFX strict TypeScript: ${projectSources.length} production modules passed.`);
    }
}

function isInsideDirectory(fileName, directory) {
    const relative = path.relative(directory, fileName);
    return relative !== ""
        && !relative.startsWith(`..${path.sep}`)
        && !path.isAbsolute(relative);
}

function diagnosticHost() {
    return {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => "\n",
    };
}
