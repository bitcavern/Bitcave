import { pipeline, env } from "@xenova/transformers";

export class EmbeddingService {
  private embedder: any;
  private static readonly EMBEDDING_DIMENSION = 384;

  async initialize() {
    try {
      // Configure for local model caching
      env.cacheDir = "./models/";
      env.allowRemoteModels = true;

      // Initialize the embedding pipeline
      console.log("[EmbeddingService] Initializing embedding model...");
      this.embedder = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
      console.log(
        "[EmbeddingService] Embedding model initialized successfully"
      );
    } catch (error) {
      console.error(
        "[EmbeddingService] Failed to initialize embedding model:",
        error
      );
      throw error;
    }
  }

  private l2Normalize(vector: Float32Array): Float32Array {
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) sumSquares += vector[i] * vector[i];
    const norm = Math.sqrt(sumSquares) || 1;
    if (Math.abs(norm - 1) < 1e-6) return vector; // already normalized
    const out = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) out[i] = vector[i] / norm;
    return out;
  }

  private meanPool(
    flattened: Float32Array,
    tokenCount: number,
    dim: number
  ): Float32Array {
    const pooled = new Float32Array(dim);
    for (let token = 0; token < tokenCount; token++) {
      const base = token * dim;
      for (let i = 0; i < dim; i++) pooled[i] += flattened[base + i];
    }
    for (let i = 0; i < dim; i++) pooled[i] /= tokenCount;
    return pooled;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.embedder) {
      throw new Error("Embedding service not initialized");
    }

    const input = (text ?? "").trim();

    try {
      // Ask the pipeline to do the right thing: mean pooling + normalization.
      // This should return a single 384-d vector for a single string input.
      const output: any = await this.embedder(input.length ? input : " ", {
        pooling: "mean",
        normalize: true,
      });

      // Primary path: expect a typed array of 384 dims
      if (output?.data && ArrayBuffer.isView(output.data)) {
        const data = output.data as
          | Float32Array
          | Float64Array
          | Int32Array
          | Uint8Array;

        // If dims are provided, respect them for pooling/selection
        const dims: number[] | undefined = Array.isArray(output.dims)
          ? (output.dims as number[])
          : undefined;

        // Case 1: Already a single vector of expected dimension
        if (!dims && data.length === EmbeddingService.EMBEDDING_DIMENSION) {
          return data instanceof Float32Array
            ? data
            : new Float32Array(data as ArrayBufferView as any);
        }

        // Case 2: dims === [hidden] or [1, hidden]
        if (
          dims &&
          (dims.length === 1 || (dims.length === 2 && dims[0] === 1))
        ) {
          const hidden = dims[dims.length - 1];
          if (hidden !== EmbeddingService.EMBEDDING_DIMENSION) {
            throw new Error(`Unexpected embedding size from model: ${hidden}`);
          }
          return data instanceof Float32Array
            ? data.slice(0, hidden)
            : new Float32Array(
                (data as ArrayBufferView).buffer,
                (data as ArrayBufferView).byteOffset,
                hidden
              );
        }

        // Case 3: dims === [seq_len, hidden] (no pooling applied by pipeline)
        if (dims && dims.length === 2) {
          const [seqLen, hidden] = dims;
          if (hidden !== EmbeddingService.EMBEDDING_DIMENSION) {
            throw new Error(`Unexpected embedding size from model: ${hidden}`);
          }
          if (data.length !== seqLen * hidden) {
            throw new Error(
              `Tensor size mismatch: expected ${seqLen * hidden}, got ${
                data.length
              }`
            );
          }
          const pooled = this.meanPool(data as Float32Array, seqLen, hidden);
          return this.l2Normalize(pooled);
        }

        // Case 4: No dims but length is a multiple of hidden -> infer tokens and mean-pool
        const dim = EmbeddingService.EMBEDDING_DIMENSION;
        if (!dims && data.length > dim && data.length % dim === 0) {
          const tokens = data.length / dim;
          const pooled = this.meanPool(data as Float32Array, tokens, dim);
          return this.l2Normalize(pooled);
        }

        // As a last resort, if we somehow got an unexpected single vector length and it's close, fail fast
        throw new Error(
          `Unexpected embedding output shape/length: ${
            data.length
          }, dims=${JSON.stringify(dims)}`
        );
      }

      throw new Error("Embedding pipeline returned unsupported output format");
    } catch (error) {
      console.error("[EmbeddingService] Failed to generate embedding:", error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
    // For simplicity and stability, call the single-text path per item.
    // If we need higher throughput later, we can switch to batched calls and reshape using dims [batch, hidden].
    const embeddings: Float32Array[] = [];
    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text));
    }
    return embeddings;
  }
}
