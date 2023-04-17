async function taskCreationAgent(result, currentTask, taskList, openaiCall) {
  const objective = process.env.OBJECTIVE;
  const prompt = `You are a task creation AI that uses the result of an execution agent to create new tasks with the following objective: ${objective}, The last completed task has the result: ${result}. This result was based on this task description: ${currentTask}. These are incomplete tasks: ${taskList.join(
    ", "
  )}. Based on the result, create new tasks to be completed by the AI system that do not overlap with incomplete tasks. Return the tasks as an array.`;
  const response = await openaiCall(prompt, "davinci-codex", 200);
  const tasks = response.split(",").map((task) => task.trim());
  return tasks.filter((task) => !taskList.includes(task));
}

module.exports = { taskCreationAgent };
