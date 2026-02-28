import { NextResponse } from 'next/server';
import { evaluateMission, EvaluationResult } from '../../../engine/hazard-hunt/evaluator';
import { generateKoshaFeedback } from '../../../engine/hazard-hunt/gemini_ai';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { scenarioId, equippedIds } = body;

        if (!scenarioId || !equippedIds) {
            return NextResponse.json({ error: 'Missing scenarioId or equippedIds' }, { status: 400 });
        }

        // 1. Rule-based Evaluation (Fast & Deterministic)
        const result: EvaluationResult = evaluateMission(scenarioId, equippedIds);

        // 2. AI-driven Feedback Enrichment (for failures/death logs)
        // In a real high-traffic environment, we might run this asynchronously or only for specific modes.
        const enrichedLog = await generateKoshaFeedback(scenarioId, result);
        result.log = enrichedLog;

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
