const Pinecone = require("@pinecone-io/client");
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;
const YOUR_TABLE_NAME = process.env.TABLE_NAME;

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
  environment: PINECONE_ENVIRONMENT,
});

async function setupPinecone() {
  if (!(await pinecone.listIndexes()).includes(YOUR_TABLE_NAME)) {
    await pinecone.createIndex(YOUR_TABLE_NAME, { dimension: 1536, metric: "cosine", podType: "p1" });
  }
}

module.exports = { setupPinecone, pinecone };
