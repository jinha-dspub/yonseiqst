import { GoogleGenAI } from "@google/genai";
import { EvaluationResult } from "./evaluator";
import { SCENARIOS } from "./rules_kosha";

// Load from .env into process.env if available, or direct fallback for local testing
const apiKey = process.env.GEMINI_API_KEY || "AIzaSyB0aZ-xBmYqOEwGfDMXEO4neF0CuIxemcg";
const ai = new GoogleGenAI({ apiKey });

export async function generateKoshaFeedback(
    scenarioId: string,
    result: EvaluationResult
): Promise<string> {
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) return result.log;

    // If the user succeeded, we don't necessarily need AI to generate a death log
    if (result.success) {
        return result.log;
    }

    const prompt = `
    당신은 연세대학교 의과대학 (YONSEI QST)의 혹독한 직업환경의학 방탈출 게임 마스터입니다.
    플레이어가 다음 임무에서 "사망" 또는 "실패"했습니다.

    [임무 정보]
    - 미션명: ${scenario.title}
    - 상황: ${scenario.description}
    - 산소농도: ${scenario.environment.oxygenLevel}%
    - 주요 위험인자: ${scenario.environment.primaryHazard}

    [플레이어 평가 결과 (룰 기반)]
    - 실패 사유: ${result.log}
    - 위반한 KOSHA 지침: ${result.koshaReference}

    [요청 사항]
    위 실패 사유와 KOSHA 지침을 바탕으로, 플레이어가 왜 해당 보호구 미착용/오착용으로 인해 
    치명적인 피해를 입었는지 **단호하고 약간 공포스러운** 어투로 로그를 작성해주세요.
    반드시 KOSHA 기술지침을 근거로 교육적인 내용을 포함해야 합니다.
    출력은 3~4문장 이내로 짧게 마무리하세요.
  `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || result.log;
    } catch (error) {
        console.error("Gemini API Error:", error);
        // Fallback to static rule-based log if AI fails
        return result.log + " (System Note: AI Feedback Unavailable)";
    }
}
