"""
services/ai_service.py — Groq LLM calls (analysis + voice parsing)
"""
import os
import json
from groq import AsyncGroq

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu",
    "kn": "Kannada", "gu": "Gujarati", "bn": "Bengali", "pa": "Punjabi", "ml": "Malayalam",
    "or": "Odia", "es": "Spanish", "fr": "French",
}


def _groq_client() -> AsyncGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("Missing GROQ_API_KEY")
    return AsyncGroq(api_key=api_key)


async def get_comprehensive_analysis(
    inputs: dict,
    recommended_crops: list,
    avoid_crops: list,
    shap_importance: list,
    technique: str = "monocropping",
    risks: list = None,
    language: str = "en",
    farm_size=None,
    primary_crops=None,
    target_crop_result=None,
) -> dict:
    if risks is None:
        risks = []

    rec_names = ", ".join(
        c["name"].capitalize() for c in recommended_crops
    ) or "None"
    avoid_names = ", ".join(
        c["name"].capitalize() for c in avoid_crops
    ) or "None"
    target_language = LANGUAGE_NAMES.get(language, "English")

    prompt = f"""You are a Senior AI Agronomist and Soil Scientist with 20+ years of experience advising farmers across India. Analyze the following precision soil and climate data and generate an expert, highly detailed agronomic report.

FARM DATA:
- Soil Inputs (N/P/K in mg/kg, pH): {json.dumps(inputs)}
- ML-Recommended Crops (high viability): {rec_names}
- Crops to Avoid (low viability / high risk): {avoid_names}
- Key Feature Importances from ML Model: {json.dumps(shap_importance)}
- Farming Technique Selected: {technique}
- Farmer's Total Farm Size (Acres): {farm_size or 'Not specified'}
- Farmer's Existing Primary Crops: {primary_crops or 'Not specified'}
- Farmer's Specifically Targetted Crop (if any): {target_crop_result['name'] if target_crop_result else 'None'}

IMPORTANT INSTRUCTIONS:
- Be highly specific and detailed. Do NOT give generic advice.
- Reference the exact numeric values from the data to justify every recommendation.
- For each recommended crop, write AT LEAST 3 rich paragraphs covering: (1) why this crop's soil chemistry requirements precisely match the given N/P/K and pH, (2) ideal growth timeline, sowing window, and expected harvesting period for the Indian context, (3) water management strategy given the rainfall level, and (4) current market opportunity and what price this crop fetches.
- Note how their Farm Size might influence economics of scale for these crops, and if their Existing Primary Crops offer good crop rotation opportunities.
- If a Target Crop was specified, explicitly address its viability in a separate paragraph.
- For each crop to avoid, give a thorough explanation of exactly which parameter(s) are out of range and what specific agronomic consequence that will have (e.g., yellowing, root burn, low germination, fungal susceptibility).

Generate a detailed markdown report strictly with these two sections (no intro/outro, no extra commentary):

### 1. ✅ Recommended Crops
For EACH crop in the Highly Recommended list: explain precisely WHY the soil chemistry (specific N, P, K, pH numbers) and climate (temperature, humidity, rainfall) make this crop an ideal choice. Include: growth duration and sowing-to-harvest timeline, water and irrigation needs given the data, soil preparation tips, and expected yield and market value in Indian context.

### 2. ⚠️ Crops Needing Extra Care
For EACH crop in the lower-match list: explain in detail which specific input values (N too low/high? pH too acidic? rainfall excessive?) are causing the lower match score. Crucially, also provide **what the farmer can do to improve conditions** for this crop — e.g., add lime to raise pH, apply specific fertilizer, install drip irrigation. Describe what failure symptoms the farmer would observe if they proceed without any adjustments, and what the financial impact would be."""

    if technique != "monocropping":
        prompt += f"\n### 4. Technique Implementation: {technique.capitalize()}\nExplain exactly how to implement this geometric farming technique using a combination of the top 3 crops."

    if risks:
        risk_json = json.dumps(risks)
        prompt += f"""\n\n### 3. ⚠️ Pest & Disease Risk Alerts
The following environmental risk conditions were automatically detected from the weather data: {risk_json}.

For EACH detected risk, write a detailed alert with ALL of the following:
1. **What it is**: Describe the disease or pest in 1-2 sentences.
2. **Visual Symptoms**: What the farmer will SEE on their plants (leaf color changes, spots, wilting, insect presence, etc.).
3. **Crops Most Affected**: List which specific crops from the recommended list are most vulnerable.
4. **Immediate Action**: A specific, named treatment — include a product type (e.g., "copper-based fungicide", "neem oil spray at 5ml/L", "Chlorpyrifos 2ml/L"), application frequency, and the best time of day to apply.
5. **Prevention**: One long-term preventative measure the farmer should adopt.

Use a ⚠️ emoji prefix for each alert and make each one at least 4-5 sentences long."""

    if target_language != "English":
        prompt += f"\n\nCRITICAL LANGUAGE INSTRUCTION: Write the ENTIRE report — including all headings, body text, and every alert message — in {target_language}. Do not include any English except for standard scientific abbreviations (N, P, K, pH) or crop names where there is no common local equivalent. Keep the markdown structure (###, **, etc.) exactly the same, just translate the content."

    prompt += '\n\nReturn ONLY a valid JSON object exactly matching this structure, with no extra text or markdown blocks:\n{"markdownAdvice": "string containing the full markdown report"'
    if risks:
        prompt += ',\n  "alerts": [\n    { "risk": "string", "severity": "string", "message": "string" }\n  ]'
    prompt += "\n}"

    try:
        client = _groq_client()
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.5,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as exc:
        print(f"[Groq] Analysis error: {exc}")
        fallback_alerts = [
            {"risk": r["risk"], "severity": r["severity"], "message": f"⚠️ High risk detected for {r['risk']}. {r['recommendation']}"}
            for r in risks
        ]
        return {
            "markdownAdvice": f"### 1. Recommended Crops\nThe ML model has calculated an exceptionally high viability score for {rec_names} given the specific NPK and pH levels of your soil.\n\n### 2. Crops to Avoid\n{avoid_names} showed marginal viability. Proceed with caution.",
            "alerts": fallback_alerts,
        }


