import Koa from "koa";
import r from "koa-route";
import { v4 } from "uuid";
import puppeteer from "puppeteer";

const app = new Koa();

// middlewares

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set("X-Response-Time", `${ms}ms`);
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.statusCode || err.status || 500;
    ctx.body = { status: ctx.status, error: err.name, message: err.message };
    console.error("[puppeteer.app] ERROR: ", err.message);
  }
});

app.use(
  r.all("/", async (ctx) => {
    ctx.body = "Hello World";
  })
);

app.use(
  r.all("/pdf", async (ctx) => {
    // TODO: TOKEN check process.env.TOKEN
    const url = ctx.request.query.url || "https://www.schedler.pro";
    const download = "download" in ctx.request.query || false;
    //
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle0",
    });
    // get config from meta tags of target site
    // the meta tags must have a name starting with "puppet:"
    const texts = await page.evaluate(() => {
      const namespace = "puppet";
      return [...document.querySelectorAll(`meta[name^=${namespace}\\:]`)].map(
        (element) => {
          return { key: element.name.split(":")[1], value: element.content };
        }
      );
    });
    const cfg = {};
    texts.forEach((text) => {
      try {
        cfg[text.key] = JSON.parse(text.value);
      } catch (e) {
        cfg[text.key] = text.value;
      }
    });
    //
    const DefaultPDFOptions = {
      scale: 1,
      displayHeaderFooter: false,
      headerTemplate: "",
      footerTemplate: "",
      printBackground: false,
      landscape: false,
      pageRanges: "1-1",
      format: "",
      width: "10cm",
      height: "10cm",
      preferCSSPageSize: false,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      omitBackground: false,
      timeout: 30 * 1000,
    };

    download ? ctx.response.attachment(`${cfg.filename || v4()}.pdf`) : "";
    const pdfStream = await page.createPDFStream({
      ...DefaultPDFOptions,
      ...cfg,
    });
    pdfStream.on("end", async () => {
      await browser.close();
    });
    ctx.body = pdfStream;
    console.info(`${url} delivered with cfg`, {
      ...DefaultPDFOptions,
      ...cfg,
    });
  })
);

app.listen(process.env.PORT || 3033, "0.0.0.0", async () => {
  console.info(`puppet-pdf started`);
});
