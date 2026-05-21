const os = require('os');
const { execSync } = require('child_process');
const readline = require('readline');

class StatsMonitor {
  constructor() {
    this.currentLLM = 'None';
    this.device = 'N/A';
    this.deviceName = 'Detecting...';
    this.tokensPerSecond = 0;
    this.cpuLoad = 0;
    this.ramUsage = 0;
    this.gpuLoad = 0;
    this.isUpdating = false;
    this.interval = null;
    this.lastRenderTime = 0;
    this.storeInfo = '';
    
    this.spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.spinnerIndex = 0;

    // Initialize CPU times
    this.lastCpuSample = this.cpuAverage();
  }

  cpuAverage() {
    const cpus = os.cpus();
    if (!cpus || cpus.length === 0) return { idle: 0, total: 0 };
    let idleMs = 0;
    let totalMs = 0;
    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      for (const type in cpu.times) {
        totalMs += cpu.times[type];
      }
      idleMs += cpu.times.idle;
    }
    return { idle: idleMs, total: totalMs };
  }

  async start() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    // Reset metrics for new run
    this.currentLLM = 'None';
    this.device = 'N/A';
    this.tokensPerSecond = 0;

    // Fetch device name once
    try {
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        this.deviceName = cpus[0].model.replace(/\(R\)|\(TM\)/g, '').trim();
      } else {
        this.deviceName = 'Unknown Device';
      }
    } catch (e) {
      this.deviceName = 'Unknown Device';
    }

    this.updateStats();
    this.interval = setInterval(() => this.updateStats(), 1000);
  }

  stop() {
    this.isUpdating = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  setStoreInfo(info) {
    this.storeInfo = info;
  }

  async updateStats() {
    try {
      // Calculate CPU load
      const currentSample = this.cpuAverage();
      const idleDiff = currentSample.idle - this.lastCpuSample.idle;
      const totalDiff = currentSample.total - this.lastCpuSample.total;
      this.cpuLoad = totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0;
      this.lastCpuSample = currentSample;

      // Calculate RAM usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      this.ramUsage = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;

      // GPU usage for macOS (Apple Silicon fallback)
      if (process.platform === 'darwin') {
        try {
          const ioregOutput = execSync('ioreg -l | grep "PerformanceStatistics"', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
          const match = ioregOutput.match(/"Device Utilization %"=(\d+)/);
          if (match) {
            this.gpuLoad = parseInt(match[1]);
          } else {
            this.gpuLoad = 0;
          }
        } catch (e) {
          this.gpuLoad = 0;
        }
      } else {
        this.gpuLoad = 0;
      }

      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
      this.render();
    } catch (err) {
      // Quietly fail
    }
  }

  setLLMMetrics(model, device, tps = 0) {
    this.currentLLM = model;
    this.device = device;
    this.tokensPerSecond = tps;
    this.render();
  }

  getSummaryString() {
    const deviceLabel = this.currentLLM === 'None' ? '' : ` | 🤖 ${this.currentLLM} (${this.device}) ⚡ ${this.tokensPerSecond.toFixed(1)} t/s`;
    return `💻 ${this.deviceName}${deviceLabel} | CPU: ${this.cpuLoad.toFixed(1)}% | RAM: ${this.ramUsage.toFixed(1)}% | GPU: ${this.gpuLoad.toFixed(1)}%`;
  }

  render() {
    const now = Date.now();
    const throttleTime = 100; // Live render throttle

    if (now - this.lastRenderTime < throttleTime) return;
    this.lastRenderTime = now;

    // Standard ANSI colors
    const magenta = (str) => `\x1b[35m${str}\x1b[0m`;
    const cyan = (str) => `\x1b[36m${str}\x1b[0m`;
    const yellow = (str) => `\x1b[33m${str}\x1b[0m`;
    const gray = (str) => `\x1b[90m${str}\x1b[0m`;
    const white = (str) => `\x1b[37m${str}\x1b[0m`;
    const bold = (str) => `\x1b[1m${str}\x1b[22m`;

    const cpuColor = (val) => val > 80 ? `\x1b[31m${val}\x1b[0m` : (val > 50 ? `\x1b[33m${val}\x1b[0m` : `\x1b[32m${val}\x1b[0m`);
    const ramColor = (val) => val > 80 ? `\x1b[31m${val}\x1b[0m` : (val > 50 ? `\x1b[33m${val}\x1b[0m` : `\x1b[32m${val}\x1b[0m`);
    const gpuColor = (val) => val > 80 ? `\x1b[31m${val}\x1b[0m` : (val > 50 ? `\x1b[33m${val}\x1b[0m` : `\x1b[32m${val}\x1b[0m`);

    const deviceNameLabel = magenta(`💻 ${this.deviceName}`);
    const llmInfo = cyan(`🤖 ${bold(this.currentLLM)} (${this.device})`);
    
    let tpsText = '';
    if (this.tokensPerSecond === 0 && this.currentLLM !== 'None') {
      tpsText = yellow(`⚡ ${this.spinnerFrames[this.spinnerIndex]} t/s`);
    } else {
      tpsText = yellow(`⚡ ${this.tokensPerSecond.toFixed(1)} t/s`);
    }

    const stats = [
      `${white('CPU:')} ${cpuColor(this.cpuLoad.toFixed(1) + '%')}`,
      `${white('RAM:')} ${ramColor(this.ramUsage.toFixed(1) + '%')}`,
      `${white('GPU:')} ${gpuColor(this.gpuLoad.toFixed(1) + '%')}`
    ].join(gray(' | '));

    const line = `  ${this.storeInfo}  ${gray('┃')}  ${deviceNameLabel}  ${gray('┃')}  ${llmInfo}  ${tpsText}  ${gray('┃')}  ${stats}`;

    if (process.stdout.isTTY) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(line);
      readline.clearLine(process.stdout, 1);
    } else {
      process.stdout.write('\r' + line + '\x1b[K');
    }
  }
}

const monitor = new StatsMonitor();
module.exports = monitor;
