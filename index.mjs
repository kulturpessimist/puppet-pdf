import Koa from "koa";
import r from "koa-route";
import { v4 } from "uuid";
import puppeteer from "puppeteer";
import { addMinutes, isBefore } from "date-fns";

import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha512";

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

// SECTION Middlewares
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
    console.error("[puppet] ERROR: ", err.message);
  }
});

app.use(async (ctx, next) => {
  if (process.env.USE_SIGNED_LINKS && ctx.request.path === "/pdf") {
    const { sig, url, exp } = ctx.request.query;
    if (sig && url && exp) {
      const mac = hmac(sha512, process.env.HMAC_KEY, exp + "|" + url);
      if (Buffer.from(mac).toString("base64url") === sig) {
        if (isBefore(new Date(), new Date(exp))) {
          await next();
        } else {
          ctx.body = `
          <!DOCTYPE html>
<html class="bg-base-300">
  <head>
    <meta charset="utf-8">
    <title>Puppet</title>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@2.24.0/dist/full.css" rel="stylesheet" type="text/css" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
		<div class="mockup-code m-24">
      <pre data-prefix="$"><code>puppet pdf --url ${url}</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code> Checking link and signature...</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-error"> ERROR: Link expired.</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-warning"> Please collect a new link in the application of origin.</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-error"> Exit with status 410 </code></pre>
    </div>
  </body>
</html>`;
        }
      } else {
        ctx.body = `
          <!DOCTYPE html>
<html class="bg-base-300">
  <head>
    <meta charset="utf-8">
    <title>Puppet</title>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@2.24.0/dist/full.css" rel="stylesheet" type="text/css" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
		<div class="mockup-code m-24">
      <pre data-prefix="$"><code>puppet pdf --url ${url}</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code> Checking link and signature...</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-error"> ERROR: Signature mismatch.</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-warning"> Please collect a new link in the application of origin.</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-error"> Exit with status 403 </code></pre>
    </div>
  </body>
</html>`;
      }
    } else {
      ctx.body = `
          <!DOCTYPE html>
<html class="bg-base-300">
  <head>
    <meta charset="utf-8">
    <title>Puppet</title>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@2.24.0/dist/full.css" rel="stylesheet" type="text/css" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
		<div class="mockup-code m-24">
      <pre data-prefix="$"><code>puppet pdf --url ${url}</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code> Checking link and signature...</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-error"> ERROR: Parameter mismatch.</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-warning"> Please collect a new link in the application of origin.</code></pre> 
      <pre data-prefix=">"><code>[puppet]</code><code class="text-error"> Exit with status 400 </code></pre>
    </div>
  </body>
</html>`;
    }
  } else {
    await next();
  }
});

// SECTION Routes
app.use(
  r.all("/", async (ctx) => {
    ctx.body = `
          <!DOCTYPE html>
<html class="bg-base-300">
  <head>
    <meta charset="utf-8">
    <title>Puppet</title>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@2.24.0/dist/full.css" rel="stylesheet" type="text/css" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
		<div class="mockup-code m-24">
      <pre data-prefix="$"><code>puppet --version</code></pre> 
      <pre data-prefix=">"><code>Usage: puppet pdf [options] </code></pre> 
      <pre data-prefix=">"><code> </code></pre> 
      <pre data-prefix=">"><code>  Options:</code></pre> 
      <pre data-prefix=">"><code> </code></pre> 
      <pre data-prefix=">"><code>  --url https://... ........ URL to generate the PDF from.</code></pre> 
      <pre data-prefix=">"><code>  --sig .................... Signature for the request to run.</code></pre> 
      <pre data-prefix=">"><code>  --exp .................... ISO Date String when the Link expires.</code></pre> 
      <pre data-prefix=">"><code> </code></pre> 
      <pre data-prefix=">"><code>Version ${process.env.npm_package_version}</code></pre>      
    </div>
  </body>
</html>`;
  })
);

app.use(
  r.all("/pdf", async (ctx) => {
    // TODO: TOKEN check process.env.TOKEN
    const url = ctx.request.query.url || "https://pptr.dev";
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
      width: "21cm",
      height: "29cm",
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
  })
);

// signing

app.use(
  r.all("/_hmac", async (ctx) => {
    const url =
      ctx.request.query.url ||
      "https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string";
    const d = addMinutes(
      new Date(),
      parseInt(ctx.request.query.min || 30, 10)
    ).toISOString();
    const mac = hmac(sha512, process.env.HMAC_KEY, d + "|" + url);

    ctx.body = `?sig=${Buffer.from(mac).toString(
      "base64url"
    )}&exp=${d}&url=${url}`;
  })
);

app.use(
  r.all("/_c", async (ctx) => {
    const { sig, url, exp } = ctx.request.query;

    if (sig && url && exp) {
      const mac = hmac(sha512, process.env.HMAC_KEY, exp + "|" + url);

      //console.log(Buffer.from(mac).toString("base64url"), "===", sig);

      if (Buffer.from(mac).toString("base64url") === sig) {
        //console.log(isBefore(new Date(), new Date(exp)));

        if (isBefore(new Date(), new Date(exp))) {
          ctx.body = "ok";
        } else {
          ctx.body = "Link expired";
        }
      } else {
        ctx.body = "fail";
      }
    } else {
      ctx.body = "fail";
    }
  })
);

app.listen(process.env.PORT || 3033, "0.0.0.0", async () => {
  console.info(`puppet-pdf started`);
});
