"""
services/vision.py — Gemini vision analysis (soil + disease)
"""
import os
import base64
import json
import google.generativeai as genai

GEMINI_MODEL = "gemini-3.6-flash"


def _configure():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Missing GEMINI_API_KEY")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(GEMINI_MODEL)


async def analyze_soil_image(base64_image: str, mime_type: str = "image/jpeg") -> dict:
    try:
        model = _configure()
        prompt = """
You are an expert agronomist AI. I am providing you with an image of a soil sample or farm field.
First, analyze if the image actually contains soil, earth, or a farm field.
If it is a human face, an indoor scene without soil, or any irrelevant image, respond STRICTLY with:
{"isInvalid": true}

If it IS a valid soil or field image, analyze the visual characteristics of the soil (color, texture, moisture appearance) and estimate the following properties.
Respond STRICTLY in the following JSON format, and nothing else. Do not use markdown blocks.
{
  "soilType": "string (one of: black, red, alluvial, laterite, sandy, loamy, clay)",
  "N": "number (Nitrogen in mg/kg, typical range 10-140)",
  "P": "number (Phosphorus in mg/kg, typical range 5-145)",
  "K": "number (Potassium in mg/kg, typical range 10-200)",
  "pH": "number (pH level, typical range 4.5-9.0)"
}

If you are unsure but the image is clearly soil, provide the closest educated guess for a typical Indian farm soil.
"""
        image_data = {"mime_type": mime_type, "data": base64.b64decode(base64_image)}
        response = model.generate_content(
            [prompt, image_data],
            generation_config={"response_mime_type": "application/json"}
        )
        text = response.text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(text)
        if parsed.get("isInvalid"):
            raise ValueError("image is invalid cannot be used for soil detection")
        return parsed
    except ValueError:
        raise
    except Exception as exc:
        print(f"[Vision/Soil] Error: {exc}")
        raise exc


async def analyze_disease_image(base64_image: str, mime_type: str = "image/jpeg") -> dict:
    try:
        model = _configure()
        prompt = """
You are an expert agronomist and plant pathologist AI. I am providing you with an image of a crop leaf.
Please analyze the visual characteristics to identify any pests, diseases, or deficiencies.

Respond STRICTLY in the following JSON format, and nothing else. Do not use markdown blocks.
{
  "diseaseName": "string (Name of the disease or pest, or 'Healthy' if none)",
  "confidence": "number (0-100 representing confidence percentage)",
  "description": "string (Brief description of the symptoms and potential causes)",
  "organicTreatments": ["string", "string"],
  "chemicalTreatments": ["string", "string"],
  "preventativeMeasures": ["string", "string"]
}

If you are unsure, provide your best educated guess while strictly adhering to the JSON format.
"""
        image_data = {"mime_type": mime_type, "data": base64.b64decode(base64_image)}
        response = model.generate_content(
            [prompt, image_data],
            generation_config={"response_mime_type": "application/json"}
        )
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as exc:
        print(f"[Vision/Disease] Error: {exc}")
        raise exc
