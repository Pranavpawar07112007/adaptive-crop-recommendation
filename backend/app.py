"""
app.py — Full Python FastAPI Backend
======================================
Replaces the Node.js server.js entirely.
Handles: auth, ML prediction, AI analysis, weather, market, vision, subsidies, profile, history.

Run with:  python app.py
"""

import os
import json
import random
import traceback
import math
from typing import Optional, Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from supabase import create_client, Client

# ── Load env ──────────────────────────────────────────────────────────────────
load_dotenv()

# ── Services ──────────────────────────────────────────────────────────────────
from model_pipeline import CropPredictor
from services.weather import get_weather, get_climate_forecast
from services.geo import reverse_geocode
from services.pest_rules import evaluate_risk
from services.ai_service import get_comprehensive_analysis, parse_voice_input, get_ai_fertilizer_plan
from services.subsidy import get_dynamic_subsidies
from services.market import get_dynamic_market_prices, fetch_raw_mandi_records
from services.vision import analyze_soil_image, analyze_disease_image

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Adaptive Crop Recommendation — Python Backend",
    version="3.0",
    description="Full Python FastAPI backend replacing the Node.js server.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── ML Predictor (singleton) ─────────────────────────────────────────────────
predictor = CropPredictor()

# ── SHAP Engine (ported from shapEngine.js) ───────────────────────────────────
def shap_calculate(inputs: dict, top_crop: str, training_data: list) -> dict:
    crop_name = (top_crop or "default").lower()
    target = {
        "N": [40, 80], "P": [40, 60], "K": [20, 40],
        "temperature": [20, 30], "humidity": [50, 70],
        "ph": [6, 7], "rainfall": [80, 120],
    }

    if training_data and crop_name != "default":
        crop_rows = [r for r in training_data if r["label"].lower() == crop_name]
        if crop_rows:
            for feat in ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]:
                vals = [r["features"][feat] for r in crop_rows if feat in r["features"]]
                if vals:
                    mean = sum(vals) / len(vals)
                    std = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))
                    target[feat] = [mean - std, mean + std]

    impacts = []
    for feature, value in inputs.items():
        if feature not in target:
            continue
        value = float(value)
        lo, hi = target[feature]
        if lo <= value <= hi:
            score = 30 + random.random() * 20
            direction = "Optimal"
        elif value < lo:
            score = 5 + random.random() * 15
            direction = "Low"
        else:
            score = 5 + random.random() * 15
            direction = "Excessive"
        impacts.append({"feature": feature, "score": score, "direction": direction})

    impacts.sort(key=lambda x: x["score"], reverse=True)
    total = sum(i["score"] for i in impacts) or 1

    result = {}
    for item in impacts:
        pct = round((item["score"] / total) * 100)
        prefix = "+" if pct >= 15 else ""
        fname = item["feature"].upper() if item["feature"].lower() in ["n", "p", "k", "ph"] else item["feature"].capitalize()
        result[fname] = f"{prefix}{pct}% Impact ({item['direction']})"

    result["topFeature"] = impacts[0]["feature"].capitalize() if impacts else "None"
    return result


