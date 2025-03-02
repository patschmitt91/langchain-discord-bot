const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { ChromaClient } = require("chromadb");
const { OpenAIEmbeddings } = require("@langchain/openai");

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const vectorStore = new Chroma(embeddings, {
  collectionName: "dnd_campaign",
  client: chromaClient,
});

module.exports = { chromaClient, vectorStore };