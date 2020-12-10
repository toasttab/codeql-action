"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cp = __importStar(require("child_process"));
const actionsUtil = __importStar(require("./actions-util"));
const config_utils = __importStar(require("./config-utils"));
const logging_1 = require("./logging");
const util = __importStar(require("./util"));
function getCodeQLHash(config, logger) {
    let hash = cp
        .execFileSync("shasum", [config.codeQLCmd])
        .toString()
        .split(" ")[0];
    logger.info(`codeql-hash: ${hash}`);
    return hash;
}
async function getQueriesHash(_language, config, logger) {
    // Compute hash
    const globHash = require("glob-hash");
    const finalHash = await globHash({
        include: [
            // @esbena: isn't this a bit too aggressive? Could we select qlpack directories instead?
            `${config.tempDir}/**/.cache/data/**`,
            `${config.toolCacheDir}/**/.cache/data/**`,
        ],
        files: false,
    });
    logger.info(`queries-hash: ${finalHash}`);
    return finalHash;
}
function getTrapHash(language, config, logger) {
    const dbPath = util.getCodeQLDatabasePath(config.tempDir, language), trapDir = path.join(dbPath, "trap", language);
    if (!fs.existsSync(trapDir)) {
        throw new Error(`Trap directory ${trapDir} does not exist. Has the 'create-database' action been used with 'keep-trap: true'?`);
    }
    let hash = cp
        .execSync("find . -mindepth 2 -type f -name *.trap.gz -print0 | sort -z | xargs -0 zcat | grep -v '^extraction_time' | shasum -", { cwd: trapDir })
        .toString()
        .split(" ")[0];
    logger.info(`trap-hash: ${hash}`);
    return hash;
}
async function run() {
    const logger = logging_1.getActionsLogger();
    try {
        actionsUtil.prepareLocalRunEnvironment();
        const config = await config_utils.getConfig(actionsUtil.getRequiredEnvParam("RUNNER_TEMP"), logger);
        if (config === undefined) {
            throw new Error("Config file could not be found at expected location. Has the 'init' action been called?");
        }
        let hashesByLanguage = {};
        for (const language of config.languages) {
            hashesByLanguage /* XXX circumvent aggressive typescript */[language] = {
                version: 3,
                queries: await getQueriesHash(language, config, logger),
                trap: getTrapHash(language, config, logger),
                codeql: getCodeQLHash(config, logger),
            };
        }
        logger.info("hashes:");
        logger.info(JSON.stringify(hashesByLanguage, null, 2));
        core.setOutput("hashes", JSON.stringify(hashesByLanguage));
    }
    catch (error) {
        core.setFailed(`We were unable to hash the inputs. ${error.message}`);
        console.log(error);
        return;
    }
}
async function runWrapper() {
    try {
        await run();
    }
    catch (error) {
        core.setFailed(`hash-inputs action failed. ${error}`);
        console.log(error);
    }
}
void runWrapper();
//# sourceMappingURL=hash-inputs-action.js.map