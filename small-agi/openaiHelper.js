const axios = require("axios");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
});

async function getAdaEmbedding(text) {
  const response = await openai.post("/embeddings", {
    input: text.replace(/\n/g, " "),
    model: "text-embedding-ada-002",
  });
  return response.data.data[0].embedding;
}

async function openaiCall(prompt, model = OPENAI_API_MODEL, maxTokens = 100, temperature = OPENAI_TEMPERATURE) {
  while (true) {
    try {
      if (model.startsWith("llama")) {
        const tempfile = path.resolve(__dirname, "tempfile.txt");
        fs.writeFileSync(tempfile, prompt);
        const llama = spawn("./llama", ["-i", tempfile, "-o", tempfile]);
        let response = "";
        llama.stdout.on("data", (data) => {
          response += data.toString();
        });
        await new Promise((resolve, reject) => {
          llama.on("close", (code) => {
            if (code === 0) {
              fs.unlinkSync(tempfile);
              resolve();
            } else {
              reject(new Error("Llama subprocess failed"));
            }
          });
        });
        return response.trim();
      } else {
        const response = await openai.post("/completions", {
          engine: model,
          prompt,
          max_tokens: maxTokens,
          temperature,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });
        return response.data.choices[0].text.trim();
      }
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.log(chalk.yellow("The OpenAI API rate limit has been exceeded. Waiting 10 seconds and trying again."));
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } else {
        throw error;
      }
    }
  }
}

module.exports = { getAdaEmbedding, openaiCall };
