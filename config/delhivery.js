const axios = require("axios");

const DELHIVERY_TOKEN = "XXXXXXXXXXXXXXXXXX"; // HARD CODE

const delhiveryRequest = axios.create({
  headers: {
    Authorization: `Token ${DELHIVERY_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

module.exports = { delhiveryRequest };