def attach_crop_specific_data(crop: dict, inputs: dict, training_data: list) -> dict:
    shap = shap_calculate(inputs, crop["name"], training_data)
    shap_array = []
    for key, val in shap.items():
        if key == "topFeature":
            continue
        import re
        m = re.match(r"([+-]?\d+)% Impact \((.*)\)", val)
        if m:
            pct = int(m.group(1))
            direction = m.group(2)
            shap_array.append({
                "feature": key,
                "value": pct if direction == "Optimal" else -abs(pct),
                "direction": direction,
            })
    shap_array.sort(key=lambda x: abs(x["value"]), reverse=True)

    npk_status = {}
    for nutrient in ["N", "P", "K"]:
        entry = next((s for s in shap_array if s["feature"].upper() == nutrient), None)
        npk_status[nutrient] = entry["direction"] if entry else "Optimal"

    crop_calendar = {
        "rice": {"sow": "Jun", "harvest": "Nov"}, "wheat": {"sow": "Nov", "harvest": "Apr"},
        "maize": {"sow": "Jun", "harvest": "Sep"}, "cotton": {"sow": "Apr", "harvest": "Oct"},
        "jute": {"sow": "Mar", "harvest": "Jul"}, "coconut": {"sow": "Jun", "harvest": "Dec"},
        "papaya": {"sow": "Feb", "harvest": "Dec"}, "orange": {"sow": "Jul", "harvest": "Feb"},
        "apple": {"sow": "Dec", "harvest": "Sep"}, "muskmelon": {"sow": "Feb", "harvest": "May"},
        "watermelon": {"sow": "Jan", "harvest": "May"}, "grapes": {"sow": "Jan", "harvest": "Jun"},
        "mango": {"sow": "Jul", "harvest": "Jun"}, "banana": {"sow": "Feb", "harvest": "Nov"},
        "pomegranate": {"sow": "Jul", "harvest": "Feb"}, "lentil": {"sow": "Oct", "harvest": "Mar"},
        "blackgram": {"sow": "Jul", "harvest": "Oct"}, "mungbean": {"sow": "Mar", "harvest": "Jun"},
        "mothbeans": {"sow": "Jul", "harvest": "Oct"}, "pigeonpeas": {"sow": "Jun", "harvest": "Dec"},
        "kidneybeans": {"sow": "Jun", "harvest": "Oct"}, "chickpea": {"sow": "Oct", "harvest": "Mar"},
        "coffee": {"sow": "Jun", "harvest": "Dec"},
    }
    cal = crop_calendar.get(crop["name"].lower(), {"sow": "—", "harvest": "—"})
    return {
        **crop,
        "shap": shap_array[:5],
        "npkStatus": npk_status,
        "sowMonth": cal["sow"],
        "harvestMonth": cal["harvest"],
        "topFeature": shap.get("topFeature"),
    }


# ── Auth Middleware ───────────────────────────────────────────────────────────
async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    if not auth:
        raise HTTPException(status_code=401, detail="No authorization header")
    token = auth.split(" ")[-1]
    result = supabase.auth.get_user(token)
    if not result or not result.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return result.user


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "running", "model_loaded": predictor.model is not None, "service": "AgriVision Python Backend v3.0"}


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

class SignupBody(BaseModel):
    email: str
    password: str

class SigninBody(BaseModel):
    email: str
    password: str

class RefreshBody(BaseModel):
    refresh_token: str

