const AppError = require("../AppError");
const { Prisma } = require("@prisma/client");

function errorMiddleware(error, req, res, next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Unique constraint failed.",
        details: error.meta || null
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Record not found."
      });
    }

    if (error.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Invalid relational reference."
      });
    }
  }

  if (error && (error.type === "entity.too.large" || error.status === 413)) {
    return res.status(413).json({
      success: false,
      message: "Uploaded image is too large. Please choose a smaller file."
    });
  }

  console.error("[UNHANDLED_ERROR]", error);
  return res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
}

module.exports = errorMiddleware;
