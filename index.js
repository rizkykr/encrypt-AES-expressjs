//MODULE
require("dotenv").config();
const express = require("express");
const compression = require("compression");
var CryptoJS = require("crypto-js");
const morgan = require("morgan");
const { safeDestr } = require("destr");
const socketBytes = new Map();

//APP
const app = express();
const port = 7097;

function prettySize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log2(bytes) / 10), sizes.length - 1);
  const size = (bytes / 2 ** (i * 10)).toFixed(i ? 1 : 0);
  return `${size} ${sizes[i] ?? "Bit"}`;
}

function getSocketProgress(socket) {
  const currBytesRead = socket.bytesRead;
  const prevBytesRead = socketBytes.get(socket)?.prevBytesRead ?? 0;
  socketBytes.set(socket, { prevBytesRead: currBytesRead });
  return prettySize((currBytesRead - prevBytesRead) / 1024, " ");
}

var JsonFormatter = {
  stringify: function ({ ciphertext, iv, salt }) {
    const result = { ct: ciphertext.toString(CryptoJS.enc.Base64) };
    if (iv) result.iv = iv.toString();
    if (salt) result.s = salt.toString();
    return JSON.stringify(result);
  },
  parse: function (jsonStr) {
    const { ct, iv, s } = safeDestr(jsonStr);
    return {
      ciphertext: CryptoJS.enc.Base64.parse(ct),
      iv: iv && CryptoJS.enc.Hex.parse(iv),
      salt: s && CryptoJS.enc.Hex.parse(s),
    };
  },
};

app.disable("x-powered-by");
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use((req, res, next) => {
  req.socketProgress = getSocketProgress(req.socket);
  next();
});
const key = process.env.SECRET_KEY;

app.get("/", (req, res) => {
  res.send("App: theres nothing u can do right here :)");
});

function doAES(vl, size, mode = "enc", res) {
  const start = performance.now();
  console.log("Payload Size: " + size);
  let rtrn;
  try {
    const f = CryptoJS.AES[mode == "enc" ? "encrypt" : "decrypt"](vl, key, {
      format: JsonFormatter,
    }).toString(mode != "enc" ? CryptoJS.enc.Utf8 : null);
    const end = performance.now();
    console.log(`CryptoJS Time: ${(end - start).toFixed(2)}ms`);
    rtrn = {
      status: f != null,
      message:
        `${mode == "enc" ? "En" : "De"}cryption ` +
        (f != null ? "Success" : "Failed"),
      data: f,
    };
  } catch (err) {
    rtrn = { status: false, message: err.message, data: "" };
  }
  res.setHeader("Content-Type", "application/json");
  return res.status(rtrn.status ? 200 : 400).end(JSON.stringify(rtrn, null, 2));
}

app.post("/api/:mode", (req, res) => {
  return doAES(req.body.string, req.socketProgress, req.params.mode, res);
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
