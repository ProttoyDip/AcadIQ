import os
import time
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from model import llama_runner, MODEL_ID
from dual_evaluator import run_dual_evaluation

load_dotenv()

app = FastAPI(
    title="AcadIQ AI Microservice",
    description="FastAPI service serving Open-Access Evaluation Models (Qwen 2.5, Phi 3.5, Mistral & LLoRA 7B) for AcadIQ",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Schemas matching OpenAI Chat Completion Specs
class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: system, user, or assistant")
    content: str = Field(..., description="Message text content")


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = Field(default=MODEL_ID)
    messages: List[ChatMessage]
    temperature: Optional[float] = Field(default=0.2, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=512, ge=1, le=4096)
    response_format: Optional[Dict[str, Any]] = None


class SimpleAnalyzeRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.2


class DualEvaluationRequest(BaseModel):
    question: str
    max_marks: float = 10.0
    model_answer: str
    student_answer: str


@app.on_event("startup")
async def startup_event():
    print(f"Starting AcadIQ AI Microservice serving {MODEL_ID}")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AcadIQ AI Microservice",
        "model_id": MODEL_ID,
        "model_loaded": llama_runner.pipeline is not None,
    }


@app.post("/v1/chat/completions")
def chat_completions(req: ChatCompletionRequest):
    """
    OpenAI-compatible Chat Completions Endpoint
    Consumed directly by AcadIQ backend (llmClient.ts).
    """
    try:
        messages_dict = [{"role": m.role, "content": m.content} for m in req.messages]
        
        assistant_content = llama_runner.generate(
            messages=messages_dict,
            max_new_tokens=req.max_tokens or 512,
            temperature=req.temperature if req.temperature is not None else 0.2,
        )

        return {
            "id": f"chatcmpl-llama31-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": req.model or MODEL_ID,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": assistant_content,
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": -1,
                "completion_tokens": -1,
                "total_tokens": -1,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Llama model generation failed: {str(e)}",
        )


@app.post("/v1/dual-evaluate")
def dual_evaluate(req: DualEvaluationRequest):
    """
    Dual-LLM (Llama 3.1 + Qwen) Evaluation Endpoint
    Evaluates student answer, generates rubric scores, marks, and consensus report.
    """
    try:
        result = run_dual_evaluation(
            question=req.question,
            max_marks=req.max_marks,
            model_answer=req.model_answer,
            student_answer=req.student_answer,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dual LLM evaluation failed: {str(e)}",
        )


@app.post("/analyze")
def analyze(req: SimpleAnalyzeRequest):
    """
    Simplified direct analysis endpoint
    """
    try:
        messages = [
            {"role": "system", "content": req.system_prompt},
            {"role": "user", "content": req.user_prompt},
        ]
        result_text = llama_runner.generate(
            messages=messages,
            max_new_tokens=req.max_tokens or 512,
            temperature=req.temperature or 0.2,
        )
        return {"status": "success", "result": result_text}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)


# =============================================================================
# Fine-Tuning Management Endpoints (70% Train / 30% Val Split)
# =============================================================================
class FineTuneTrainRequest(BaseModel):
    model_id: Optional[str] = "Qwen/Qwen2.5-7B-Instruct"
    epochs: Optional[int] = 3
    batch_size: Optional[int] = 2
    learning_rate: Optional[float] = 2e-4


@app.post("/v1/finetune/prepare-dataset")
def prepare_dataset():
    """
    Builds and exports the BeSTRaP & OS instruction dataset with 70/30 split.
    """
    try:
        from finetuning.dataset_builder import build_and_save_datasets
        manifest = build_and_save_datasets()
        return {"status": "success", "manifest": manifest}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset build failed: {str(e)}",
        )


@app.post("/v1/finetune/train")
def train_model(req: FineTuneTrainRequest):
    """
    Triggers LoRA / PEFT fine-tuning using the 70% training split.
    """
    try:
        from finetuning.finetune_trainer import run_fine_tuning
        summary = run_fine_tuning(
            model_id=req.model_id or "Qwen/Qwen2.5-7B-Instruct",
            epochs=req.epochs or 3,
            batch_size=req.batch_size or 2,
            learning_rate=req.learning_rate or 2e-4,
        )
        return {"status": "success", "data": summary}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fine-tuning failed: {str(e)}",
        )


@app.get("/v1/finetune/metrics")
def get_evaluation_metrics():
    """
    Retrieves evaluation benchmark metrics against the 30% holdout validation dataset.
    """
    try:
        from finetuning.evaluate_finetuned import evaluate_on_holdout_set
        report = evaluate_on_holdout_set()
        return {"status": "success", "data": report}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation metrics retrieval failed: {str(e)}",
        )


@app.get("/v1/finetune/status")
def get_finetune_status():
    """
    Returns current status of fine-tuned adapters and dataset manifest.
    """
    adapter_dir = os.getenv("FINETUNED_ADAPTERS_DIR", "finetuned_adapters")
    data_dir = os.getenv("FINETUNING_DATA_DIR", "data")
    
    config_file = os.path.join(adapter_dir, "adapter_config.json")
    history_file = os.path.join(adapter_dir, "training_history.json")
    manifest_file = os.path.join(data_dir, "manifest.json")

    has_adapter = os.path.exists(config_file)
    adapter_config = {}
    training_history = {}
    manifest = {}

    if has_adapter:
        try:
            with open(config_file, "r") as f:
                adapter_config = json.load(f)
        except Exception:
            pass

    if os.path.exists(history_file):
        try:
            with open(history_file, "r") as f:
                training_history = json.load(f)
        except Exception:
            pass

    if os.path.exists(manifest_file):
        try:
            with open(manifest_file, "r") as f:
                manifest = json.load(f)
        except Exception:
            pass

    return {
        "status": "ready" if has_adapter else "uninitialized",
        "has_adapter": has_adapter,
        "adapter_config": adapter_config,
        "training_history": training_history,
        "dataset_manifest": manifest,
    }
