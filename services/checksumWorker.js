import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';

class ChecksumWorkerPool {
  constructor(maxWorkers = 3) {
    this.maxWorkers = maxWorkers;
    this.workers = [];
    this.queue = [];
    this.activeJobs = new Map();
  }

  calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const job = { filePath, resolve, reject };
      this.queue.push(job);
      this.processQueue();
    });
  }

  processQueue() {
    if (this.queue.length === 0 || this.workers.length >= this.maxWorkers) {
      return;
    }

    const job = this.queue.shift();
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { filePath: job.filePath },
    });

    this.workers.push(worker);
    this.activeJobs.set(worker, job);

    worker.on('message', result => {
      if (result.success) {
        job.resolve(result.checksum);
      } else {
        job.reject(new Error(result.error));
      }
      this.cleanupWorker(worker);
    });

    worker.on('error', error => {
      job.reject(error);
      this.cleanupWorker(worker);
    });

    worker.on('exit', code => {
      if (code !== 0) {
        const activeJob = this.activeJobs.get(worker);
        if (activeJob) {
          activeJob.reject(new Error(`Worker stopped with exit code ${code}`));
        }
      }
      this.cleanupWorker(worker);
    });
  }

  cleanupWorker(worker) {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }
    this.activeJobs.delete(worker);

    this.processQueue();
  }

  async close() {
    const promises = this.workers.map(
      worker =>
        new Promise(resolve => {
          worker.terminate().then(resolve).catch(resolve);
        })
    );
    await Promise.all(promises);
    this.workers = [];
    this.activeJobs.clear();
  }
}

let ChecksumWorkerPoolExport;

if (isMainThread) {
  ChecksumWorkerPoolExport = ChecksumWorkerPool;
} else {
  const { filePath } = workerData;

  const calculateChecksum = targetFilePath =>
    new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(targetFilePath);

      stream.on('data', chunk => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', reject);
    });

  calculateChecksum(filePath)
    .then(checksum => {
      parentPort.postMessage({ success: true, checksum });
    })
    .catch(error => {
      parentPort.postMessage({ success: false, error: error.message });
    });
}

export default ChecksumWorkerPoolExport;
