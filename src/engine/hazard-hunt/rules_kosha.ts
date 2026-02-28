// src/engine/hazard-hunt/rules_kosha.ts
// KOSHA 지침(2G-12-2013) 기반 보호구 룰셋 정의

export interface PPEItem {
    id: string;
    name: string;
    category: "respirator" | "body" | "eye" | "head" | "hand" | "foot";
    grade: "특급" | "1급" | "2급" | "방독_유기" | "방독_할로겐" | "송기" | "일반";
    description: string;
}

export const PPE_DATABASE: Record<string, PPEItem> = {
    "resp_air": {
        id: "resp_air",
        name: "송기마스크 / 공기호흡기",
        category: "respirator",
        grade: "송기",
        description: "독립된 공기원을 공급. 산소결핍(18% 미만) 환경에서 유일하게 생존 가능.",
    },
    "resp_gas_organic": {
        id: "resp_gas_organic",
        name: "방독마스크 (유기화합물용)",
        category: "respirator",
        grade: "방독_유기",
        description: "시클로헥산 테스트 통과. 유기 가스 차단용. 산소농도 18% 미만 시 사용 불가.",
    },
    "resp_dust_special": {
        id: "resp_dust_special",
        name: "특급 방진마스크",
        category: "respirator",
        grade: "특급",
        description: "베릴륨, 석면 등 독성이 강한 물질용 고효율 필터.",
    },
    "body_chemical": {
        id: "body_chemical",
        name: "전신 화학 보호복",
        category: "body",
        grade: "특급",
        description: "유해물질의 피부 접촉을 전면 차단.",
    },
    "eye_goggle": {
        id: "eye_goggle",
        name: "고글형 밀폐 보안경",
        category: "eye",
        grade: "특급",
        description: "석면 분진이나 화학물질 비산으로부터 눈을 보호.",
    }
};

export interface HazardScenario {
    id: string;
    title: string;
    description: string;
    environment: {
        oxygenLevel: number; // percentage
        primaryHazard: "산소결핍" | "유해가스" | "석면분진";
    };
    requiredCategories: string[]; // e.g. ["respirator", "body"]
    validationRules: {
        // 맞춤형 검증 로직 이름
        ruleId: string;
    }[];
}

export const SCENARIOS: Record<string, HazardScenario> = {
    "mission_1_manhole": {
        id: "mission_1_manhole",
        title: "밀폐공간의 그림자",
        description: "유해가스로 인해 추락 위험이 있는 맨홀 내부 작업입니다.",
        environment: {
            oxygenLevel: 17.5,
            primaryHazard: "산소결핍"
        },
        requiredCategories: ["respirator"],
        validationRules: [
            { ruleId: "strict_oxygen_check" }
        ]
    },
    "mission_2_asbestos": {
        id: "mission_2_asbestos",
        title: "침묵의 살인자, 석면",
        description: "노후 건물의 석면 해체 및 제거 작업 현장입니다.",
        environment: {
            oxygenLevel: 21.0,
            primaryHazard: "석면분진"
        },
        requiredCategories: ["respirator", "body", "eye"],
        validationRules: [
            { ruleId: "asbestos_gear_check" }
        ]
    }
};
