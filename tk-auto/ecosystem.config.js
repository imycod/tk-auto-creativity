module.exports = {
  apps: [
    {
      name: "tk-auto",
      script: "./dist/main.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};