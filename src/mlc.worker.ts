import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Runs the actual inference off the main thread so the UI stays responsive
// while the model downloads and generates.
const handler = new WebWorkerMLCEngineHandler();
onmessage = handler.onmessage.bind(handler);
