# Audio credits

The CC BY recordings are credited in the footer (`audio.credits` in `js/config.js`). Keep that
credit line if you keep the files.

| File | Source | Author | Licence | Edits |
|---|---|---|---|---|
| `background-audio.mp3` | `background-audio.mpeg`, supplied by the family | Not yet recorded | Not yet recorded | Loudness normalised (−16 LUFS), 0.4 s fade-in, 1.5 s fade-out, stereo 112 kbps MP3. Plays from the seal tap, looping |
| `shankh.mp3` | [Conch shell.ogg](https://commons.wikimedia.org/wiki/File:Conch_shell.ogg), Wikimedia Commons | David Bolton | [CC BY 2.5](https://creativecommons.org/licenses/by/2.5/) | Leading silence trimmed, loudness normalised, 0.45 s fade-out, MP3. Plays only when the hero's conch is tapped |
| `shehnai.mp3` | [Veena And Shenai (Antti Luode).mp3](https://commons.wikimedia.org/wiki/File:Veena_And_Shenai_(Antti_Luode).mp3), Wikimedia Commons | Antti Luode | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | No longer played (replaced by `background-audio.mp3`). Credit it again if it comes back |

If the background track needs a credit, add it to `audio.credits` in both languages.

## Ulu (ululation)

No suitably licensed recording was found. The best source is the family itself: ask two or three
relatives to do an ulu together, record it on a phone in a quiet room, then:

```bash
python -c "import imageio_ffmpeg,subprocess,sys; subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',sys.argv[1],'-af','silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5','-ac','1','-b:a','96k','assets/audio/ulu.mp3'])" path/to/recording.m4a
```

and set `audio.tracks.ulu.src` to `"assets/audio/ulu.mp3"` in `js/config.js`. Keep it under 6 seconds.
