import type { UploadJob } from './types';

export interface MediaStore {
  getById(id: string): Promise<UploadJob | null>;
  getByIdempotencyKey(key: string): Promise<UploadJob | null>;
  save(job: UploadJob): Promise<void>;
}

export function createMemoryMediaStore(): MediaStore {
  const jobs = new Map<string, UploadJob>();
  const keys = new Map<string, string>();
  return {
    async getById(id) { return jobs.get(id) ?? null; },
    async getByIdempotencyKey(key) {
      const id = keys.get(key);
      return id ? jobs.get(id) ?? null : null;
    },
    async save(job) {
      jobs.set(job.id, job);
      keys.set(job.idempotencyKey, job.id);
    },
  };
}
