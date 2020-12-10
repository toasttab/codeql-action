import * as core from "@actions/core";

import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";

import * as actionsUtil from "./actions-util";
import * as config_utils from "./config-utils";
import { getActionsLogger, Logger } from "./logging";
import * as util from "./util";
import { Language } from "./languages";

function getCodeQLHash(config: config_utils.Config, logger: Logger) {
  let hash = cp
    .execFileSync("shasum", [config.codeQLCmd])
    .toString()
    .split(" ")[0];
  logger.info(`codeql-hash: ${hash}`);
  return hash;
}

async function getQueriesHash(
  _language: Language,
  config: config_utils.Config,
  logger: Logger
): Promise<string> {
  // Compute hash
  const globHash = require("glob-hash");
  const finalHash = await globHash({
    include: [
      // @esbena: isn't this a bit too aggressive? Could we select qlpack directories instead?
      `${config.tempDir}/**/.cache/data/**`,
      `${config.toolCacheDir}/**/.cache/data/**`,
    ],
    files: false, // MG: List matched files for debugging
  });
  logger.info(`queries-hash: ${finalHash}`);
  return finalHash;
}

function getTrapHash(
  language: Language,
  config: config_utils.Config,
  logger: Logger
): string {
  const dbPath = util.getCodeQLDatabasePath(config.tempDir, language),
    trapDir = path.join(dbPath, "trap", language);
  if (!fs.existsSync(trapDir)) {
    throw new Error(
      `Trap directory ${trapDir} does not exist. Has the 'create-database' action been used with 'keep-trap: true'?`
    );
  }
  if (!fs.existsSync(trapDir)) {
    throw new Error(
      `Trap directory ${trapDir} does not exist. Has the 'create-database' action been used with 'keep-trap: true'?`
    );
  }
  let trapRootFiles = fs.readdirSync(trapDir);
  if (trapRootFiles.length === 0) {
    throw new Error(
      `Trap directory ${trapDir} is empty. Has the 'create-database' action been used with 'keep-trap: true'?`
    );
  }
  logger.info(`trapDir ${trapDir} content:`);
  logger.info(cp.execFileSync("ls", [trapDir]).toString());
  let hash = cp
    .execSync(
      "find . -mindepth 2 -type f -name *.trap.gz | sort | xargs zcat -v | grep -v '^extraction_time' | shasum -",
      { cwd: trapDir }
    )
    .toString()
    .split(" ")[0];
  logger.info(`trap-hash: ${hash}`);
  return hash;
}

async function run() {
  const logger = getActionsLogger();
  try {
    actionsUtil.prepareLocalRunEnvironment();

    const config = await config_utils.getConfig(
      actionsUtil.getRequiredEnvParam("RUNNER_TEMP"),
      logger
    );
    if (config === undefined) {
      throw new Error(
        "Config file could not be found at expected location. Has the 'init' action been called?"
      );
    }
    let hashesByLanguage: {
      [language in keyof typeof Language]?: {
        queries: string;
        database: string;
        codeql: string;
      };
    } = {};
    for (const language of config.languages) {
      (hashesByLanguage as any) /* XXX circumvent aggressive typescript */[
        language
      ] = {
        version: 3,
        queries: await getQueriesHash(language, config, logger),
        trap: getTrapHash(language, config, logger),
        codeql: getCodeQLHash(config, logger),
      };
    }
    logger.info("hashes:");
    logger.info(JSON.stringify(hashesByLanguage, null, 2));
    core.setOutput("hashes", JSON.stringify(hashesByLanguage));
  } catch (error) {
    core.setFailed(`We were unable to hash the inputs. ${error.message}`);
    console.log(error);
    return;
  }
}

async function runWrapper() {
  try {
    await run();
  } catch (error) {
    core.setFailed(`hash-inputs action failed. ${error}`);
    console.log(error);
  }
}

void runWrapper();
