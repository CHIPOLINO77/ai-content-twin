import os
from pathlib import Path

class Transcriber:
    _model = None

    @classmethod
    def _load_model(cls):
        if cls._model is None:
            from faster_whisper import WhisperModel
            model_size = os.getenv("WHISPER_MODEL", "base")
            device = os.getenv("WHISPER_DEVICE", "cpu")
            compute = os.getenv("WHISPER_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")
            cls._model = WhisperModel(model_size, device=device, compute_type=compute)
        return cls._model

    @classmethod
    def transcribe(cls, path: str) -> str:
        model = cls._load_model()
        segments, _ = model.transcribe(str(Path(path)), vad_filter=True)
        return " ".join(segment.text.strip() for segment in segments if segment.text.strip())
