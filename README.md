# 🧠 PDF Chat Backend

This is the backend for the PDF Chat application. It handles user authentication, folder and PDF management, metadata enrichment, and integration with Qdrant for vector search. 

It works together with the frontend and a background worker to provide real-time, folder-based PDF chat.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory and define the following variables:

```env
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/postgres"
PORT=8000
JWT_SECRET=mysecret
BUCKET_NAME=pdf-chat-harshit
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=pdf_embeddings
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=your-openai-api-key
```

DATABASE_URL: PostgreSQL connection string.

PORT: Port to run the backend server.

JWT_SECRET: Secret key used for JWT-based authentication.

BUCKET_NAME: Google Cloud Storage bucket where PDFs are stored.

QDRANT_URL: URL of the Qdrant vector database.

QDRANT_COLLECTION: Name of the Qdrant collection to use.

REDIS_HOST & REDIS_PORT: Redis instance for pub/sub and job queuing.

OPENAI_API_KEY: API key to generate embeddings via OpenAI.

☁️ Google Cloud Storage Setup
Place your Google Cloud service account key in the project root as cloud-key.json.

How to get cloud-key.json:
Go to Google Cloud Console.

Select your project or create a new one.

Navigate to IAM & Admin > Service Accounts.

Create a service account and grant it access to Cloud Storage.

Generate a JSON key and download it — save this as cloud-key.json in the root directory.

🚀 Getting Started

```bash
git clone https://github.com/harshit2786/pdf-chat-be.git
cd pdf-chat-be
npm install
npm run dev
```

Make sure PostgreSQL, Redis, Qdrant, and your Google Cloud bucket are properly set up and running.

📦 Related Repositories
🖼 Frontend: https://github.com/harshit2786/pdf-chat-fe

⚙️ Worker: https://github.com/harshit2786/pdf-chat-worker