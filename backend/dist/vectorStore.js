import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
// Set up require for faiss-node
const require = createRequire(import.meta.url);
let Faiss;
try {
    Faiss = require('faiss-node');
}
catch (error) {
    console.error('Error loading faiss-node:', error);
    process.exit(1);
}
// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
class VectorStore {
    index;
    documents;
    dimension;
    indexPath;
    dataPath;
    constructor() {
        this.documents = [];
        this.dimension = 1536; // OpenAI ada-002 embedding dimension
        const storageDir = path.join(process.cwd(), 'storage');
        // Ensure storage directory exists
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        this.indexPath = path.join(storageDir, 'vector_store.idx');
        this.dataPath = path.join(storageDir, 'documents.json');
        this.initializeIndex();
        this.loadDocuments();
    }
    initializeIndex() {
        try {
            if (fs.existsSync(this.indexPath)) {
                console.log('Loading existing FAISS index from:', this.indexPath);
                this.index = Faiss.readIndex(this.indexPath);
                console.log('Successfully loaded existing FAISS index');
            }
            else {
                console.log('Creating new FAISS index');
                // Using IndexFlatIP for cosine similarity (normalized vectors)
                this.index = new Faiss.IndexFlatIP(this.dimension);
                Faiss.writeIndex(this.index, this.indexPath);
                console.log('Successfully created and saved new FAISS index');
            }
        }
        catch (error) {
            console.error('Error initializing FAISS index:', error);
            console.log('Creating new index as fallback');
            this.index = new Faiss.IndexFlatIP(this.dimension);
        }
    }
    loadDocuments() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf8');
                this.documents = JSON.parse(data);
                console.log(`Loaded ${this.documents.length} documents from storage`);
            }
        }
        catch (error) {
            console.error('Error loading documents:', error);
            this.documents = [];
        }
    }
    saveDocuments() {
        try {
            fs.writeFileSync(this.dataPath, JSON.stringify(this.documents, null, 2));
            console.log('Documents saved to storage');
        }
        catch (error) {
            console.error('Error saving documents:', error);
        }
    }
    normalizeVector(vector) {
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map(val => val / magnitude);
    }
    async addDocument(content, url) {
        try {
            const embedding = await this.getEmbedding(content);
            const normalizedEmbedding = this.normalizeVector(embedding);
            const doc = {
                id: this.documents.length,
                content,
                url,
                embedding: normalizedEmbedding,
            };
            this.documents.push(doc);
            // Add normalized embedding to the index
            const vectorMatrix = new Float32Array(normalizedEmbedding);
            this.index.add(vectorMatrix);
            // Save both index and documents
            Faiss.writeIndex(this.index, this.indexPath);
            this.saveDocuments();
            console.log('Document added and all data saved successfully');
        }
        catch (error) {
            console.error('Error adding document:', error);
            throw error;
        }
    }
    async getEmbedding(text) {
        try {
            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: text,
            });
            return response.data[0].embedding;
        }
        catch (error) {
            console.error('Error getting embedding:', error);
            throw error;
        }
    }
    async searchSimilar(query, k = 3) {
        try {
            const queryEmbedding = await this.getEmbedding(query);
            const normalizedQueryEmbedding = this.normalizeVector(queryEmbedding);
            // Convert to Float32Array for FAISS
            const queryVector = new Float32Array(normalizedQueryEmbedding);
            // Perform search
            const { labels, distances } = this.index.search(queryVector, k);
            // Map results to documents
            return labels.map((idx) => ({
                content: this.documents[idx].content,
                url: this.documents[idx].url,
                similarity: distances[idx] // Cosine similarity score
            }));
        }
        catch (error) {
            console.error('Error searching documents:', error);
            throw error;
        }
    }
    async generateAnswer(query) {
        try {
            const similarDocs = await this.searchSimilar(query, 3);
            const context = similarDocs.map(doc => `Content from ${doc.url} (similarity: ${doc.similarity.toFixed(3)}):\n${doc.content}`).join('\n\n');
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that answers questions based on the provided context. Always reference the source URLs when using information from them."
                    },
                    {
                        role: "user",
                        content: `Context:\n${context}\n\nQuestion: ${query}\n\nPlease provide a detailed answer based on the context above, citing the sources used:`
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            });
            return response.choices[0].message.content || "Sorry, I couldn't generate an answer.";
        }
        catch (error) {
            console.error('Error generating answer:', error);
            throw error;
        }
    }
}
export const vectorStore = new VectorStore();
