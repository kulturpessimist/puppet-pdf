import { ofetch } from "ofetch";

const TOKEN = process.env.SCALINGO_TOKEN;

const { token } = await ofetch("https://auth.scalingo.com/v1/tokens/exchange", {
  method: "POST",
  headers: [
    ["Accept", "application/json"],
    ["Content-Type", "application/json"],
    ["Authorization", "Basic " + Buffer.from(":" + TOKEN).toString("base64")],
  ],
});

const response = await ofetch.raw(
  "https://api.osc-fr1.scalingo.com/v1/apps/puppet-pdf/restart",
  {
    method: "POST",
    headers: [["Authorization", "Bearer " + token]],
  }
);

if (response.status === 202) {
  console.log("OK, Service restarted.");
} else {
  console.error("Error, Service _not_ restarted");
}