@app.post("/api/auth/signup", tags=["Auth"])
async def signup(body: SignupBody):
    try:
        result = supabase.auth.sign_up({"email": body.email, "password": body.password})
        if not result.user:
            raise HTTPException(status_code=400, detail="Signup failed")
        try:
            supabase.table("profiles").upsert({"id": result.user.id, "email": body.email}).execute()
        except Exception as pe:
            print(f"[Signup] Profile creation warning: {pe}")
        return {
            "message": "Signup successful",
            "user": {"id": result.user.id, "email": result.user.email},
            "token": result.session.access_token if result.session else None,
            "refresh_token": result.session.refresh_token if result.session else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/auth/signin", tags=["Auth"])
async def signin(body: SigninBody):
    try:
        result = supabase.auth.sign_in_with_password({"email": body.email, "password": body.password})
        if not result.session:
            raise HTTPException(status_code=400, detail="Signin failed")
        return {
            "message": "Signin successful",
            "token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/auth/refresh", tags=["Auth"])
async def refresh_token(body: RefreshBody):
    try:
        result = supabase.auth.refresh_session(body.refresh_token)
        if not result.session:
            raise HTTPException(status_code=401, detail="Failed to refresh session")
        return {"token": result.session.access_token, "refresh_token": result.session.refresh_token}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# ═══════════════════════════════════════════════════════════════════════════════
# SUBSIDIES (Public)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/subsidies", tags=["Subsidies"])
async def get_subsidies(crops: str = "", crop: str = "", state: str = "", district: str = "", region: str = ""):
    crops_raw = crops or crop
    crop_list = [c.strip() for c in crops_raw.split(",") if c.strip()] if crops_raw else []
    if not crop_list:
        raise HTTPException(status_code=400, detail="Provide ?crops=rice,wheat")
    result = await get_dynamic_subsidies(crop_list, state=state or region, district=district)
    return {"crops": crop_list, "state": state or region, "district": district, "data": result}


# ═══════════════════════════════════════════════════════════════════════════════
# PREDICTION
# ═══════════════════════════════════════════════════════════════════════════════

class PredictBody(BaseModel):
    N: float
    P: float
    K: float
    pH: float
    lat: Optional[float] = None
    lon: Optional[float] = None
    useLiveWeather: Optional[bool] = False
    temperature: Optional[float] = 25
    humidity: Optional[float] = 60
    rainfall: Optional[float] = 120
    season: Optional[str] = None
    isIrrigated: Optional[bool] = False
    technique: Optional[str] = "monocropping"
    soilType: Optional[str] = None
    language: Optional[str] = "en"
    targetCrop: Optional[str] = None
    farmSize: Optional[Any] = None
    primaryCrops: Optional[Any] = None


@app.post("/api/predict", tags=["Prediction"])
async def predict(body: PredictBody, user=Depends(get_current_user)):
    try:
        # ── 0. Geo / Language ──────────────────────────────────────────────
        language = body.language or "en"
        detected_region = None
        detected_district = None

        if body.lat and body.lon:
            geo = await reverse_geocode(body.lat, body.lon)
            if not body.language:
                language = geo["language"]
            detected_region = geo["region"]
            detected_district = geo["district"]

        # ── 1. Weather ─────────────────────────────────────────────────────
        daily_forecast = []
        if body.useLiveWeather and body.lat and body.lon:
            target_month = None
            if body.season == "kharif":
                target_month = 5
            elif body.season == "rabi":
                target_month = 10
            elif body.season == "zaid":
                target_month = 2

            climate = await get_climate_forecast(body.lat, body.lon, 120, target_month)
            temperature = climate["temperature"]
            humidity = climate["humidity"]
            rainfall = climate["rainfall"]
            wind_speed = climate["windSpeed"]

            current_f = await get_weather(body.lat, body.lon)
            daily_forecast = current_f.get("dailyForecast", [])
        else:
            temperature = body.temperature or 25
            humidity = body.humidity or 60
            rainfall = body.rainfall or 120
            wind_speed = 15

            if body.lat and body.lon:
                current_f = await get_weather(body.lat, body.lon)
                daily_forecast = current_f.get("dailyForecast", [])

        if body.isIrrigated:
            rainfall += 150

        inputs = {
            "N": body.N, "P": body.P, "K": body.K,
            "ph": body.pH,
            "temperature": temperature, "humidity": humidity, "rainfall": rainfall,
        }

        # ── 2. Market Prices ───────────────────────────────────────────────
        market_prices = await get_dynamic_market_prices(detected_region, detected_district)

        # ── 3. ML Prediction ───────────────────────────────────────────────
        py_inputs = {
            "N": body.N, "P": body.P, "K": body.K,
            "temperature": temperature, "humidity": humidity,
            "ph": body.pH, "rainfall": rainfall,
        }
        py_result = predictor.predict_top_crops(py_inputs, top_n=22)
        ml_predictions = py_result["predictions"]  # list of {crop, confidence}
        shap_importance = py_result.get("feature_importances", [])

        # ── 4. Load training data for SHAP engine ─────────────────────────
        training_data = predictor._load_training_data_for_shap()

        # ── 5. Attach Financials ───────────────────────────────────────────
        def attach_financials(crop_dict: dict) -> dict:
            name = crop_dict["name"].lower()
            data = market_prices.get(name, market_prices.get("default", {}))
            cost = data.get("costPerHectare", 35000)
            yield_tons = data.get("yieldPerHectareTons", 10)
            price_ton = data.get("pricePerTon", 15000)
            revenue = yield_tons * price_ton
            net = revenue - cost
            roi = round(((revenue - cost) / cost) * 100, 1) if cost else 0

            rain_fit = "Medium"
            min_rain = data.get("minRainfall", 50)
            max_rain = data.get("maxRainfall", 150)
            if min_rain <= rainfall <= max_rain:
                rain_fit = "High"
            elif rainfall < min_rain - 50 or rainfall > max_rain + 50:
                rain_fit = "Low"

            return {
                **crop_dict,
                "roi": str(roi),
                "avgCostPerHectare": cost,
                "expectedRevenue": revenue,
                "netReturnPerHectare": net,
                "rainfallFit": rain_fit,
                "isRealTimePrice": data.get("isRealTimePrice", False),
            }

        normalized = [{"name": p["crop"], "confidence": p["confidence"], **p} for p in ml_predictions]
        all_with_roi = [attach_financials(c) for c in normalized]

        # Sort by confidence then ROI
        all_with_roi.sort(key=lambda x: (-x["confidence"], -float(x["roi"])))

        THRESHOLD = 40
        if len(all_with_roi) >= 6:
            recommended_with_roi = all_with_roi[:3]
            avoid_with_roi = list(reversed(all_with_roi[-3:]))
        else:
            mid = math.ceil(len(all_with_roi) / 2)
            recommended_with_roi = all_with_roi[:mid]
            avoid_with_roi = list(reversed(all_with_roi[mid:]))

        # Attach SHAP + calendar to recommended
        recommended_with_roi = [
            {**attach_crop_specific_data(c, inputs, training_data), "isMarginal": c["confidence"] < THRESHOLD}
            for c in recommended_with_roi
        ]

        # Build avoid reasons
        def get_avoid_reason(crop: dict) -> str:
            name = crop["name"].lower()
            data = market_prices.get(name, market_prices.get("default", {}))
            preferred_soils = data.get("preferredSoil", [])
            if body.soilType and preferred_soils and body.soilType.lower() not in preferred_soils:
                return f"Requires {' or '.join(preferred_soils)} soil, but {body.soilType} soil was provided."

            crop_rows = [r for r in training_data if r["label"].lower() == name]
            if not crop_rows:
                return "Overall climate mismatch."

            min_max = {f: {"min": float("inf"), "max": float("-inf")} for f in ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]}
            for row in crop_rows:
                for key in min_max:
                    v = row["features"].get(key, 0)
                    if v < min_max[key]["min"]:
                        min_max[key]["min"] = v
                    if v > min_max[key]["max"]:
                        min_max[key]["max"] = v

            input_mapping = {"N": body.N, "P": body.P, "K": body.K, "temperature": temperature, "humidity": humidity, "ph": body.pH, "rainfall": rainfall}
            max_dev, worst_feat, worst_dir = 0, None, None
            for key, bounds in min_max.items():
                val = input_mapping.get(key, 0)
                dev, dire = 0, None
                if val < bounds["min"]:
                    dev = (bounds["min"] - val) / (bounds["min"] or 1)
                    dire = "low"
                elif val > bounds["max"]:
                    dev = (val - bounds["max"]) / (bounds["max"] or 1)
                    dire = "high"
                if dev > max_dev:
                    max_dev, worst_feat, worst_dir = dev, key, dire

            if worst_feat:
                feat_names = {"N": "Nitrogen", "P": "Phosphorus", "K": "Potassium", "temperature": "Temperature", "humidity": "Humidity", "ph": "Soil pH", "rainfall": "Rainfall"}
                lo = round(min_max[worst_feat]["min"])
                hi = round(min_max[worst_feat]["max"])
                return f"{feat_names[worst_feat]} ({input_mapping[worst_feat]}) is too {'high' if worst_dir == 'high' else 'low'} for {crop['name'].capitalize()} (ideal {lo}-{hi})."
            return "Overall climate mismatch."

        avoid_with_roi = [
            {**attach_crop_specific_data(crop, inputs, training_data), "avoidReason": get_avoid_reason(crop)}
            for crop in avoid_with_roi
        ]

        # Target crop
        target_crop_result = None
        if body.targetCrop:
            target_lower = body.targetCrop.lower()
            found = (
                next((c for c in recommended_with_roi if c["name"].lower() == target_lower), None) or
                next((c for c in avoid_with_roi if c["name"].lower() == target_lower), None) or
                next((c for c in all_with_roi if c["name"].lower() == target_lower), None)
            )
            if found:
                target_crop_result = found

        primary_crop = recommended_with_roi[0]["name"] if recommended_with_roi else (avoid_with_roi[0]["name"] if avoid_with_roi else "Unknown")

        # ── 6. Subsidies ───────────────────────────────────────────────────
        rec_names = [c["name"] for c in recommended_with_roi]
        government_subsidies = await get_dynamic_subsidies(rec_names, state=detected_region or "", district=detected_district or "")

        # ── 7. Groq AI Analysis ────────────────────────────────────────────
        risks = evaluate_risk(temperature, humidity, rainfall, wind_speed)
        groq_analysis = await get_comprehensive_analysis(
            inputs, recommended_with_roi, avoid_with_roi, shap_importance,
            body.technique or "monocropping", risks, language,
            body.farmSize, body.primaryCrops, target_crop_result,
        )
        ai_advice = groq_analysis.get("markdownAdvice", "")

        top_three = ", ".join(c["name"] for c in (recommended_with_roi + avoid_with_roi)[:3])

        full_response = {
            "recommendedCrops": recommended_with_roi,
            "avoidCrops": avoid_with_roi,
            "targetCropResult": target_crop_result,
            "shapImportance": shap_importance,
            "governmentSubsidies": government_subsidies,
            "aiAdvice": ai_advice,
            "alerts": groq_analysis.get("alerts", []),
            "weatherUsed": {"temperature": temperature, "humidity": humidity, "rainfall": rainfall, "windSpeed": wind_speed, "dailyForecast": daily_forecast},
            "detectedLanguage": language,
            "detectedRegion": detected_region,
        }

        # Embed payload for History page
        encoded_payload = f'\n\n<!--_RESULTS_PAYLOAD_START_{json.dumps(full_response)}_RESULTS_PAYLOAD_END_-->'
        advice_with_payload = ai_advice + encoded_payload

        # ── 8. Save to Supabase ────────────────────────────────────────────
        try:
            supabase.table("predictions").insert({
                "user_id": user.id,
                "recommended_crop": top_three,
                "soil_n": body.N, "soil_p": body.P, "soil_k": body.K,
                "ph": body.pH, "lat": body.lat, "lon": body.lon,
                "advice": advice_with_payload,
                "full_results": full_response,
            }).execute()
        except Exception as db_err:
            print(f"[DB] Failed to save prediction: {db_err}")

        return full_response

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate prediction: {str(exc)}")


