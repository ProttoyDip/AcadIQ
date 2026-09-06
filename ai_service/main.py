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
    description="FastAPI service serving Llama-3.1-8B-Instruct and Qwen for AcadIQ",
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

