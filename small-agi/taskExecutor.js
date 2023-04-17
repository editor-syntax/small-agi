const { pinecone } = require("./pineconeHelper");

async function executeTask(task, openaiCall, getAdaEmbedding) {
  const response = await openaiCall(task);
  const embedding = await getAdaEmbedding(response);
  await pinecone.insert(process.env.TABLE_NAME, [embedding], [task]);
  return response;
}

module.exports = { executeTask };
