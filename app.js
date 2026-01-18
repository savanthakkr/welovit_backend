const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
require("dotenv").config();

const indexRouter = require("./routes/index");
const userRouter = require("./routes/user");
const adminRouter = require("./routes/admin");

const apiResponse = require("./vars/apiResponse");
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");
const { setupSocket } = require("./config/socket");

const app = express();

/* ===============================
   LOGGER
================================ */
if (process.env.NODE_ENV !== "test") {
  app.use(logger("dev"));
}

/* ===============================
   SERVER & SOCKET
================================ */
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

setupSocket(io);

/* ===============================
   BODY PARSER (🔥 CORRECT)
   JSON ONLY — NO multipart
================================ */
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("multipart/form-data")) {
    return next(); // Multer will handle this
  }

  express.json({ limit: "50mb" })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ===============================
   COMMON MIDDLEWARE
================================ */
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

/* ===============================
   STATIC FILES
================================ */
app.use("/apiService", express.static(path.join(__dirname, "Assets", "Evidence")));
app.use("/userProfile", express.static(path.join(__dirname, "Assets", "profilePicture")));
app.use("/productImages", express.static(path.join(__dirname, "Assets", "Products")));

/* ===============================
   ROUTES
================================ */
app.use("/", indexRouter);
app.use("/user", userRouter);
app.use("/admin", adminRouter);

/* ===============================
   404
================================ */
app.all("*", (req, res) => {
  return apiResponse.notFoundResponse(res, "Page not found");
});

/* ===============================
   ERROR HANDLER (🔥 FIXED)
================================ */
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);

  if (err.name === "UnauthorizedError") {
    return apiResponse.unauthorizedResponse(res, err.message);
  }

  if (err.type === "entity.parse.failed") {
    return apiResponse.badRequestResponse(res, "Invalid request body");
  }

  return apiResponse.internalServerErrorResponse(
    res,
    "Internal server error"
  );
});

/* ===============================
   EXPORT
================================ */
module.exports = { app, server };