# ═══════════════════════════════════════════════════════════════════════════════
# MARKET
# ═══════════════════════════════════════════════════════════════════════════════

class MarketBody(BaseModel):
    state: Optional[str] = None
    district: Optional[str] = None
    commodity: Optional[str] = None
    limit: Optional[int] = 50
    offset: Optional[int] = 0

@app.post("/api/market/prices", tags=["Market"])
async def market_prices(body: MarketBody, user=Depends(get_current_user)):
    result = await fetch_raw_mandi_records(body.state, body.district, body.commodity, body.limit, body.offset)
    if result.get("error"):
        print("MARKET API ERROR:", result["error"])
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# VISION
# ═══════════════════════════════════════════════════════════════════════════════

class VisionBody(BaseModel):
    image: str
    mimeType: Optional[str] = "image/jpeg"

@app.post("/api/vision/analyze-soil", tags=["Vision"])
async def vision_soil(body: VisionBody, user=Depends(get_current_user)):
    try:
        base64_data = body.image.replace("data:image/", "").split(";base64,")[-1] if ";base64," in body.image else body.image
        result = await analyze_soil_image(base64_data, body.mimeType or "image/jpeg")
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/vision/analyze-disease", tags=["Vision"])
async def vision_disease(body: VisionBody, user=Depends(get_current_user)):
    try:
        base64_data = body.image.replace("data:image/", "").split(";base64,")[-1] if ";base64," in body.image else body.image
        result = await analyze_disease_image(base64_data, body.mimeType or "image/jpeg")
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to analyze crop leaf image")


