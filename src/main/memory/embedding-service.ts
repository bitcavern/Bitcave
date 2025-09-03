import { pipeline, env } from "@xenova/transformers";

export class EmbeddingService {
  private embedder: any;

  async initialize() {
    try {
      // Configure for local model caching
      env.cacheDir = "./models/";
      env.allowRemoteModels = false;

      // Initialize the embedding pipeline
      console.log("[EmbeddingService] Initializing embedding model...");
      this.embedder = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      console.log(
        "[EmbeddingService] Embedding model initialized successfully",
      );
    } catch (error) {
      console.error(
        "[EmbeddingService] Failed to initialize embedding model:",
        error,
      );
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.embedder) {
      throw new Error("Embedding service not initialized");
    }
    try {
      const output = await this.embedder(text);
      return output.data;
    } catch (error) {
      console.error("[EmbeddingService] Failed to generate embedding:", error);
      throw error;
    }
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
