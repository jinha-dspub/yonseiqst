export const MockUsers: Record<string, any> = {
    jinha: {
        agent_id: "SUPERUSER",
        name: "Jinha",
        role: "superuser",
        level: 99,
        exp: 9999,
        inventory: ["All Access Key", "Master Code", "System Override Token"],
        current_mission: "Platform Administration",
    },
    taeyeon: {
        agent_id: "STAFF",
        name: "Taeyeon",
        role: "staff",
        level: 50,
        exp: 5000,
        inventory: ["Staff Keycard", "Mission Controller"],
        current_mission: "Agent Monitoring",
    },
    student: {
        agent_id: "Y2026-001",
        name: "홍길동",
        role: "student",
        level: 5,
        exp: 450,
        inventory: ["히포크라테스 기록물", "퍼시벌 포트의 가위"],
        current_mission: "산업혁명과 굴뚝청소부",
    },
};

export const MissionNodesMock = [
    // 실제 미션 데이터는 추후 추가 예정
];
