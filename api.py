import torch
from PIL import Image
import pandas as pd
import os
import gc
import time
import spacy
import nltk
import json
import io
from collections import defaultdict
from nltk.corpus import wordnet as wn
from transformers import (
    BlipProcessor,
    BlipForConditionalGeneration,
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
)
from peft import PeftModel
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
TENSOR_FILE_PATH = "node_relation_co_occurrence_tensor.csv"
KG_FILE_PATH = "knowledge_graph_enriched.json"
LOCAL_LORA_MODEL_PATH = "t5_lora_finetune"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

print(f">> Device: {DEVICE} | Precision: {DTYPE}")

# ─────────────────────────────────────────────
# NLP SETUP
# ─────────────────────────────────────────────
for resource in ["corpora/wordnet.zip", "tokenizers/punkt", "corpora/omw-1.4"]:
    try:
        nltk.data.find(resource)
    except LookupError:
        nltk.download(resource.split("/")[-1].replace(".zip", ""))

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")


def get_wordnet_hypernym(noun):
    try:
        synsets = wn.synsets(noun, pos=wn.NOUN)
        if not synsets or not synsets[0].hypernyms():
            return None
        return synsets[0].hypernyms()[0].lemmas()[0].name().replace("_", " ")
    except Exception:
        return None


# ─────────────────────────────────────────────
# LOAD KNOWLEDGE BASES
# ─────────────────────────────────────────────
tensor_lookup_dict: defaultdict = defaultdict(list)
kg_lookup_dict: defaultdict = defaultdict(list)


def load_knowledge_bases():
    print(">> Loading Knowledge Bases...")

    if os.path.exists(TENSOR_FILE_PATH):
        try:
            df_tensor = pd.read_csv(TENSOR_FILE_PATH)
            for _, row in df_tensor.iterrows():
                triplet = f"{row['Subject']} {row['Relation']} {row['Object']}"
                tensor_lookup_dict[str(row["Subject"]).lower().strip()].append(triplet)
            print(f" - Tensor loaded: {len(df_tensor)} rows.")
        except Exception as e:
            print(f"Error loading Tensor: {e}")

    allowed_relations = ["is a", "is found at", "can", "is used for"]
    if os.path.exists(KG_FILE_PATH):
        try:
            with open(KG_FILE_PATH, "r", encoding="utf-8") as f:
                kg_data = json.load(f)
                for item in kg_data:
                    if item.get("relation") in allowed_relations:
                        triplet = f"{item['from']} {item['relation']} {item['to']}"
                        kg_lookup_dict[str(item["from"]).lower().strip()].append(triplet)
            print(" - KG JSON loaded.")
        except Exception as e:
            print(f"Error loading KG JSON: {e}")


load_knowledge_bases()

# ─────────────────────────────────────────────
# LOAD MODELS
# ─────────────────────────────────────────────
print(">> Loading Models...")

blip_processor = None
blip_model = None
try:
    blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
    blip_model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-large", torch_dtype=DTYPE
    ).to(DEVICE)
    print(" - BLIP loaded.")
except Exception as e:
    print(f"BLIP Error: {e}")

t5_model = None
t5_tokenizer = None
try:
    t5_tokenizer = AutoTokenizer.from_pretrained("t5-base")
    t5_base = AutoModelForSeq2SeqLM.from_pretrained("t5-base", torch_dtype=DTYPE)
    if os.path.exists(LOCAL_LORA_MODEL_PATH):
        t5_model = PeftModel.from_pretrained(t5_base, LOCAL_LORA_MODEL_PATH).to(DEVICE)
        t5_model.eval()
        print(" - T5 LoRA (with KG) loaded.")
    else:
        print(f"Error: LoRA path '{LOCAL_LORA_MODEL_PATH}' not found.")
except Exception as e:
    print(f"T5 Error: {e}")

# ─────────────────────────────────────────────
# INFERENCE HELPERS
# ─────────────────────────────────────────────

