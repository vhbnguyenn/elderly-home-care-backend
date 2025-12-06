# ai_semantic_service.py
# FastAPI service for semantic similarity using PhoBERT
# Run: uvicorn ai_semantic_service:app --host 0.0.0.0 --port 8001

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import torch
from transformers import AutoTokenizer, AutoModel

app = FastAPI()

# Load PhoBERT model and tokenizer
MODEL_NAME = "vinai/phobert-base"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)
model.eval()

def get_sentence_embedding(sentence: str):
    # Tokenize and get embeddings
    input_ids = torch.tensor([tokenizer.encode(sentence, add_special_tokens=True)])
    with torch.no_grad():
        features = model(input_ids)
        embeddings = features[0].mean(dim=1).squeeze()
    return embeddings

def cosine_similarity(vec1, vec2):
    return torch.nn.functional.cosine_similarity(vec1.unsqueeze(0), vec2.unsqueeze(0)).item()

class SimilarityRequest(BaseModel):
    sentence1: str
    sentence2: str

class BatchSimilarityRequest(BaseModel):
    sentence: str
    candidates: List[str]

@app.post("/similarity")
def compute_similarity(req: SimilarityRequest):
    emb1 = get_sentence_embedding(req.sentence1)
    emb2 = get_sentence_embedding(req.sentence2)
    score = cosine_similarity(emb1, emb2)
    return {"similarity": float(score)}

@app.post("/batch_similarity")
def batch_similarity(req: BatchSimilarityRequest):
    emb1 = get_sentence_embedding(req.sentence)
    results = []
    for cand in req.candidates:
        emb2 = get_sentence_embedding(cand)
        score = cosine_similarity(emb1, emb2)
        results.append(float(score))
    return {"similarities": results}

@app.get("/")
def root():
    return {"message": "PhoBERT Semantic Similarity Service is running."}