async def parse_voice_input(transcript: str) -> dict:
    prompt = f"""You are a data extraction assistant for a farming app. A farmer spoke the following sentence describing their soil and weather conditions. Extract ONLY the parameters they explicitly mentioned into a JSON object.

Farmer's speech: "{transcript}"

Fields to look for (use these exact keys, all optional — only include a field if the farmer clearly mentioned it):
- N: Nitrogen level in mg/kg (if they say "high nitrogen" without a number, estimate ~90; "low nitrogen" ~20; "medium/moderate" ~50)
- P: Phosphorus level in mg/kg (high ~80, low ~15, medium ~40)
- K: Potassium level in mg/kg (high ~120, low ~15, medium ~50)
- pH: Soil pH, typically 3.5-9.9 (acidic ~5.5, neutral ~7.0, alkaline ~8.5)
- temperature: Degrees Celsius (hot ~38, cold ~10, mild/moderate ~24). Convert Fahrenheit to Celsius if mentioned.
- humidity: Percentage 10-100 (humid ~85, dry ~25, moderate ~55)
- rainfall: Millimeters (heavy rain ~250, light rain ~50, moderate ~120)

Only include a key if the farmer's sentence gives a genuine signal for it — do not invent values for parameters they never mentioned.

Return ONLY a valid JSON object, no extra text:
{{ "extracted": {{ <only the fields mentioned> }}, "summary": "one short sentence confirming what was understood" }}"""

    try:
        client = _groq_client()
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as exc:
        print(f"[Groq] Voice parse error: {exc}")
        return {"extracted": {}, "summary": "Sorry, I couldn't understand those values. Please try again or use the sliders."}


async def get_ai_fertilizer_plan(inputs: dict) -> dict:
    prompt = f"""You are a Senior AI Agronomist specializing in Indian agriculture. 
A farmer needs a highly optimized, parameter-specific fertilizer plan based on the following detailed farm inputs:
{json.dumps(inputs, indent=2)}

Based on these specific conditions (considering the crop, exact land area, growth stage, soil type, NPK levels, irrigation type, and season), generate a precise fertilizer recommendation.

If the user provided recent soil test data (N, P, K, pH), strictly adjust your recommended dosages (e.g., lower Nitrogen dosage if soil N is high, etc.).
If previous crop was a legume, account for residual nitrogen and lower the urea requirement.

Return exactly one valid JSON object matching the following structure:
{{
  "found": true,
  "crop": "Crop Name",
  "growthStage": "Growth Stage",
  "fertilizers": [
    {{
      "name": "Fertilizer Name (e.g., Urea, DAP, MOP, FYM)",
      "dosage": "Specific scaled dosage for the entire land area (e.g., '50 kg')",
      "method": "Application method (e.g., Basal, Top dressing, Fertigation)",
      "timing": "When to apply"
    }}
  ],
  "notes": [
    "A specific agronomic note or tip based on the provided inputs (e.g., specific to the season, irrigation type, or soil conditions).",
    "Another note..."
  ]
}}

Ensure the 'dosage' strings explicitly state the amount for the FULL land area requested ({inputs.get('landArea', '1')} {inputs.get('unit', 'acre')}s). Do not include any extra text outside the JSON.
"""
    try:
        client = _groq_client()
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as exc:
        print(f"[Groq] Fertilizer AI error: {exc}")
        return {
            "found": False,
            "message": "AI failed to generate a plan. Please try again.",
            "fertilizers": [],
            "notes": []
        }
