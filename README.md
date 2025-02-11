# Web Content Q&A Tool

A web-based tool that allows users to ingest web content from URLs and ask questions about the content using AI-powered search and natural language processing.

## Features

- Input multiple URLs to analyze
- Extract and process content from web pages
- Vector-based semantic search using FAISS
- OpenAI-powered content understanding and question answering
- Clean and intuitive user interface

## Architecture

The application uses a modern tech stack with several key components:

### Backend
- **Express.js Server**: Handles HTTP requests and coordinates between components
- **Puppeteer**: Extracts content from web pages
- **FAISS Vector Store**: Enables efficient similarity search for relevant content
- **OpenAI Integration**: 
  - Uses `text-embedding-ada-002` for content vectorization
  - Uses `gpt-4o-turbo` for generating natural language answers

### Frontend
- React + TypeScript + Vite for a responsive single-page application
- Simple and intuitive UI for URL ingestion and querying

## Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- OpenAI API key

## Installation

1. Clone the repository
2. Install all dependencies:
```bash
npm run install:all
```

3. Configure OpenAI API:
   - Create a `.env` file in the `backend` directory
   - Add your OpenAI API key:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

## Running the Application

1. Start the backend server (in one terminal):
```bash
npm run dev:backend
```

2. Start the frontend development server (in another terminal):
```bash
npm run dev:frontend
```

3. Open your browser and navigate to the URL shown in the frontend terminal (typically http://localhost:5173)

## Managing the Application

### Starting the Application

1. **Start both frontend and backend together**:
```bash
npm run dev
```

2. **Start services individually**:
   - Backend only: `npm run dev:backend`
   - Frontend only: `npm run dev:frontend`

### Stopping the Application

1. **Stop all services**:
```bash
npm run stop
```

2. **Stop individual services**:
   - Backend only: `npm run stop:backend`
   - Frontend: Press `Ctrl+C` in the terminal running the frontend

### Restarting the Backend

If you need to restart the backend server:
```bash
npm run restart:backend
```

### Troubleshooting

1. **Port Already in Use**
   - The server will automatically try the next available port
   - You can manually stop the existing process with `npm run stop:backend`

2. **"Failed to Ingest URL" Error**
   - Check if the URL is accessible in your browser
   - Verify your OpenAI API key is correctly set in `.env`
   - Check the backend logs for detailed error messages

3. **Application Not Responding**
   - Stop all services using `npm run stop`
   - Start the application again with `npm run dev`

4. **Vector Store Issues**
   - If you experience issues with the vector store, you can reset it by:
     1. Stop the backend server
     2. Delete the `vector_store.idx` file in the backend directory
     3. Restart the server

## Usage

1. Enter a URL in the input field and click "Add URL" to ingest its content
   - The content will be extracted and vectorized for semantic search
   - Vectors are stored locally using FAISS

2. Type your question in the question field
   - The system will search for relevant content using semantic similarity
   - OpenAI's GPT model will generate a natural language answer based on the found content

## How It Works

1. **Content Ingestion**:
   - URLs are processed using Puppeteer to extract main content
   - Content is cleaned and preprocessed
   - OpenAI's embedding model converts text to vectors
   - Vectors are stored in a FAISS index for efficient similarity search

2. **Question Answering**:
   - User questions are converted to vectors
   - FAISS finds the most relevant content
   - GPT model generates a natural answer using the found content as context

## Technical Details

- **Vector Storage**: Uses FAISS for efficient similarity search
- **Embeddings**: OpenAI's ada-002 model (1536-dimensional vectors)
- **Answer Generation**: GPT-4o-mini with context-aware prompting
- **Persistence**: FAISS index is saved to disk for persistence between restarts

## Error Handling

- Graceful handling of port conflicts
- Retries for browser launch failures
- Proper error messages for API key issues
- Validation of extracted content quality