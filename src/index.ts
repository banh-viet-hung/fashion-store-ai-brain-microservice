import "dotenv/config";
import app, { initializeAgent } from "./server";

const PORT = process.env.PORT || 4444;

async function startServer() {
    try {
        // Initialize agent
        await initializeAgent();

        // Start the server
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api/chat`);
            console.log(`Web UI available at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer().catch(console.error); 