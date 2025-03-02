const { ChatOpenAI } = require("@langchain/openai");

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-turbo",
  maxTokens: 1000,
  temperature: 0.0,
});

module.exports = llm;