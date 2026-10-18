import { Injectable, OnModuleDestroy } from "@nestjs/common";
import puppeteer, { type Browser } from "puppeteer";

/**
 * One shared headless Chromium instance for every PDF-rendering feature
 * (invoices, online-return slips, ...). Launching Chromium is slow (~1-2s)
 * and memory-heavy, so a second feature needing a browser must inject this
 * instead of booting its own -- the live EC2 box this runs on is a t3.micro
 * with very little headroom for a second Chromium process.
 */
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private browserPromise: Promise<Browser> | null = null;

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    }
    return this.browserPromise;
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      await (await this.browserPromise).close();
    }
  }

  /** Renders HTML to a PDF buffer. `emulatePrint` applies the page's `@media print` rules (e.g. hiding a "Download PDF" button) before rendering. */
  async renderHtmlToPdf(html: string, options: { emulatePrint?: boolean } = {}): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      if (options.emulatePrint) await page.emulateMediaType("print");
      const buffer = await page.pdf({
        format: "a4",
        printBackground: true,
        margin: { top: "16px", bottom: "16px", left: "16px", right: "16px" },
      });
      return Buffer.from(buffer);
    } finally {
      await page.close();
    }
  }
}
