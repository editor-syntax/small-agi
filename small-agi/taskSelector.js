const { pinecone } = require("./pineconeHelper");

async function getNextTask(getAdaEmbedding) {
  const INITIAL_TASK = process.env.INITIAL_TASK || process.env.FIRST_TASK;
  const embedding = await getAdaEmbedding(INITIAL_TASK);
  const { data } = await pinecone.search(process.env.TABLE_NAME, [embedding], { k: 1 });
  return data.hits[0].ids[0];
}

module.exports = { getNextTask };
