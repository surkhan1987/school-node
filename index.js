const cors = require("cors");
require('dotenv').config();
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const api = require("./routers/api");
const files = require("./routers/files");
const auth = require("./routers/auth");

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use("/api", api);
app.use("/files", files);
app.use("/auth", auth);

const start = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("database connected");
    app.listen(process.env.PORT, () => console.log("started on " + process.env.PORT));
  } catch (e) {
    console.log(e);
  }
};
start();
