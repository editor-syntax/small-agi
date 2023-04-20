require("dotenv").config();
const chalk = require("chalk");
const say = require('say');
const { setupPinecone } = require("./small-agi/pineconeHelper");
const { addTask, taskList } = require("./small-agi/taskHelper");
const { getAdaEmbedding } = require("./small-agi/openaiHelper");
const { openaiCall } = require("./small-agi/openaiHelper");
const { taskCreationAgent } = require("./small-agi/taskCreator");
const { executeTask } = require("./small-agi/taskExecutor");
const { getNextTask } = require("./small-agi/taskSelector");

setupPinecone();

async function speak(text) {
  if (process.env.TTS_ENABLED === 'true') {
    return new Promise((resolve, reject) => {
      say.speak(text, undefined, undefined, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function main() {
  let currentTask = process.env.INITIAL_TASK || process.env.FIRST_TASK;

  while (true) {
    console.log(chalk.blue.bold(`\nCurrent task: ${currentTask}`));
    const result = await executeTask(currentTask, openaiCall, getAdaEmbedding);
    console.log(chalk.green.bold(`Result: ${result}`));
    
    await speak(result);
    
    const tasks = await taskCreationAgent(result, currentTask, taskList, openaiCall);
    console.log(chalk.yellow.bold(`New tasks: ${tasks.join(", ")}`));
    tasks.forEach((task) => addTask(task));
    currentTask = await getNextTask(getAdaEmbedding);
  }
}

main().catch((error) => console.error(error));
