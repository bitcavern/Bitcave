import { pipeline, env } from '@xenova/transformers';

export class EmbeddingService {
  private embedder: any;

  async initialize() {
    // Configure for local model caching
    env.localURL = './models/';
    env.allowRemoteModels = false;

    // Initialize the embedding pipeline
    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { pooling: 'mean', normalize: true }
    );
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const output = await this.embedder(text);
    return output.data;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
    // Process in batches for efficiency
    const embeddings = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }
}
