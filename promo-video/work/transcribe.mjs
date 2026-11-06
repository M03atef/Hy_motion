import { pipeline } from '@huggingface/transformers';
import wavefile from 'wavefile';
import fs from 'fs';
const asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', { dtype: 'q8' });
const files = process.argv.slice(2);
for (const f of files) {
  const w = new wavefile.WaveFile(fs.readFileSync(f)); w.toBitDepth('32f');
  let s = w.getSamples(); if (Array.isArray(s)) s = s[0];
  const out = await asr(new Float32Array(s), { language: 'arabic', task: 'transcribe', return_timestamps: true, chunk_length_s: 30 });
  console.log('### ' + f + '\n' + out.text + '\n' + JSON.stringify(out.chunks));
}
