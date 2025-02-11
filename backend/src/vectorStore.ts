import { OpenAI } from 'openai';
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import path from 'path';
import fs from 'fs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class VectorStore {
  private store: FaissStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private storePath: string;
  private initialized: Promise<void>;

  constructor() {
    const storageDir = path.join(process.cwd(), 'storage');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.storePath = path.join(storageDir, 'faiss');
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small"
    });
    // Initialize immediately in constructor
    this.initialized = this.initStore();
  }

  private async initStore() {
    try {
      if (fs.existsSync(this.storePath)) {
        console.log('Loading existing vector store...');
        this.store = await FaissStore.load(this.storePath, this.embeddings);
      } else {
        console.log('Creating new vector store...');
        // Create initial store with empty texts array to avoid initialization error
        this.store = await FaissStore.fromTexts(
          [],
          [],
          this.embeddings
        );
      }
      console.log('Vector store initialized successfully');
    } catch (error) {
      console.error('Error initializing store:', error);
      throw error;
    }
  }

  async addDocument(content: string, url: string): Promise<void> {
    try {
      // Wait for initialization to complete
      await this.initialized;

      if (!this.store) {
        throw new Error('Store initialization failed');
      }

      const doc = new Document({
        pageContent: content,
        metadata: { url, timestamp: new Date().toISOString() }
      });

      await this.store.addDocuments([doc]);
      await this.store.save(this.storePath);
      console.log('Document added successfully');
    } catch (error) {
      console.error('Error in addDocument:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, k: number = 3): Promise<{ content: string, url: string, similarity: number }[]> {
    try {
      // Wait for initialization to complete
      await this.initialized;

      if (!this.store) {
        throw new Error('Store initialization failed');
      }

      const results = await this.store.similaritySearchWithScore(query, k);
      return results.map(([doc, score]) => ({
        content: doc.pageContent,
        url: doc.metadata.url,
        similarity: score
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  async generateAnswer(question: string): Promise<string> {
    try {
      // Wait for initialization to complete
      await this.initialized;

      const similarDocs = await this.searchSimilar(question, 3);
      
      if (similarDocs.length === 0) {
        return "I couldn't find any relevant information to answer your question.";
      }

      const context = similarDocs
        .map(doc => `Content: ${doc.content}\nSource: ${doc.url}`)
        .join('\n\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that answers questions based on the provided context. Only use the information from the context to answer questions. If you cannot answer the question based on the context, say so."
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer the question based on the context provided above.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content || "Sorry, I couldn't generate an answer.";
    } catch (error) {
      console.error('Error generating answer:', error);
      throw error;
    }
  }
}

// Create a single instance
const vectorStore = new VectorStore();

// Export both the class and the instance
export { VectorStore, vectorStore };