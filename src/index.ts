import "dotenv/config";
import app, { initializeAgents } from "./server";

const PORT = process.env.PORT || 4444;

async function main() {
    try {
        // Initialize the LangChain agent
        await initializeAgents();

        // Start the server
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api/chat`);
            console.log(`Web UI available at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start the application:", error);
        process.exit(1);
    }
}

main(); 