def get_nouns_from_caption(caption: str):
    if not caption:
        return []
    doc = nlp(str(caption).lower())
    return list(set([token.lemma_ for token in doc if token.pos_ in ["NOUN", "PROPN"]]))


def retrieve_context_graph(nouns: list) -> str:
    caption_triplets: set = set()
    for noun in nouns:
        noun_triplets = []
        if noun in tensor_lookup_dict:
            noun_triplets.extend(tensor_lookup_dict[noun][:5])
        if noun in kg_lookup_dict:
            noun_triplets.extend(kg_lookup_dict[noun][:5])
        if not noun_triplets:
            hypernym = get_wordnet_hypernym(noun)
            if hypernym:
                noun_triplets.append(f"{noun} is a {hypernym}")
        caption_triplets.update(noun_triplets)
    return ", ".join(caption_triplets) if caption_triplets else "empty"


def run_inference(image: Image.Image):
    """
    Chạy pipeline: BLIP → KG Retrieval → T5 LoRA refinement.
    Trả về dict kết quả.
    """
    if blip_model is None:
        raise RuntimeError("BLIP model not loaded.")

    start_time = time.time()

    # 1. BLIP caption
    inputs = blip_processor(image, return_tensors="pt").to(DEVICE)
    if DTYPE == torch.float16:
        inputs = {k: v.to(DTYPE) if v.dtype == torch.float32 else v for k, v in inputs.items()}

    with torch.no_grad():
        out = blip_model.generate(**inputs, max_length=50)
    blip_cap = blip_processor.decode(out[0], skip_special_tokens=True)

    # 2. KG retrieval
    nouns = get_nouns_from_caption(blip_cap)
    kg_str = retrieve_context_graph(nouns)

    # 3. T5 LoRA refinement
    final_cap = blip_cap  # fallback nếu T5 chưa load
    if t5_model is not None:
        input_text = f"refine caption: {blip_cap} <sep> graph: {kg_str}"
        inputs_t5 = t5_tokenizer(
            input_text, return_tensors="pt", max_length=512, truncation=True
        ).to(DEVICE)
        with torch.no_grad():
            outputs_t5 = t5_model.generate(
                input_ids=inputs_t5["input_ids"],
                attention_mask=inputs_t5["attention_mask"],
                max_length=60,
                min_length=5,
                num_beams=4,
                early_stopping=True,
                repetition_penalty=1.0,
                length_penalty=0.6,
            )
        final_cap = t5_tokenizer.decode(outputs_t5[0], skip_special_tokens=True)

    duration = round(time.time() - start_time, 3)

    return {
        "caption": final_cap,
        "blip_caption": blip_cap,
        "kg_context": kg_str,
        "inference_time_s": duration,
    }


# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="Image Captioning API",
    description="BLIP + Knowledge Graph + T5 LoRA captioning",
    version="1.0.0",
)

# Cho phép React Native (và bất kỳ origin nào) gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CaptionResponse(BaseModel):
    caption: str
    blip_caption: str
    kg_context: str
    inference_time_s: float


@app.get("/health")
def health_check():
    """Kiểm tra server có sống không."""
    return {
        "status": "ok",
        "blip_loaded": blip_model is not None,
        "t5_loaded": t5_model is not None,
        "device": DEVICE,
    }


@app.post("/caption", response_model=CaptionResponse)
async def caption_image(file: UploadFile = File(...)):
    """
    Nhận ảnh upload, trả về caption đã được tinh chỉnh.

    - **file**: ảnh (jpg / jpeg / png / webp)
    """
    # Validate content type
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Use jpg/png/webp.",
        )

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Giới hạn kích thước ảnh: 20 MB
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 20 MB.")

    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot decode image file.")

    try:
        result = run_inference(image)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    return result


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" để điện thoại trong cùng mạng LAN có thể truy cập
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)
