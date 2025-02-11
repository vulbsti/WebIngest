import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { vectorStore } from './vectorStore.js';
const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.use(cors());
app.use(express.json());
async function launchBrowser() {
    const retries = 3;
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await puppeteer.launch({
                headless: true, // Fixed headless option type
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions'
                ],
                timeout: 60000, // Increased timeout
            });
        }
        catch (error) {
            console.error(`Browser launch attempt ${i + 1} failed:`, error);
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw lastError;
}
// Endpoint to ingest URL content
app.post('/ingest', async (req, res) => {
    let browser;
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }
        console.log('Attempting to ingest URL:', url);
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setDefaultNavigationTimeout(60000);
        const response = await page.goto(url, {
            waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
            timeout: 60000
        });
        if (!response) {
            throw new Error('Failed to get response from the page');
        }
        const status = response.status();
        if (status >= 400) {
            throw new Error(`Page returned status code ${status}`);
        }
        const content = await page.evaluate(() => {
            try {
                const selectors = [
                    'article',
                    'main',
                    '.content',
                    '.post-content',
                    '.article-content',
                    '#content',
                    '.main-content',
                    '[role="main"]',
                    '[role="article"]'
                ];
                // Try each selector until we find content
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        return Array.from(elements)
                            .map(el => el.innerText)
                            .join('\n');
                    }
                }
                // Fallback to body content with better cleaning
                const body = document.body.cloneNode(true);
                const elementsToRemove = body.querySelectorAll('script, style, nav, header, footer, .comments, .sidebar, [role="navigation"], [role="banner"], [role="complementary"]');
                elementsToRemove.forEach(el => el.remove());
                return body.innerText;
            }
            catch (error) {
                console.error('Error in page.evaluate:', error);
                return '';
            }
        });
        if (!content) {
            throw new Error('No content could be extracted from the URL');
        }
        const cleanContent = content
            .replace(/\s+/g, ' ')
            .trim();
        if (cleanContent.length < 50) {
            throw new Error('Extracted content is too short, might indicate an extraction failure');
        }
        // Add to vector store instead of pageContents array
        await vectorStore.addDocument(cleanContent, url);
        res.json({
            success: true,
            message: 'URL content ingested and vectorized successfully',
            contentLength: cleanContent.length
        });
    }
    catch (error) {
        console.error('Error ingesting URL:', error);
        res.status(500).json({
            success: false,
            message: `Failed to ingest URL content: ${error.message}`,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
});
// Modified query endpoint to use vector store and LLM
app.post('/query', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({
                success: false,
                message: 'Question is required'
            });
        }
        const answer = await vectorStore.generateAnswer(question);
        res.json({
            success: true,
            answer
        });
    }
    catch (error) {
        console.error('Error processing question:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process question',
            error: error.message
        });
    }
});
// Modified server startup with port conflict handling
const startServer = async () => {
    try {
        await new Promise((resolve, reject) => {
            const server = app.listen(port, () => {
                console.log(`Server running at http://localhost:${port}`);
                resolve(true);
            });
            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is busy, trying ${port + 1}...`);
                    server.close();
                    app.listen(port + 1);
                }
                else {
                    reject(error);
                }
            });
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
