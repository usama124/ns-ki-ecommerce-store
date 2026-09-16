import ffmpeg from 'fluent-ffmpeg';

export async function compressVideoFile(
  inputPath: string,
  outputPath: string,
): Promise<{ success: boolean; outputPath?: string }> {
  return new Promise((resolve) => {
    try {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-crf 24',
          '-preset fast',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart',
          "-vf scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease",
        ])
        .output(outputPath)
        .on('end', () => {
          resolve({ success: true, outputPath })
        })
        .on('error', (err: Error) => {
          console.warn(
            '[VideoCompression] ffmpeg error, falling back to original video:',
            err.message,
          )
          resolve({ success: false })
        })
        .run()
    } catch (error) {
      console.warn('[VideoCompression] Failed to execute ffmpeg:', error)
      resolve({ success: false })
    }
  })
}
