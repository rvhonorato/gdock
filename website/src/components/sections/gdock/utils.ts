export type JobMode = "score" | "dock" | "capri";

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Chunked file reader for large files
export async function readFileAsTextChunked(file: File, chunkSize: number = 10 * 1024 * 1024): Promise<string> {
  if (file.size <= chunkSize) {
    // For small files, use the regular method
    return readFileAsText(file);
  }

  let result = '';
  let offset = 0;
  const totalSize = file.size;

  while (offset < totalSize) {
    const chunk = file.slice(offset, offset + chunkSize);
    const chunkText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(chunk);
    });
    
    result += chunkText;
    offset += chunkSize;
  }

  return result;
}

export async function readFileAsArrayBufferChunked(file: File, chunkSize: number = 10 * 1024 * 1024): Promise<ArrayBuffer> {
  if (file.size <= chunkSize) {
    // For small files, use the regular method
    return readFileAsArrayBuffer(file);
  }

  const chunks: ArrayBuffer[] = [];
  let offset = 0;
  const totalSize = file.size;

  while (offset < totalSize) {
    const chunk = file.slice(offset, offset + chunkSize);
    const chunkBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });
    
    chunks.push(chunkBuffer);
    offset += chunkSize;
  }

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let position = 0;
  
  for (const chunk of chunks) {
    result.set(new Uint8Array(chunk), position);
    position += chunk.byteLength;
  }

  return result.buffer;
}

// Streaming file processor for very large files
export async function processLargeFileInChunks(
  file: File,
  chunkSize: number = 10 * 1024 * 1024,
  processChunk: (chunk: string, chunkIndex: number) => void
): Promise<void> {
  let offset = 0;
  const totalSize = file.size;
  let chunkIndex = 0;

  while (offset < totalSize) {
    const chunk = file.slice(offset, offset + chunkSize);
    const chunkText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(chunk);
    });
    
    processChunk(chunkText, chunkIndex);
    chunkIndex++;
    offset += chunkSize;
  }
}
