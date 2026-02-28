// src/engine/hazard-hunt/evaluator.ts
import { PPE_DATABASE, SCENARIOS, HazardScenario } from "./rules_kosha";

export interface EvaluationResult {
    success: boolean;
    score: number;
    log: string; // The "Death Log" or success message
    koshaReference?: string; // e.g. "KOSHA Guide 2G-12-2013: 6. 개인보호구의 종류"
}

export function evaluateMission(scenarioId: string, equippedIds: string[]): EvaluationResult {
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) throw new Error("Unknown Scenario");

    // Fetch actual items
    const equipment = equippedIds.map(id => PPE_DATABASE[id]).filter(Boolean);

    // Rule 1: Oxygen Deficiency (Immediate Death)
    if (scenario.environment.oxygenLevel < 18.0) {
        const hasAirSupply = equipment.some(item => item.grade === "송기");
        if (!hasAirSupply) {
            return {
                success: false,
                score: -100,
                log: `[사망] 산소농도 ${scenario.environment.oxygenLevel}%의 밀폐공간에 진입했습니다. 당신이 착용한 방독/방진 마스크는 산소를 만들어내지 못합니다. 질식하여 쓰러졌습니다.`,
                koshaReference: "KOSHA Guide 2G-12-2013: 방독마스크는 산소농도 18% 미만 장소에서 사용 불가. 송기마스크 또는 공기호흡기를 반드시 착용해야 함."
            };
        }
    }

    // Rule 2: Asbestos Mission (Full Gear Check)
    if (scenario.environment.primaryHazard === "석면분진") {
        const hasSpecialDustMask = equipment.some(item => item.grade === "특급");
        const hasGoggles = equipment.some(item => item.category === "eye" && item.grade === "특급");
        const hasSuit = equipment.some(item => item.category === "body");

        if (!hasSpecialDustMask) {
            return {
                success: false,
                score: -50,
                log: "[실패] 발암물질인 석면 분진을 일반/방독 마스크로 막으려 했습니다. 석면이 폐포에 깊숙이 침투했습니다.",
                koshaReference: "석면 해체·제거 작업 시에는 특급 방진마스크 이상의 호흡용 보호구를 착용해야 함."
            };
        }

        if (!hasGoggles || !hasSuit) {
            return {
                success: false,
                score: -30,
                log: "[경고] 호흡기는 보호했으나, 노출된 피부와 안구 점막으로 석면 입자가 달라붙고 있습니다. 전면적인 보호가 필요합니다.",
                koshaReference: "신체를 감싸는 보호복, 보안경(고글형) 착용 지침 위반."
            };
        }
    }

    // If survived all rules
    return {
        success: true,
        score: 100,
        log: "[임무 성공] 적절한 개인보호구(PPE) 조합으로 현장의 유해인자를 완벽히 차단했습니다. 요원 생존.",
        koshaReference: "올바른 보호구 착용 완료"
    };
}
