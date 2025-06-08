# RAG Agent with LangGraph

This project implements a Retrieval Augmented Generation (RAG) system with LangChain and LangGraph, using Google's Gemini models.

## Features

- **RAG System**: Fetches and indexes blog content for AI retrieval
- **Intelligent Agent**: Uses LangGraph's ReAct framework to make reasoning decisions
- **Stateful Chat**: Maintains conversation context across interactions
- **Multi-step Reasoning**: Can perform multiple retrieval steps for complex queries

## Prerequisites

- Node.js (v16 or higher)
- Google AI API key (Gemini models)

## Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your Google API key:

```
GOOGLE_API_KEY=your_google_api_key_here
```

## Project Structure

```
├── src/
│   ├── agent.ts         # Agent implementation using LangGraph
│   ├── data-processor.ts # Data loading and processing for RAG
│   ├── index.ts         # Main application entry point
│   ├── models.ts        # LLM and Embedding model initialization
│   └── tools.ts         # Retrieval tool definition
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Data Indexing**: Downloads and processes blog content from Lilian Weng
2. **Vector Storage**: Creates embeddings and stores them in a vector database
3. **Agent Configuration**: Sets up a ReAct agent with retrieval capability
4. **Query Processing**: Takes user questions and determines:
   - If direct response is possible
   - When retrieval is needed
   - How to formulate good retrieval queries
   - When to perform multiple retrievals for complex questions

## Running the Application

```bash
npm start
```

This will:
1. Check for the API key
2. Load and process the blog data
3. Create the RAG agent
4. Run several example queries

## Example Queries

The system will demonstrate:
- Simple greeting response
- Basic retrieval query
- Follow-up query (using conversation context)
- Complex multi-step query

## Implementation Details

- Uses Google's Gemini 2.5 Flash for the chat model
- Uses Google's text-embedding-004 for embeddings
- Implements ReAct agent pattern via LangGraph
- Uses MemoryVectorStore for vector storage
- Maintains state with LangGraph's MemorySaver 