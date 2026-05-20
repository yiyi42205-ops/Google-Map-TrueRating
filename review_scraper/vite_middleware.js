import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const statsMonitor = require('../stats_monitor.cjs');

export function scraperMiddleware(req, res, next) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  if (req.method === 'POST' && urlObj.pathname === '/api/scrape') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { url, maxReviews } = JSON.parse(body);
        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing required field: url' }));
        }

        const limit = parseInt(maxReviews, 10) || 50;

        // Determine python executable path (prefer local virtualenv if present)
        let pythonPath = 'python3';
        const localVenvPython = path.join(process.cwd(), 'review_scraper', 'venv', 'bin', 'python');
        if (fs.existsSync(localVenvPython)) {
          pythonPath = localVenvPython;
        }

        const scriptPath = path.join(process.cwd(), 'review_scraper', 'scraper.py');
        console.log(`[Scraper API] Starting scrape: ${pythonPath} ${scriptPath} "${url}" ${limit}`);
        
        const pyProcess = spawn(pythonPath, [scriptPath, url, limit.toString()]);
        
        let stdoutData = '';
        let stderrData = '';

        pyProcess.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });

        pyProcess.stderr.on('data', (data) => {
          stderrData += data.toString();
        });

        pyProcess.on('close', (code) => {
          console.log(`[Scraper API] Python process exited with code ${code}`);
          
          if (code !== 0) {
            console.error(`[Scraper API] Error output: ${stderrData}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Scraper failed to run', details: stderrData }));
          }

          try {
            // Find the JSON block in the stdout (in case python prints other debug logs)
            const jsonStartIdx = stdoutData.indexOf('[');
            const jsonObjectStartIdx = stdoutData.indexOf('{');
            
            let jsonStr = '';
            if (jsonStartIdx !== -1 && (jsonObjectStartIdx === -1 || jsonStartIdx < jsonObjectStartIdx)) {
              jsonStr = stdoutData.substring(jsonStartIdx);
            } else if (jsonObjectStartIdx !== -1) {
              jsonStr = stdoutData.substring(jsonObjectStartIdx);
            } else {
              jsonStr = stdoutData.trim();
            }

            const parsedData = JSON.parse(jsonStr);
            
            if (parsedData.error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: parsedData.error }));
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reviews: parsedData }));
          } catch (parseError) {
            console.error(`[Scraper API] Failed to parse stdout to JSON:`, parseError);
            console.error(`[Scraper API] Raw stdout:`, stdoutData);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Failed to parse scraper output', 
              details: parseError.message,
              rawOutput: stdoutData 
            }));
          }
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request body', details: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/audit-local') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { reviews } = JSON.parse(body);
        if (!reviews || !Array.isArray(reviews)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing or invalid required field: reviews' }));
        }

        const prompt = `你是一個專門分析 Google Maps 虛假/灌水/刷好評評論的 AI 安全專家。\n請審查以下給定的評論列表（為 JSON 陣列，每筆包含星等 stars、評論 text、發表時間距今 daysElapsed、是否屬於密集發表期 isSpikePeriod 等特徵資訊）。\n\n【審查指引與洗評判定標準】：\n1. 【利益促銷】：觀察評論是否提及「打卡、評論、五星、好評、免費送、招待、活動」等利益交換詞，且文風有敷衍或流水線寫作痕跡。\n2. 【情感真實度】：極度誇張的讚美（如：全台最好吃、一生推、無懈可擊）但沒有任何具體說明，通常是買評工作室的灌水套話。\n3. 【描述具體度】：真實評論通常會提及具體餐點（如：雞白湯拉麵、起司球）、環境特色（如：好停車、店貓可愛）或排隊等待時間。空洞的好評（如：美味、便宜、讚、推薦）很可疑。\n4. 【時序脈絡】：如果評論在評論密度暴增期（isSpikePeriod為true）發出，且 daysElapsed 天數很接近，表示有極高機率是集中宣傳期的打卡或刷評活動。\n\n請務必強制輸出 JSON 陣列，每一筆對應輸入的評論，欄位包含：\n- username: 評論者名稱\n- isWashed: 是否為洗評或利益交換評論 (true/false)\n- reasoningPath: 強制先寫出你的分析思路與推理過程 (CoT 思維鏈)\n- reason: 最終判定洗評或乾淨口碑的簡短說明字串\n- incentiveIntensity: 利益交換強度 (1-5 分，5為最強烈有打卡送小菜等痕跡)\n- sentimentAuthenticity: 情感表達真實度 (1-5 分，5為最真誠，1為最空洞虛假)\n- descriptionGranularity: 描述具體細緻度 (1-5 分，5為極具體描繪餐點細節，1為極敷衍無細節)\n- issueType: 洗評類型分類 ("incentive" 利益誘因 / "template" 空洞模板 / "discrepancy" 語意割裂 / "none" 乾淨評論)\n\n待審查評論數據：\n${JSON.stringify(reviews, null, 2)}`;

        const postData = JSON.stringify({
          model: 'gemma4:e4b',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          options: {
            temperature: 0.1
          },
          format: 'json',
          stream: false
        });

        const options = {
          hostname: '127.0.0.1',
          port: 11434,
          path: '/api/chat',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const prefix = `[Web UI] 正在分析 ${reviews.length} 則評論...`;
        statsMonitor.setStoreInfo(prefix);
        statsMonitor.start();
        statsMonitor.setLLMMetrics('gemma4:e4b', 'Local (Ollama)', 0);
        const startTime = Date.now();

        const ollamaReq = http.request(options, (ollamaRes) => {
          let data = '';
          ollamaRes.on('data', (chunk) => {
            data += chunk;
          });
          ollamaRes.on('end', () => {
            statsMonitor.stop();
            if (process.stdout.isTTY) {
              const readline = require('readline');
              readline.cursorTo(process.stdout, 0);
              readline.clearLine(process.stdout, 0);
            } else {
              process.stdout.write('\r\x1b[K');
            }

            try {
              const responseJson = JSON.parse(data);
              if (!responseJson.message || !responseJson.message.content) {
                throw new Error('Invalid response structure from Ollama: ' + data);
              }
              
              let contentStr = responseJson.message.content.trim();
              
              // Strip markdown fences
              if (contentStr.startsWith('```')) {
                contentStr = contentStr.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
              }
              
              // Extract JSON array or object using regex
              const arrayMatch = contentStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
              if (arrayMatch) {
                contentStr = arrayMatch[0];
              } else {
                const objMatch = contentStr.match(/\{\s*[\s\S]*\}/);
                if (objMatch) {
                  contentStr = objMatch[0];
                }
              }
              
              let parsedContent = JSON.parse(contentStr);
              
              // Normalize array
              if (!Array.isArray(parsedContent)) {
                if (parsedContent.reviews && Array.isArray(parsedContent.reviews)) {
                  parsedContent = parsedContent.reviews;
                } else if (parsedContent.results && Array.isArray(parsedContent.results)) {
                  parsedContent = parsedContent.results;
                } else {
                  const arrayKey = Object.keys(parsedContent).find(k => Array.isArray(parsedContent[k]));
                  if (arrayKey) {
                    parsedContent = parsedContent[arrayKey];
                  } else {
                    throw new Error('Model did not return a JSON array of audited reviews.');
                  }
                }
              }
              
              const durationSec = Math.max(0.1, (Date.now() - startTime) / 1000);
              const estimatedTokens = data.length / 4;
              statsMonitor.setLLMMetrics('gemma4:e4b', 'Local (Ollama)', estimatedTokens / durationSec);
              const summary = statsMonitor.getSummaryString();
              console.log(`${prefix} 完成 (${summary})`);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ results: parsedContent }));
            } catch (err) {
              console.error('[Ollama API] Failed to parse response:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to parse local Ollama response', details: err.message, raw: data }));
            }
          });
        });

        ollamaReq.on('error', (err) => {
          statsMonitor.stop();
          if (process.stdout.isTTY) {
            const readline = require('readline');
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0);
          } else {
            process.stdout.write('\r\x1b[K');
          }
          console.error('[Ollama API] Connection error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to connect to local Ollama service', details: err.message }));
        });

        ollamaReq.write(postData);
        ollamaReq.end();
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request body', details: err.message }));
      }
    });
    return;
  }

  next();
}
