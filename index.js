require('dotenv').config();
const { default: axios } = require('axios');
const { default: Pinecone } = require('@pinecone-io/client');
const { default: prompt } = require('prompt-sync')();
const { default: chalk } = require('chalk');

// Engine configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL || 'gpt-3.5-turbo';
const OPENAI_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.0;

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;

// Table config
const YOUR_TABLE_NAME = process.env.TABLE_NAME;

// Goal configuration
const OBJECTIVE = process.env.OBJECTIVE;
const INITIAL_TASK = process.env.INITIAL_TASK || process.env.FIRST_TASK;

// Check if we know what we are doing
if (!OBJECTIVE) throw new Error('OBJECTIVE environment variable is missing from .env');
if (!INITIAL_TASK) throw new Error('INITIAL_TASK environment variable is missing from .env');

if (OPENAI_API_MODEL.toLowerCase().includes('gpt-4')) {
  console.log(chalk.red.bold('\n*****USING GPT-4. POTENTIALLY EXPENSIVE. MONITOR YOUR COSTS*****\n'));
}

// Configure OpenAI and Pinecone
const openai = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
  environment: PINECONE_ENVIRONMENT,
});

// Create Pinecone index
const dimension = 1536;
const metric = 'cosine';
const podType = 'p1';

(async () => {
  if (!(await pinecone.listIndexes()).includes(YOUR_TABLE_NAME)) {
    await pinecone.createIndex(YOUR_TABLE_NAME, { dimension, metric, podType });
  }
})();

// Task list
const taskList = [];

function addTask(task) {
  taskList.push(task);
}

async function getAdaEmbedding(text) {
  const response = await openai.post('/embeddings', {
    input: text.replace(/\n/g, ' '),
    model: 'text-embedding-ada-002',
  });
  return response.data.data[0].embedding;
}

async function openaiCall(prompt, model = OPENAI_API_MODEL, maxTokens = 100, temperature = OPENAI_TEMPERATURE) {
  while (true) {
    try {
      if (model.startsWith('llama')) {
        // Spawn a subprocess to run llama.cpp
        // TODO: Implement llama support
        throw new Error('Llama support not implemented yet');
      } else if (!model.startsWith('gpt-')) {
        // Use completion API
        const response = await openai.post('/completions', {
          engine: model,
          prompt,
          max_tokens: maxTokens,
          temperature,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });
        return response.data.choices[0].text.trim();
      } else {
        // Use chat completion API
        const messages = [{ role: 'system', content: prompt }];
        const response = await openai.post('/engines/davinci-codex/completions', {
          prompt: '',
          max_tokens: maxTokens,
          temperature,
          n: 1,
          stop: null,
          messages,
        });
        return response.data.choices[0].text.trim();
      }
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.log(chalk.yellow('The OpenAI API rate limit has been exceeded. Waiting 10 seconds and trying again.'));
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } else {
        throw error;
      }
    }
  }
}

async function taskCreationAgent(objective, result, taskDescription, taskList) {
  const prompt = `You are a task creation AI that uses the result of an execution agent to create new tasks with the following objective: ${objective}, The last completed task has the result: ${result}. This result was based on this task description: ${taskDescription}. These are incomplete tasks: ${taskList.join(
    ', '
  )}. Based on the result, create new tasks to be completed by the AI system that do not overlap with incomplete tasks. Return the tasks as an array.`;
  const response = await openaiCall(prompt, 'davinci-codex', 200); const tasks = response.split(',').map((task) => task.trim()); return tasks.filter((task) => !taskList.includes(task));
}

async function executeTask(task) {	
    const response = await openaiCall(task, OPENAI_API_MODEL);
    const embedding = await getAdaEmbedding(response);
    await pinecone.insert(YOUR_TABLE_NAME, [embedding], [task]);
    return response;
}

async function getNextTask() {
    const embedding = await getAdaEmbedding(INITIAL_TASK);
    const { data } = await pinecone.search(YOUR_TABLE_NAME, [embedding], { k: 1 });
    return data.hits[0].ids[0];
}

async function main() {
    let currentTask = INITIAL_TASK;
    while (true) {
    console.log(chalk.blue.bold(\nCurrent task: ${currentTask}));
    const result = await executeTask(currentTask);
    console.log(chalk.green.bold(Result: ${result}));
    const tasks = await taskCreationAgent(OBJECTIVE, result, currentTask, taskList);
    console.log(chalk.yellow.bold(New tasks: ${tasks.join(', ')}));
    tasks.forEach((task) => addTask(task));
    currentTask = await getNextTask();
    }
}

main().catch((error) => console.error(error));
