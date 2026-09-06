import os
import torch
import transformers
from typing import List, Dict, Any, Optional

MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen2.5-7B-Instruct")
HF_TOKEN = os.getenv("HF_TOKEN", None)

class LlamaModelWrapper:
    def __init__(self):
        self.pipeline = None
        self.model_id = MODEL_ID

    def load_model(self):
        if self.pipeline is not None:
            return

        print(f"Loading model: {self.model_id}...")

        # Device detection: CUDA -> MPS (Apple Silicon) -> CPU
        if torch.cuda.is_available():
            device_map = "auto"
            torch_dtype = torch.bfloat16
            print("Using CUDA device")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device_map = "mps"
            torch_dtype = torch.float16
            print("Using Apple Silicon MPS device")
        else:
            device_map = "cpu"
            torch_dtype = torch.float32
            print("Using CPU device")

        kwargs: Dict[str, Any] = {
            "torch_dtype": torch_dtype,
            "device_map": device_map,
        }

        if HF_TOKEN:
            kwargs["token"] = HF_TOKEN

        self.pipeline = transformers.pipeline(
            "text-generation",
            model=self.model_id,
            model_kwargs={"torch_dtype": torch_dtype},
            device_map=device_map,
            token=HF_TOKEN if HF_TOKEN else None,
        )
        print(f"Model {self.model_id} loaded successfully!")

    def generate(
        self,
        messages: List[Dict[str, str]],
        max_new_tokens: int = 512,
        temperature: float = 0.2,
    ) -> str:
        if self.pipeline is None:
            self.load_model()

        # Format chat prompt using model's chat template
        outputs = self.pipeline(
            messages,
            max_new_tokens=max_new_tokens,
            temperature=max(temperature, 0.01),
            do_sample=temperature > 0.01,
        )

        generated_text = outputs[0]["generated_text"]
        if isinstance(generated_text, list):
            # Output format: [{"role": ..., "content": ...}, ...]
            return generated_text[-1].get("content", "")
        return str(generated_text)


# Singleton instance
llama_runner = LlamaModelWrapper()