# ═══════════════════════════════════════════════════════════════════════════════
# FARMER PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/farmer/profile", tags=["Profile"])
async def get_profile(user=Depends(get_current_user)):
    try:
        result = supabase.table("profiles").select("*").eq("id", user.id).maybe_single().execute()
        return result.data or {}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch profile")

@app.put("/api/farmer/profile", tags=["Profile"])
async def update_profile(request: Request, user=Depends(get_current_user)):
    try:
        body = await request.json()
        from datetime import datetime, timezone
        profile_data = {"id": user.id, **body, "updated_at": datetime.now(timezone.utc).isoformat()}
        result = supabase.table("profiles").upsert(profile_data).select().execute()
        return result.data[0] if result.data else {}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/api/farmer/profile", tags=["Profile"])
async def delete_profile(user=Depends(get_current_user)):
    try:
        supabase.table("profiles").delete().eq("id", user.id).execute()
        supabase.table("predictions").delete().eq("user_id", user.id).execute()
        try:
            supabase.auth.admin.delete_user(user.id)
        except Exception:
            pass
        return {"message": "Account deleted"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete account")


# ═══════════════════════════════════════════════════════════════════════════════
# FAVORITE CROPS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/farmer/favorite-crops", tags=["Profile"])
async def get_favorites(user=Depends(get_current_user)):
    try:
        result = supabase.table("favorite_crops").select("crop_name, created_at").eq("user_id", user.id).order("created_at", desc=True).execute()
        return result.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch favorite crops")

class FavoriteBody(BaseModel):
    crop_name: str

@app.post("/api/farmer/favorite-crops", tags=["Profile"])
async def add_favorite(body: FavoriteBody, user=Depends(get_current_user)):
    if not body.crop_name:
        raise HTTPException(status_code=400, detail="Missing crop_name")
    try:
        result = supabase.table("favorite_crops").upsert({"user_id": user.id, "crop_name": body.crop_name}, on_conflict="user_id,crop_name").select().execute()
        return result.data[0] if result.data else {"crop_name": body.crop_name}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/api/farmer/favorite-crops/{crop_name}", tags=["Profile"])
async def remove_favorite(crop_name: str, user=Depends(get_current_user)):
    try:
        from urllib.parse import unquote
        supabase.table("favorite_crops").delete().eq("user_id", user.id).eq("crop_name", unquote(crop_name)).execute()
        return {"message": "Favorite removed"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to remove favorite crop")


# ═══════════════════════════════════════════════════════════════════════════════
# VOICE INPUT
# ═══════════════════════════════════════════════════════════════════════════════

class VoiceBody(BaseModel):
    transcript: str

@app.post("/api/parse-voice", tags=["Voice"])
async def parse_voice(body: VoiceBody, user=Depends(get_current_user)):
    if not body.transcript:
        raise HTTPException(status_code=400, detail="Missing transcript")
    return await parse_voice_input(body.transcript)


# ═══════════════════════════════════════════════════════════════════════════════
# PREDICTION HISTORY
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/predictions/history", tags=["History"])
async def get_history(user=Depends(get_current_user)):
    try:
        result = supabase.table("predictions").select("*").eq("user_id", user.id).order("created_at", desc=True).execute()
        return result.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch prediction history")

@app.delete("/api/predictions/history/{record_id}", tags=["History"])
async def delete_history(record_id: str, user=Depends(get_current_user)):
    try:
        supabase.table("predictions").delete().eq("id", record_id).eq("user_id", user.id).execute()
        return {"message": "Prediction record deleted successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete prediction record")


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════════════


@app.post("/api/ai/fertilizer-plan")
async def generate_fertilizer_plan(request: Request):
    try:
        data = await request.json()
        result = await get_ai_fertilizer_plan(data)
        return result
    except Exception as e:
        print(f"Error in fertilizer AI endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5000))
    print(f"[AgriVision] Python Backend starting on port {port}...")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
