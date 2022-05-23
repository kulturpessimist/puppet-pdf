import Koa from "koa";
import r from "koa-route";
import { v4 } from "uuid";
import puppeteer from "puppeteer";

/*
                                                           
           ,ggg,        gg                                 
          dP""Y8b       dP                                 
          Yb, `88      d8'                                 
           `"  88    ,dP'                                  
               88aaad8"                                    
               88""""Yb,      ,ggggg,    ,gggg,gg          
               88     "8b    dP"  "Y8gggdP"  "Y8I          
               88      `8i  i8'    ,8I i8'    ,8I          
               88       Yb,,d8,   ,d8',d8,   ,d8b,         
               88        Y8P"Y8888P"  P"Y8888P"`Y8         
                                                           
*/

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
    ctx.body = `Version ${process.env.npm_package_version}`;
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
    const metaTags = await page.evaluate(() => {
      const namespace = "puppet";
      return [...document.querySelectorAll(`meta[name^=${namespace}\\:]`)].map(
        (element) => {
          return { key: element.name.split(":")[1], value: element.content };
        }
      );
    });
    const cfg = {};
    metaTags.forEach((tag) => {
      try {
        // try to eval the content...
        cfg[tag.key] = JSON.parse(tag.value);
      } catch (e) {
        // in case of error use the content as it is...
        cfg[tag.key] = tag.value;
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
    ctx.set("Content-Type", "application/pdf");
    ctx.body = pdfStream;
    /* console.info(`${url} delivered with cfg`, {
      ...DefaultPDFOptions,
      ...cfg,
    }); */
  })
);

app.listen(process.env.PORT || 3033, "0.0.0.0", async () => {
  console.info(`puppet-pdf started`);
});
