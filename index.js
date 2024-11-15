//MODULE
require("dotenv").config();
const express = require("express");
const compression = require("compression");
var CryptoJS = require("crypto-js");
const morgan = require("morgan");
const socketBytes = new Map();

//APP
const app = express();
const port = 7097;

function prettySize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log2(bytes) / 10), sizes.length - 1);
  const size = (bytes / 2 ** (i * 10)).toFixed(i ? 1 : 0);
  return `${size} ${sizes[i]}`;
}

function getSocketProgress(socket) {
  const currBytesRead = socket.bytesRead;
  const prevBytesRead = socketBytes.get(socket)?.prevBytesRead ?? 0;
  socketBytes.set(socket, { prevBytesRead: currBytesRead });
  return prettySize((currBytesRead - prevBytesRead) / 1024, " ");
}

app.disable("x-powered-by");
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use((req, res, next) => {
  req.socketProgress = getSocketProgress(req.socket);
  next();
});

app.get("/", (req, res) => {
  res.send("App: theres nothing u can do right here :)");
});

app.post("/api/enc", async (req, res) => {
  const secretKey = process.env.SECRET_KEY;
  const size = req.socketProgress;
  console.log("Processing: " + size);
  let content = req.body.string;
  var JsonFormatter = {
    stringify: function ({ ciphertext, iv, salt }) {
      const result = { ct: ciphertext.toString(CryptoJS.enc.Base64) };
      if (iv) result.iv = iv.toString();
      if (salt) result.s = salt.toString();
      return JSON.stringify(result);
    },
    parse: function (jsonStr) {
      const { ct, iv, s } = JSON.parse(jsonStr);
      return {
        ciphertext: CryptoJS.enc.Base64.parse(ct),
        iv: iv && CryptoJS.enc.Hex.parse(iv),
        salt: s && CryptoJS.enc.Hex.parse(s),
      };
    },
  };
  var encrypted = await CryptoJS.AES.encrypt(content, secretKey, {
    format: JsonFormatter,
  }).toString();
  console.log((encrypted != null ? "Success" : "Failed") + " Encrypt: " + size);
  const data = {
    status: encrypted != null,
    message: "Encryption " + (encrypted != null ? "Success" : "Failed"),
    data: encrypted,
  };
  res.end(JSON.stringify(data, null, 2));
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
