const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const apiRoutes = require("./routes");
const notFoundMiddleware = require("./common/middlewares/not-found.middleware");
const errorMiddleware = require("./common/middlewares/error.middleware");

const app = express();

function resolveCorsOptions() {
  if (env.corsOrigins === "*") {
    return {
      origin: true,
      credentials: true
    };
  }

  const allowList = new Set(env.corsOrigins);
  return {
    origin(origin, callback) {
      if (!origin || allowList.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed."));
    },
    credentials: true
  };
}

app.use(cors(resolveCorsOptions()));
app.use(helmet());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json({ limit: env.bodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.bodyLimit }));
app.use("/uploads", (req, res, next) => {
  // Local HTML pages load profile media from a different origin, so allow browsers to render it.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Midnight Backend is running."
  });
});

app.use(env.apiPrefix, apiRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
