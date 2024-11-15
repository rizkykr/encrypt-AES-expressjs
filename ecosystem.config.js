module.exports = {
  apps: [
    {
      name: "absensienc:7097",
      exec_mode: "cluster",
      instances: "max",
      script: "index.js",
      args: "start",
      port: 7097,
    },
  ],
};
