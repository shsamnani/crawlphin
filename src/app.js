require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors"); // For frontend-backend communication
const urlRoutes = require("./routes/urlRoutes");
const { setupWorker, setSocketIoInstance } = require("./services/queueService");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL, // Frontend app origin
    methods: ["GET", "POST"],
  },
});

// Set the Socket.IO instance for the queue service to use
setSocketIoInstance(io);

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/urls", urlRoutes);

// Start BullMQ worker in the same process (for simplicity, consider separate processes for production)
setupWorker();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`Redis Host: ${process.env.REDIS_HOST}`);
});
