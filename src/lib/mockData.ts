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
    {
        id: "node_1",
        era: "고대",
        title: "광산 노예의 폐질환",
        status: "Clear",
        reward: "히포크라테스 기록물",
    },
    {
        id: "node_2",
        era: "산업혁명",
        title: "굴뚝청소부의 암",
        status: "In Progress",
        reward: "퍼시벌 포트의 외과 가위",
    },
    {
        id: "node_3",
        era: "현대",
        title: "이황화탄소 중독",
        status: "Locked",
        reward: "최신 방독 마스크",
    },
];
